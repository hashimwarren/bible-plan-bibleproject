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

  return { days, scriptureIndex };
};
