"use strict";

const axios = require("axios");
const cheerio = require("cheerio");
// Lightweight concurrency limiter to avoid ESM interop issues with p-limit
function createPLimit(concurrency) {
  let active = 0;
  const queue = [];
  function runNext() {
    if (active >= concurrency) return;
    const item = queue.shift();
    if (!item) return;
    active++;
    Promise.resolve()
      .then(item.fn)
      .then((val) => {
        active--;
        item.resolve(val);
        runNext();
      })
      .catch((err) => {
        active--;
        item.reject(err);
        runNext();
      });
  }
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
}

/**
 * Generate a URL for a given day.
 * Priority:
 *  - options.baseUrlFn(day)
 *  - process.env.PLAN_URL_TEMPLATE with {day} placeholder
 *  - throws if neither provided
 * @param {number} day
 * @param {{ baseUrlFn?: (day:number)=>string }} options
 */
function urlForDay(day, options = {}) {
  if (options.baseUrlFn) return options.baseUrlFn(day);
  const tpl = process.env.PLAN_URL_TEMPLATE;
  if (tpl && tpl.includes("{day}")) {
    return tpl.replace("{day}", String(day));
  }
  throw new Error(
    "No URL template provided. Set PLAN_URL_TEMPLATE env var with '{day}' placeholder or pass options.baseUrlFn"
  );
}

/**
 * Sleep utility
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Fetch with retries on 429/5xx using exponential backoff with jitter.
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=5]
 * @param {number} [opts.baseDelayMs=500]
 * @returns {Promise<import('axios').AxiosResponse<any>>}
 */
async function fetchWithRetry(url, opts = {}) {
  const {
    maxRetries = 5,
    baseDelayMs = 500,
    timeout = 15000,
    headers = {},
  } = opts;

  let attempt = 0;
  let lastErr;
  while (attempt <= maxRetries) {
    try {
      const res = await axios.get(url, {
        timeout,
        headers: {
          "User-Agent":
            headers["User-Agent"] ||
            "Mozilla/5.0 (compatible; PlanScraper/1.0; +https://example.com)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          ...headers,
        },
        validateStatus: () => true, // we'll handle status manually
      });

      if (res.status >= 200 && res.status < 300) return res;

      // Retry on 429 and 5xx
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }

      // Non-retryable status
      const err = new Error(`Non-retryable HTTP status ${res.status} for ${url}`);
      err.response = res;
      throw err;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const shouldRetry =
        err.code === "ECONNABORTED" || // timeout
        err.code === "ENOTFOUND" ||
        err.code === "ECONNRESET" ||
        status === 429 ||
        (status >= 500 && status <= 599);

      if (!shouldRetry || attempt === maxRetries) {
        break;
      }

      const backoff = Math.round(
        baseDelayMs * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4)
      );
      await sleep(backoff);
      attempt += 1;
    }
  }
  throw lastErr;
}

/**
 * Attempt to extract the readings string from HTML using Cheerio.
 * Tries a few common selectors, then falls back to a heuristic regex scan.
 * @param {string} html
 * @returns {string|null}
 */
function extractReadings(html) {
  const $ = cheerio.load(html);

  // Try DOM-anchored extraction near the 'Scripture' heading first
  const domRefs = domExtractScriptureRefs($);
  if (domRefs && domRefs.length) {
    return domRefs.join("; ");
  }

  // Common selectors to try
  const selectors = [
    "[data-test=readings]",
    ".readings",
    ".reading-list",
    ".plan-readings",
    "#readings",
    "main .readings",
    "article .readings",
  // Likely code/pre blocks as mentioned (predictable code block)
  "pre code",
  "code",
  "pre",
  ];
  for (const sel of selectors) {
    const text = $(sel).first().text().trim();
    if (text) {
      const cleaned = normalizeReadings(text);
      if (cleaned) return cleaned;
    }
  }

  // Fallback: parse references from the page text, preferably near the 'Scripture' section
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const lower = bodyText.toLowerCase();
  const idx = lower.indexOf("scripture");
  let windowText = bodyText;
  if (idx >= 0) {
    // Take a window between 'Scripture' and the CTA/boundary to isolate the references for this day
    const boundaries = [
      "start this plan",
      "about this plan",
      "day ", // next/prev day navigation
    ];
    let end = -1;
    for (const b of boundaries) {
      const j = lower.indexOf(b, idx + 9);
      if (j !== -1 && (end === -1 || j < end)) end = j;
    }
    if (end === -1) end = Math.min(idx + 600, bodyText.length);
    windowText = bodyText.slice(idx, end);
  }
  const refs = parseBibleReferences(windowText);
  if (refs.length) return refs.join("; ");

  // As a last resort, scan the whole text
  const refsAll = parseBibleReferences(bodyText);
  if (refsAll.length) return refsAll.join("; ");
  const candidate = findReadingsInText(bodyText);
  return candidate || null;
}

/**
 * Extract YouTube video URLs from the page HTML.
 * Looks for iframe embeds and anchor links to youtube.com/youtu.be.
 * Returns unique absolute URLs (prefer embed/watch forms as-is).
 * @param {string} html
 * @returns {string[]} Array of URLs
 */
