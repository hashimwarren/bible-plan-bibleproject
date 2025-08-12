// scripts/merge_csv.js
// Node.js module to read an existing CSV, merge/overwrite rows by a key column (default: "Day"),
// then write back atomically using a temporary file and fs-extra.move.
//
// Dependencies expected:
//   npm i csv-parse csv-stringify fs-extra
//
// Usage example:
//   const { mergeCsvByKey } = require('./scripts/merge_csv');
//   await mergeCsvByKey('data/readings.csv', [
//     { Day: '2025-08-12', Readings: '42' },
//     { Day: '2025-08-13', Readings: '37', Notes: 'partial' },
//   ]);

const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');

/**
 * Read a CSV file if it exists. Returns { rows, header } where rows are array of objects.
 * If file is missing or empty, returns { rows: [], header: null }.
 * @param {string} csvPath
 * @returns {Promise<{ rows: Array<Record<string,string>>, header: string[] | null }>}
 */
async function readCsv(csvPath) {
  if (!fs.existsSync(csvPath)) {
    return { rows: [], header: null };
  }
  let content = await fse.readFile(csvPath, 'utf8');
  // Strip BOM if present
  content = content.replace(/^\uFEFF/, '');
  if (!content.trim()) {
    return { rows: [], header: null };
  }
  return new Promise((resolve, reject) => {
    const rows = [];
    let header = null;
    const parser = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null) {
        // Normalize BOM from keys (e.g., '\uFEFFDay' -> 'Day') and merge duplicates favoring non-empty values
        const normalized = {};
        for (const [k, vRaw] of Object.entries(record)) {
          const nk = k.replace(/^\uFEFF/, '');
          const v = typeof vRaw === 'string' ? vRaw.trim() : vRaw;
          if (Object.prototype.hasOwnProperty.call(normalized, nk)) {
            const existing = normalized[nk];
            const existingStr = typeof existing === 'string' ? existing.trim() : existing;
            // Prefer non-empty value
            if ((existingStr == null || existingStr === '') && (v != null && v !== '')) {
              normalized[nk] = v;
            }
            // else keep existing non-empty
          } else {
            normalized[nk] = v;
          }
        }
        rows.push(normalized);
      }
    });
    parser.on('error', reject);
    parser.on('end', () => {
      // Determine header from the first line of the file rather than union of keys
      // by reparsing with columns: false to capture header order if needed.
      parse(content.split(/\r?\n/)[0], { columns: false }, (err, records) => {
        if (err) {
          // Fallback: infer from first row keys
          header = rows.length ? Object.keys(rows[0]) : null;
          return resolve({ rows, header });
        }
        const firstRow = records && records[0];
        header = Array.isArray(firstRow) ? firstRow : rows.length ? Object.keys(rows[0]) : null;
        if (Array.isArray(header)) {
          header = header.map((h) => String(h).replace(/^\uFEFF/, '').trim());
        }
        resolve({ rows, header });
      });
    });
  });
}

/**
 * Determine output header as union of existing header and updates' keys.
 * Keeps keyColumn first, then preserves existing header order, then appends any new keys from updates.
 * @param {string[] | null} existingHeader
 * @param {Array<Record<string, any>>} updates
 * @param {string} keyColumn
 * @returns {string[]}
 */
function buildOutputHeader(existingHeader, updates, keyColumn) {
  const updateKeys = new Set();
  for (const row of updates || []) {
    Object.keys(row).forEach(k => updateKeys.add(k));
  }
  // Ensure keyColumn is present
  updateKeys.add(keyColumn);

  const header = [];

  // Start with keyColumn
  header.push(keyColumn);

  // Add existing header (excluding duplicates and keyColumn)
  if (Array.isArray(existingHeader)) {
    for (const h of existingHeader) {
      if (h === keyColumn) continue;
      if (!header.includes(h)) header.push(h);
      updateKeys.delete(h);
    }
  }

  // Append any remaining keys from updates excluding keyColumn and any already present
  for (const k of updateKeys) {
    if (k === keyColumn) continue;
    if (!header.includes(k)) header.push(k);
  }

  return header;
}

