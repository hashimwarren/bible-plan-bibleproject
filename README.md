# BibleProject Reading Plan

A beautiful Eleventy static site for the BibleProject Old Testament and New Testament reading plans, featuring scripture search, day browsing, and embedded YouTube videos.

## Features

- **Daily Reading Plans**: Complete 365-day BibleProject reading plan combining both Old and New Testament
- **Scripture Search**: Quick search to find specific scripture references and jump to their day
- **Video Integration**: Embedded YouTube videos from BibleProject for enhanced learning
- **Easy Navigation**: Browse between days with previous/next navigation
- **Responsive Design**: Clean, mobile-friendly interface
- **Direct Bible Links**: Quick links to read scriptures on Bible.com

## Prerequisites

- Node.js LTS (18+ recommended)
- npm

## Quickstart

1. **Generate or update combined CSV** (optional - already included):
   ```bash
   npm run build:combined
   ```

2. **Start development server**:
   ```bash
   npm run site:dev
   ```
   Site will be available at http://localhost:8080

3. **Build for production**:
   ```bash
   npm run site:build
   ```
   Static files will be generated in `_site/` directory

## Available Scripts

### Data Generation
- `npm run build:combined` - Generate combined reading plan CSV with videos
- `npm run plan:populate` - Scrape Old Testament readings
- `npm run nt:populate` - Scrape New Testament readings

### Site Development
- `npm run site:dev` - Start Eleventy development server with live reload
- `npm run site:build` - Build static site for production

## Project Structure

```
├── src/
│   ├── _data/
│   │   └── plan.js           # CSV data loader and scripture index
│   ├── _layouts/
│   │   └── base.liquid       # Main site layout
│   ├── assets/
│   │   └── app.js           # Client-side JavaScript
│   ├── index.liquid         # Homepage with search and day grid
│   └── day.liquid           # Individual day page template
├── combined-reading-plan-with-videos.csv  # Source data
├── .eleventy.js             # Eleventy configuration
└── package.json
```

## How It Works

1. **Data Loading**: `src/_data/plan.js` reads the combined CSV and creates:
   - An array of 365 day objects with readings and videos
   - A scripture index for search functionality
   - Normalizes YouTube URLs for embedding

2. **Pages**: 
   - Homepage displays all days in a grid with search
   - Each day gets its own page at `/day/{n}/`
   - Pagination automatically generates 365 day pages

3. **Search**: Client-side JavaScript enables instant scripture lookup using the pre-built index

4. **Videos**: YouTube URLs are normalized to embeddable format and displayed as responsive iframes

## Data Format

The site uses `combined-reading-plan-with-videos.csv` with columns:
- `Day` - Day number (1-365)
- `OT_Scripture_Readings` - Old Testament readings (semicolon-separated)
- `NT_Scripture_Readings` - New Testament readings (semicolon-separated)  
- `OT_URL` - Link to OT reading on Bible.com
- `NT_URL` - Link to NT reading on Bible.com
- `Video_URLs` - YouTube video URLs (pipe-separated)

## Browser Support

Modern browsers with ES6+ support. Features graceful degradation for older browsers.

## License

ISC