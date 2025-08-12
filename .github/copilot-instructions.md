# Copilot instructions for this repo

Purpose: scrape Old Testament daily readings from bible.com and keep `old-testament-reading-plan.csv` up to date.

## Architecture: what lives where
- `scrapePlan.js`: Core scraper. Given a day range, builds URLs, fetches HTML with retries, parses readings via cheerio, and returns `{ day, readings }[]`.
  - Key exports: `scrapePlan(startDay, endDay, { concurrency, baseUrlFn, headers, ... })`, `extractReadings(html)`, `fetchWithRetry(url, opts)`, `urlForDay(day, opts)`.
  - Concurrency uses a small internal limiter (no external `p-limit` runtime dependency issues).
- `populate_plan.js`: Orchestrates scraping and merges results into the CSV. Converts result to updates of shape `{ Day, Scripture_Readings, URL }` then merges into `old-testament-reading-plan.csv` via `mergeCsvByKey`.
- `scripts/merge_csv.js`: CSV utilities (read, merge by key, atomic write). BOM-safe, preserves header order, union of columns, stable ordering.
- Data: `old-testament-reading-plan.csv` at repo root is the canonical dataset. `csv-updater/` appears legacy; prefer the root CSV.

## Data shapes and columns
- Scraper result: `{ day: number, readings: string }` (sorted by `day`).
- CSV rows: keys are strings; at minimum `Day` (string), `Scripture_Readings` (string), `URL` (string).
- Merge key: `Day` (string). `mergeCsvByKey(..., { keyColumn: 'Day', sortNumeric: true })` is the convention.

## Important behaviors and conventions
- URL template: Either pass `baseUrlFn(day)` or set env `PLAN_URL_TEMPLATE` with a `{day}` placeholder.
  - Default used by scripts: `https://www.bible.com/reading-plans/13630-bibleproject-old-testament-in-a-year/day/{day}`.
- Extraction strategy in `extractReadings(html)`:
  - Prefer DOM refs near headings containing “Scripture” and anchors under containers with `/bible/` links.
  - Fallback selectors: `[data-test=readings], .readings, .reading-list, .plan-readings, #readings, pre code, code, pre`.
  - Final fallback: regex parse of body text; normalizes separators to `; ` and uses en dashes for ranges.
- Network: `fetchWithRetry` retries on 429/5xx/timeouts with exponential backoff + jitter; custom headers supported.
- CSV merge rules:
  - Reads existing CSV safely (handles BOM), trims, keeps header order, unions new columns, and writes atomically using a temp file.
  - Existing rows preserved unless updated; new keys appended and sorted when `sortNumeric` is true.

## NPM scripts and typical workflows
- Print first 10 scraped days without writing CSV:
  - `npm run scrape:print` (uses `PLAN_URL_TEMPLATE` env; outputs JSON to stdout)
- Populate or update the plan CSV:
  - `npm run plan:populate` (scrapes 1–365 using default template and merges into `old-testament-reading-plan.csv`)
  - `npm run plan:populate:range` (uses `START_DAY`, `END_DAY` env to control subset)

Examples (bash.exe):
- Set a custom template and preview days 1–10:
  - `PLAN_URL_TEMPLATE="https://example.com/day/{day}" npm run scrape:print`
- Update specific range (e.g., 120–150):
  - `START_DAY=120 END_DAY=150 npm run plan:populate:range`

## Extending or modifying
- Adding columns: include new keys in `updates` objects in `populate_plan.js`; `merge_csv` will append columns and keep order.
- Changing source site or structure: adjust `urlForDay` or pass a `baseUrlFn`; update `extractReadings` selectors first, then regex fallback only if needed.
- Concurrency: pass `CONCURRENCY` env to `populate_plan.js`, or `--concurrency K` when running `scrapePlan.js` directly.

## Debugging tips
- Scrape a single day to isolate issues:
  - `node scrapePlan.js --startDay 42 --endDay 42`
- Inspect HTML selectors by logging fetched HTML for a failing day in `scrapePlan.js` then iterating on `extractReadings`.
- Network or 429s: reduce `CONCURRENCY`, increase backoff via `baseDelayMs` in `fetchWithRetry` options, or set headers (e.g., a realistic User-Agent).

## Key files to read first
- `populate_plan.js` (end-to-end flow)
- `scrapePlan.js` (scraping and parsing logic)
- `scripts/merge_csv.js` (CSV merge contract)
- `old-testament-reading-plan.csv` (data shape and headers)
