"use strict";

// Populate the New Testament reading plan CSV by scraping Bible.com with the NT URL pattern

const path = require("path");
const { scrapePlan } = require("./scrapePlan");
const { mergeCsvByKey } = require("./scripts/merge_csv");

async function run() {
  // Default to BibleProject NT plan URL template; can override via env
  const PLAN_URL_TEMPLATE =
    process.env.PLAN_URL_TEMPLATE ||
    "https://www.bible.com/reading-plans/13233-bibleproject-new-testament-in-one-year/day/{day}";

  const startDay = parseInt(process.env.START_DAY || "1", 10);
  const endDay = parseInt(process.env.END_DAY || "365", 10);
  const concurrency = parseInt(process.env.CONCURRENCY || "6", 10);

  const results = await scrapePlan(startDay, endDay, {
    concurrency,
    baseUrlFn: (day) => PLAN_URL_TEMPLATE.replace("{day}", String(day)),
  });

  // Transform to CSV merge format
  const updates = results.map(({ day, readings }) => ({
    Day: String(day),
    Scripture_Readings: readings,
    URL: PLAN_URL_TEMPLATE.replace("{day}", String(day)),
  }));

  const csvPath = path.resolve(__dirname, "new-testament-reading-plan.csv");
  await mergeCsvByKey(csvPath, updates, { keyColumn: "Day", sortNumeric: true });
  console.log(
    `Updated ${csvPath} with ${updates.length} rows (days ${startDay}\u2013${endDay}).`
  );
}

if (require.main === module) {
  run().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

module.exports = { run };