function extractYouTubeEmbeds(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  const urls = new Set();

  const toAbs = (u) => {
    if (!u) return null;
    let url = String(u).trim();
    if (!url) return null;
    if (url.startsWith("//")) return "https:" + url;
    if (url.startsWith("/")) {
      // Likely from <a> within bible.com; treat non-youtube relative as skip
      // Only allow relative youtube embed paths like /embed/...
      if (/^\/embed\//i.test(url)) return "https://www.youtube.com" + url;
      return null;
    }
    return url;
  };

  // iframes with youtube
  $('iframe[src*="youtube.com"], iframe[src*="youtu.be"]').each((_, el) => {
    const u = toAbs($(el).attr("src"));
    if (u && /(youtube\.com|youtu\.be)/i.test(u)) urls.add(u);
  });

  // anchor links to youtube
  $('a[href*="youtube.com"], a[href*="youtu.be"]').each((_, el) => {
    const u = toAbs($(el).attr("href"));
    if (u && /(youtube\.com|youtu\.be)/i.test(u)) urls.add(u);
  });

  // JSON blobs sometimes contain the URL
  $('script[type="application/ld+json"], script[type="application/json"]').each((_, el) => {
    const txt = $(el).contents().text();
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      const collect = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const v of Object.values(obj)) {
          if (typeof v === 'string') {
            const m = v.match(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w\-?=&%/#.]+/gi);
            if (m) m.forEach((x) => urls.add(x));
          } else if (Array.isArray(v)) {
            v.forEach(collect);
          } else if (typeof v === 'object') {
            collect(v);
          }
        }
      };
      if (Array.isArray(parsed)) parsed.forEach(collect); else collect(parsed);
    } catch {
      // ignore JSON parse errors
    }
  });

  // Final fallback: regex scan of raw HTML
  const rx = /https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w\-?=&%/#.]+/gi;
  const m = html.match(rx);
  if (m) m.forEach((x) => urls.add(x));

  // Filter: only keep actual video URLs, not generic channel/home links
  const isVideo = (u) => /(youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i.test(u);
  return Array.from(urls).filter(isVideo);
}

function domExtractScriptureRefs($) {
  // Find headings containing 'Scripture'
  const headings = [];
  $("h1, h2, h3, h4").each((_, el) => {
    const t = $(el).text().trim().toLowerCase();
    if (t.includes("scripture")) headings.push(el);
  });
  const containers = [];
  for (const h of headings) {
    // Candidate container is the closest ancestor that contains /bible/ links
    let node = $(h);
    let found = null;
    for (let i = 0; i < 5; i++) {
      const cand = node.parent();
      if (!cand || !cand.length) break;
      if (cand.find('a[href^="/bible/"]').length) {
        found = cand;
        break;
      }
      node = cand;
    }
    if (found) containers.push(found);
  }
  const seen = new Set();
  const refs = [];
  const pushRef = (txt) => {
    const norm = normalizeRefText(txt);
    if (!norm) return;
    if (!seen.has(norm)) {
      seen.add(norm);
      refs.push(norm);
    }
  };
  for (const c of containers) {
    // Within the container, collect the anchor texts for Bible references
    c.find('a[href^="/bible/"]').each((_, a) => {
      const txt = $(a).text().trim();
      pushRef(txt);
    });
    if (refs.length) break; // first container is sufficient
  }
  return refs;
}

function normalizeRefText(txt) {
  if (!txt) return "";
  const t = txt.replace(/\s+/g, " ").trim();
  // Capitalize book name(s), handle numeric prefixes like '1 Samuel'
  // Extract book and chapter pattern
  const m = t.match(/^(\d\s+)?([A-Za-z\s]+?)\s+(\d+(?:[\-–]\d+)?)/);
  if (!m) return "";
  const num = (m[1] || "").trim();
  let book = (m[2] || "").trim();
  const chap = (m[3] || "").trim();
  // Normalize common variants
  if (/^psalm$/i.test(book)) book = "Psalms";
  if (/^song of songs$/i.test(book) || /^song$/i.test(book)) book = "Song of Songs";
  // Title-case words
  book = book
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
  const prefix = num ? num.trim() + " " : "";
  return `${prefix}${book} ${chap}`.trim();
}

/**
 * Normalize readings string by collapsing whitespace and normalizing separators
 * @param {string} text
 */
function normalizeReadings(text) {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  // If it contains likely Bible references and separators, keep as-is
  if (/\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\b/i.test(t)) {
    // Normalize separators to "; "
    const norm = t
      .replace(/\s*[•|·|,]\s*/g, "; ")
      .replace(/\s*;\s*/g, "; ")
      .replace(/\s*\u2013\s*/g, "–") // en dash
      .replace(/\s*\u2014\s*/g, "–"); // em dash -> en dash
    return norm;
  }
  return t;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Extract OT references like "Genesis 1", "1 Samuel 7", "Psalms 46–48" from a text blob
function parseBibleReferences(text) {
  if (!text) return [];
  const books = [
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Psalm",
    "Proverbs",
    "Ecclesiastes",
    "Song of Songs",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi",
  ];
  // Sort by length to prefer longer names (e.g., Song of Songs over Song)
  const bookPattern = books
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const re = new RegExp(
    `\\b(${bookPattern})\\s+(\\d+(?:[\\-–]\\d+)?)\\b`,
    "gi"
  );
  const results = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    const book = m[1].replace(/\s+/g, " ").trim();
    const chap = m[2].trim();
    const ref = `${book} ${chap}`;
    if (!seen.has(ref)) {
      seen.add(ref);
      results.push(ref);
    }
  }
  return results;
}