/**
 * Merge updates into existing rows by key column. Overwrites fields provided by updates,
 * preserves other columns, and adds new rows for missing keys.
 * @param {Array<Record<string, any>>} existingRows
 * @param {Array<Record<string, any>>} updates
 * @param {string} keyColumn
 * @returns {Array<Record<string, any>>}
 */
function mergeRowsByKey(existingRows, updates, keyColumn) {
  const byKey = new Map();
  for (const r of existingRows) {
    const keyVal = r[keyColumn];
    if (keyVal == null || String(keyVal).trim() === '') continue;
    byKey.set(String(keyVal), { ...r });
  }
  for (const u of updates || []) {
    const key = u[keyColumn];
    if (key == null || String(key).trim() === '') continue; // skip updates without a key
    const keyStr = String(key);
    const existing = byKey.get(keyStr) || {};
    byKey.set(keyStr, { ...existing, ...u, [keyColumn]: keyStr });
  }
  // Preserve original order for existing rows, then append any new keys not originally present, sorted by key for stability
  const originalKeys = existingRows
    .map(r => r[keyColumn] != null ? String(r[keyColumn]) : null)
    .filter(k => k != null && k !== '');
  const allKeys = new Set(byKey.keys());
  const result = [];
  for (const k of originalKeys) {
    if (byKey.has(k)) result.push(byKey.get(k));
    allKeys.delete(k);
  }
  const newKeys = Array.from(allKeys).sort();
  for (const k of newKeys) {
    result.push(byKey.get(k));
  }
  return result;
}

/**
 * Write rows to CSV at path by first writing to a temp file in the same directory and moving over the original.
 * @param {string} csvPath
 * @param {Array<Record<string, any>>} rows
 * @param {string[]} header
 * @returns {Promise<void>}
 */
async function atomicWriteCsv(csvPath, rows, header) {
  const dir = path.dirname(csvPath);
  await fse.ensureDir(dir);
  const tmpPath = path.join(dir, `${path.basename(csvPath)}.tmp-${process.pid}-${Date.now()}`);

  await new Promise((resolve, reject) => {
    const writable = fs.createWriteStream(tmpPath, { encoding: 'utf8' });
    const stringifier = stringify({ header: true, columns: header });
    stringifier.on('error', reject);
    writable.on('error', reject);
    writable.on('finish', resolve);

    stringifier.pipe(writable);
    for (const row of rows) {
      // Ensure all columns exist in row with empty string fallback
      const normalized = {};
      for (const col of header) {
        const v = row[col];
        normalized[col] = v == null ? '' : String(v);
      }
      stringifier.write(normalized);
    }
    stringifier.end();
  });

  // Atomic replace
  await fse.move(tmpPath, csvPath, { overwrite: true });
}

/**
 * High-level function to merge updates into a CSV by key column and write back.
 * @param {string} csvPath
 * @param {Array<Record<string, any>>} updates - Objects containing at least keyColumn (default: Day)
 * @param {{ keyColumn?: string, sortNumeric?: boolean }} [options]
 */
async function mergeCsvByKey(csvPath, updates, options = {}) {
  const keyColumn = options.keyColumn || 'Day';
  const sortNumeric = options.sortNumeric || false;
  const { rows: existingRows, header: existingHeader } = await readCsv(csvPath);
  const header = buildOutputHeader(existingHeader, updates, keyColumn);
  let merged = mergeRowsByKey(existingRows, updates, keyColumn);
  if (sortNumeric) {
    const isNum = (v) => v != null && v !== '' && !Number.isNaN(Number(v));
    merged = merged.slice().sort((a, b) => {
      const av = a[keyColumn];
      const bv = b[keyColumn];
      const aNum = isNum(av);
      const bNum = isNum(bv);
      if (aNum && bNum) return Number(av) - Number(bv);
      if (aNum) return -1;
      if (bNum) return 1;
      return String(av).localeCompare(String(bv));
    });
  }
  await atomicWriteCsv(csvPath, merged, header);
}

module.exports = {
  readCsv,
  buildOutputHeader,
  mergeRowsByKey,
  atomicWriteCsv,
  mergeCsvByKey,
};

