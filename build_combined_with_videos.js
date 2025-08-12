"use strict";

// Build a combined OT + NT CSV with columns: Day, OT_Scripture_Readings, NT_Scripture_Readings, OT_URL, NT_URL, Video_URLs

const path = require("path");
const { scrapePlan } = require("./scrapePlan");
const { mergeCsvByKey } = require("./scripts/merge_csv");

async function run() {
  const startDay = parseInt(process.env.START_DAY || "1", 10);
  const endDay = parseInt(process.env.END_DAY || "365", 10);
  const concurrency = parseInt(process.env.CONCURRENCY || "6", 10);

  const OT_TEMPLATE =
    process.env.OT_PLAN_URL_TEMPLATE ||
    "https://www.bible.com/reading-plans/13630-bibleproject-old-testament-in-a-year/day/{day}";
  const NT_TEMPLATE =
    process.env.NT_PLAN_URL_TEMPLATE ||
    "https://www.bible.com/reading-plans/13233-bibleproject-new-testament-in-one-year/day/{day}";

  // Scrape OT and NT ranges
  const [ot, nt] = await Promise.all([
    scrapePlan(startDay, endDay, {
      concurrency,
      baseUrlFn: (day) => OT_TEMPLATE.replace("{day}", String(day)),
    }),
    scrapePlan(startDay, endDay, {
      concurrency,
      baseUrlFn: (day) => NT_TEMPLATE.replace("{day}", String(day)),
    }),
  ]);

  // Index by day
  const byDayOT = new Map(ot.map((r) => [r.day, r]));
  const byDayNT = new Map(nt.map((r) => [r.day, r]));

  const updates = [];
  for (let day = startDay; day <= endDay; day++) {
    const o = byDayOT.get(day);
    const n = byDayNT.get(day);
    // Build videos union for the day (some days may have none)
    const videoSet = new Set();
    if (o?.videos) o.videos.forEach((v) => v && videoSet.add(v));
    if (n?.videos) n.videos.forEach((v) => v && videoSet.add(v));
    const Video_URLs = Array.from(videoSet).join(" | ");

    updates.push({
      Day: String(day),
      OT_Scripture_Readings: o ? o.readings : "",
      NT_Scripture_Readings: n ? n.readings : "",
      OT_URL: OT_TEMPLATE.replace("{day}", String(day)),
      NT_URL: NT_TEMPLATE.replace("{day}", String(day)),
      Video_URLs,
    });
  }

  const outPath = path.resolve(__dirname, "combined-reading-plan-with-videos.csv");
  await mergeCsvByKey(outPath, updates, { keyColumn: "Day", sortNumeric: true });
  console.log(
    `Wrote ${outPath} with ${updates.length} rows (days ${startDay}\u2013${endDay}).`
  );
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

module.exports = { run };