/**
 * Heuristic to find readings in a large text blob.
 * Looks for patterns like "Genesis 1-3; Matthew 1".
 * @param {string} text
 * @returns {string|null}
 */
function findReadingsInText(text) {
  const lines = text.split(/(?<=[\.!?])\s+|\n+/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    // Must contain at least one semicolon or comma separating two refs
    if (!/[;,]/.test(t)) continue;
    // Must contain digits and a book-like word
    if (!/(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)/i.test(t))
      continue;
    if (!/\d/.test(t)) continue;
    return normalizeReadings(t);
  }
  return null;
}

/**
 * Scrape a reading plan between start and end days (inclusive).
 * @param {number} startDay
 * @param {number} endDay
 * @param {{
 *   concurrency?: number,
 *   baseUrlFn?: (day:number)=>string,
 *   headers?: Record<string,string>,
 *   maxRetries?: number,
 *   baseDelayMs?: number,
 * }} [options]
 * @returns {Promise<{ day: number, readings: string }[]>}
 */
async function scrapePlan(startDay = 1, endDay = 365, options = {}) {
  const concurrency = options.concurrency ?? 5;
  const limit = createPLimit(concurrency);

  if (!Number.isInteger(startDay) || !Number.isInteger(endDay)) {
    throw new Error("startDay and endDay must be integers");
  }
  if (startDay < 1 || endDay < startDay) {
    throw new Error("Invalid day range");
  }

  const tasks = [];
  for (let day = startDay; day <= endDay; day++) {
    tasks.push(
      limit(async () => {
        const url = urlForDay(day, options);
        const res = await fetchWithRetry(url, {
          headers: options.headers,
          maxRetries: options.maxRetries,
          baseDelayMs: options.baseDelayMs,
        });
  const readings = extractReadings(res.data);
  const videos = extractYouTubeEmbeds(res.data);
        if (!readings) {
          throw new Error(`Could not extract readings for day ${day} (${url})`);
        }
  return { day, readings, videos };
      }).then(
        (v) => v,
        (err) => {
          // Attach day info to error and rethrow to handle later if needed
          err.day = day;
          err._url = (() => {
            try {
              return urlForDay(day, options);
            } catch {
              return undefined;
            }
          })();
          throw err;
        }
      )
    );
  }

  // Gather results, allowing some days to fail but reporting errors
  const results = [];
  const errors = [];
  await Promise.all(
    tasks.map((p) =>
      p.then((r) => results.push(r)).catch((e) => errors.push(e))
    )
  );

  // Sort results by day
  results.sort((a, b) => a.day - b.day);

  if (errors.length) {
    // Log concise error info to stderr but still return successful results
    for (const e of errors) {
      const msg = e?.message || String(e);
      const dayStr = typeof e.day === "number" ? `day ${e.day}` : "unknown day";
      const urlStr = e._url ? ` ${e._url}` : "";
      console.error(`[scrapePlan] Failed for ${dayStr}:${urlStr} -> ${msg}`);
    }
  }

  return results;
}

function parseCliArgs(argv) {
  const args = { startDay: 1, endDay: 365 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--startDay" || a === "-s") {
      args.startDay = parseInt(argv[++i], 10);
    } else if (a === "--endDay" || a === "-e") {
      args.endDay = parseInt(argv[++i], 10);
    } else if (a === "--concurrency" || a === "-c") {
      args.concurrency = parseInt(argv[++i], 10);
    } else if (a === "--help" || a === "-h") {
      args.help = true;
    } else {
      // support single arg formats like --startDay=10
      const m = a.match(/^--(startDay|endDay|concurrency)=(\d+)$/);
      if (m) {
        const key = m[1];
        const val = parseInt(m[2], 10);
        args[key] = val;
      }
    }
  }
  return args;
}

async function main() {
  const { startDay, endDay, concurrency, help } = parseCliArgs(process.argv);
  if (help) {
    console.log(
      "Usage: node scrapePlan.js [--startDay N] [--endDay M] [--concurrency K]\n" +
        "Environment: PLAN_URL_TEMPLATE must contain '{day}' (e.g., 'https://example.com/plan/day/{day}')\n" +
        "Output: JSON array of { day, readings } sorted by day"
    );
    process.exit(0);
  }

  try {
    const data = await scrapePlan(startDay, endDay, {
      concurrency,
      // baseUrlFn can be provided by other modules when importing this file
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(String(err?.stack || err));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrapePlan, extractReadings, extractYouTubeEmbeds, fetchWithRetry, urlForDay };

