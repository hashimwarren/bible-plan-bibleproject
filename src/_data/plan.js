const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function normalizeYouTubeToEmbed(u) {
  if (!u) return null;
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, '');
    // Preserve start time (t or start)
    const t = url.searchParams.get('t') || url.searchParams.get('start');
    let id = null;
    if (host === 'youtu.be') {
      id = url.pathname.replace(/^\//, '');
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname.startsWith('/watch')) {
        id = url.searchParams.get('v');
      } else if (url.pathname.startsWith('/embed/')) {
        id = url.pathname.split('/')[2];
      } else if (url.pathname.startsWith('/shorts/')) {
        id = url.pathname.split('/')[2];
      }
    } else if (host === 'youtube.com') {
      // fallback
      id = url.searchParams.get('v');
    }
    if (!id) return u;
    const embed = new URL(`https://www.youtube.com/embed/${id}`);
    if (t) embed.searchParams.set('start', String(parseInt(t, 10) || 0));
    return embed.toString();
  } catch {
    return u;
  }
}

module.exports = () => {
  const csvPath = path.resolve(__dirname, '../../combined-reading-plan-with-videos.csv');
  if (!fs.existsSync(csvPath)) {
    console.warn('combined-reading-plan-with-videos.csv not found. Run `npm run build:combined` first.');
    return { days: [], scriptureIndex: [] };
  }
  const content = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });

  const days = records
    .map((r) => {
      const day = parseInt(r.Day, 10);
      const splitRefs = (s) => (s ? s.split(';').map(x => x.trim()).filter(Boolean) : []);
      const splitVideos = (s) => (s ? s.split('|').map(x => x.trim()).filter(Boolean).map(normalizeYouTubeToEmbed) : []);
      return {
        day,
        otReadings: splitRefs(r.OT_Scripture_Readings),
        ntReadings: splitRefs(r.NT_Scripture_Readings),
        otUrl: r.OT_URL || '',
        ntUrl: r.NT_URL || '',
        videos: splitVideos(r.Video_URLs),
  // justiceRefs will be filled later if a justice verse maps to this day
  justiceRefs: [],
      };
    })
    .sort((a, b) => a.day - b.day);

  // Build scripture index
  const indexSet = new Map(); // key: ref|day -> true
  const scriptureIndex = [];
  for (const d of days) {
    for (const ref of [...d.otReadings, ...d.ntReadings]) {
      const key = `${ref}|${d.day}`;
      if (!indexSet.has(key)) {
        indexSet.set(key, true);
        scriptureIndex.push({ ref, day: d.day });
      }
    }
  }
  scriptureIndex.sort((a, b) => a.ref.localeCompare(b.ref) || a.day - b.day);

  // Build a quick lookup from OT reading (e.g., "Genesis 18") -> [dayNumbers]
  const readingToDays = new Map();
  for (const d of days) {
    for (const ref of d.otReadings) {
      if (!readingToDays.has(ref)) readingToDays.set(ref, []);
      readingToDays.get(ref).push(d.day);
    }
  }

  // Load justice scripture references (one per line) and attach to matching days
  try {
    const justiceCsvPath = path.resolve(__dirname, '../../Justice-scriptures-in-old-testament.csv');
    if (fs.existsSync(justiceCsvPath)) {
      const jContent = fs.readFileSync(justiceCsvPath, 'utf8').replace(/^\uFEFF/, '');
      const lines = jContent
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^#/.test(l));

      // Helper: normalize a full verse ref to an OT reading key (Book + Chapter)
      const toReadingKey = (fullRef) => {
        // Example: "Psalm 1:5" -> { book: "Psalms", chap: "1" } => "Psalms 1"
        const m = fullRef.match(/^(.+?)\s+(\d+)(?::\d+.*)?$/);
        if (!m) return null;
        let book = m[1].trim();
        const chap = m[2].trim();
        // Normalize book name variants to match combined CSV
        if (/^Psalm\b/i.test(book)) book = book.replace(/^Psalm\b/, 'Psalms');
        // Standardize whitespace
        book = book.replace(/\s+/g, ' ').trim();
        return `${book} ${chap}`;
      };

      // Map for quick access to day object by day number
      const dayMap = new Map(days.map((d) => [d.day, d]));

      for (const fullRef of lines) {
        const key = toReadingKey(fullRef);
        if (!key) continue;
        const matchDays = readingToDays.get(key);
        if (!matchDays || matchDays.length === 0) continue;
        for (const dayNum of matchDays) {
          const d = dayMap.get(dayNum);
          if (!d) continue;
          // Avoid duplicates
          if (!d.justiceRefs.includes(fullRef)) d.justiceRefs.push(fullRef);
        }
      }
    } else {
      // File optional: skip quietly
    }
  } catch (e) {
    console.warn('Failed loading Justice-scriptures-in-old-testament.csv:', e && e.message ? e.message : e);
  }

  const weeks = [];
  if (days && days.length) {
    for (let i = 0; i < days.length; i += 7) {
      const week = days.slice(i, i + 7);
      // Compute week-level justice flag
      const hasJustice = week.some((d) => d.justiceRefs && d.justiceRefs.length > 0);
      weeks.push({
        weekNumber: (i / 7) + 1,
        days: week,
        hasJustice,
      });
    }
  }

  // Convenience: boolean per day
  for (const d of days) {
    d.hasJustice = Array.isArray(d.justiceRefs) && d.justiceRefs.length > 0;
  }

  return { days, scriptureIndex, weeks };
};
