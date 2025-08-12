const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Utility to normalize YouTube URLs to embeddable form
function normalizeYouTubeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  
  // Already in embed form
  if (url.includes('/embed/')) {
    return url;
  }
  
  // Extract video ID and time parameter if present
  let videoId = '';
  let timeParam = '';
  
  // Standard watch URL: https://www.youtube.com/watch?v=ID&t=123s
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) {
    videoId = watchMatch[1];
    const timeMatch = url.match(/[?&]t=([^&]+)/);
    if (timeMatch) {
      timeParam = `?start=${timeMatch[1].replace('s', '')}`;
    }
  }
  
  // Short URL: https://youtu.be/ID?t=123
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) {
    videoId = shortMatch[1];
    const timeMatch = url.match(/[?&]t=([^&]+)/);
    if (timeMatch) {
      timeParam = `?start=${timeMatch[1]}`;
    }
  }
  
  // Shorts URL: https://www.youtube.com/shorts/ID
  const shortsMatch = url.match(/\/shorts\/([^?]+)/);
  if (shortsMatch) {
    videoId = shortsMatch[1];
  }
  
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}${timeParam}`;
  }
  
  return url; // Return original if we can't parse it
}

// Read and parse the CSV file
const csvPath = path.join(__dirname, '../../combined-reading-plan-with-videos.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true
});

// Process the data
const days = records.map(record => {
  const day = parseInt(record.Day, 10);
  
  // Split scripture readings on semicolon and trim
  const otReadings = record.OT_Scripture_Readings 
    ? record.OT_Scripture_Readings.split(';').map(s => s.trim()).filter(s => s)
    : [];
  const ntReadings = record.NT_Scripture_Readings 
    ? record.NT_Scripture_Readings.split(';').map(s => s.trim()).filter(s => s)
    : [];
  
  // Split video URLs on pipe and normalize
  const videos = record.Video_URLs 
    ? record.Video_URLs.split('|').map(url => normalizeYouTubeUrl(url.trim())).filter(url => url)
    : [];
  
  return {
    day,
    otReadings,
    ntReadings,
    otUrl: record.OT_URL || '',
    ntUrl: record.NT_URL || '',
    videos
  };
}).sort((a, b) => a.day - b.day);

// Build scripture index
const scriptureIndex = [];
const seenRefs = new Set();

days.forEach(dayData => {
  // Add OT readings
  dayData.otReadings.forEach(ref => {
    const key = `${ref}:${dayData.day}`;
    if (!seenRefs.has(key)) {
      scriptureIndex.push({ ref, day: dayData.day });
      seenRefs.add(key);
    }
  });
  
  // Add NT readings
  dayData.ntReadings.forEach(ref => {
    const key = `${ref}:${dayData.day}`;
    if (!seenRefs.has(key)) {
      scriptureIndex.push({ ref, day: dayData.day });
      seenRefs.add(key);
    }
  });
});

// Sort scripture index by reference then by day
scriptureIndex.sort((a, b) => {
  if (a.ref !== b.ref) {
    return a.ref.localeCompare(b.ref);
  }
  return a.day - b.day;
});

module.exports = {
  days,
  scriptureIndex
};