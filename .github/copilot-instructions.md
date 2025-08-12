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

# GitHub Copilot Instructions for Eleventy + Liquid

## Tech Stack Overview
This project uses Eleventy (11ty) as a static site generator with Liquid as the primary template language.

## Project Structure and Conventions

### Directory Structure
Use standard Eleventy conventions:
- `src/` for source files
- `_includes/` for layout templates and partials
- `_data/` for global data files
- `_site/` for built output (auto-generated)
- `eleventy.config.js` or `.eleventy.js` for configuration

### File Naming
- Use kebab-case for file names: `blog-post.liquid`, `author-bio.liquid`
- Template files should use `.liquid` extension
- Markdown content files should use `.md` extension with front matter
- Data files should be JSON, YAML, or JS in the `_data` directory

## Liquid Template Guidelines

### Template Syntax
- Use `{% %}` for logic (loops, conditionals, assignments)
- Use `{{ }}` for output/variables
- Use `{%- -%}` for whitespace control when needed
- Prefer semantic HTML5 elements

### Variable Naming
- Use snake_case for Liquid variables: `{{ page.title }}`, `{{ site.author_name }}`
- Use descriptive names that clearly indicate content type
- Follow Eleventy's built-in variable conventions (page, collections, etc.)

### Conditional Logic
```liquid
{% if condition %}
  <!-- content -->
{% elsif another_condition %}
  <!-- content -->
{% else %}
  <!-- fallback -->
{% endif %}
```

### Loops and Iteration
```liquid
{% for item in collections.posts %}
  <!-- item content -->
{% endfor %}

{% for item in collections.posts limit: 5 %}
  <!-- limited loop -->
{% endfor %}
```

### Filters
- Use built-in Liquid filters: `{{ content | strip_html }}`, `{{ date | date: "%Y-%m-%d" }}`
- Chain filters when appropriate: `{{ title | slugify | prepend: "/blog/" }}`
- Prefer Eleventy's custom filters when available

## Eleventy Best Practices

### Configuration
- Use `eleventy.config.js` for modern configuration
- Add custom filters, shortcodes, and transforms in the config file
- Set up proper input/output directories
- Configure template formats explicitly

### Collections
- Create meaningful collections using tags or custom functions
- Sort collections by date (descending for posts): `collections.posts.reverse()`
- Use collection data for navigation and related content

### Data Management
- Store site-wide data in `_data/` directory
- Use cascade for template-specific data
- Implement proper front matter structure
- Use computed data for dynamic values

### Performance
- Optimize images using Eleventy Image plugin
- Implement proper caching strategies
- Use incremental builds during development
- Minimize and bundle CSS/JS when appropriate

### SEO and Metadata
- Include proper meta tags in all layouts
- Implement structured data where appropriate
- Use semantic HTML and proper heading hierarchy
- Generate sitemap.xml and robots.txt

## Code Style and Formatting

### HTML/Liquid
- Use 2-space indentation
- Keep line length under 100 characters when possible
- Use double quotes for HTML attributes
- Add comments for complex logic blocks

### Front Matter
```yaml
---
title: "Page Title"
layout: layouts/base.liquid
date: 2024-01-01
tags:
  - blog
  - tech
permalink: "/custom-url/"
---
```

### Includes and Layouts
- Keep layouts modular and reusable
- Pass data to includes using parameters when needed
- Use descriptive names for include files
- Implement proper template inheritance

## Security and Best Practices

### Content Security
- Escape user content: `{{ user_content | escape }}`
- Validate and sanitize data inputs
- Use proper HTML encoding for special characters

### Accessibility
- Include proper alt text for images
- Use semantic HTML elements
- Implement proper focus management
- Add ARIA labels where necessary

### Error Handling
- Provide fallbacks for missing data
- Use default filters: `{{ title | default: "Untitled" }}`
- Handle empty collections gracefully
- Implement 404 pages

## Development Workflow

### Local Development
- Use `npx @11ty/eleventy --serve` for development server
- Enable hot reloading for efficient development
- Use `--incremental` flag for faster rebuilds

### Build Process
- Run `npx @11ty/eleventy` for production builds
- Optimize assets during build process
- Generate sitemap and other build-time assets
- Test builds before deployment

## Common Patterns

### Blog Post Template
```liquid
---
layout: layouts/post.liquid
---
{% assign post = collections.posts | where: "url", page.url | first %}

<article>
  <h1>{{ post.data.title }}</h1>
  <time datetime="{{ post.date | date: '%Y-%m-%d' }}">
    {{ post.date | date: "%B %d, %Y" }}
  </time>
  <div>
    {{ content }}
  </div>
</article>
```

### Navigation Component
```liquid
<nav>
  <ul>
    {% for item in collections.nav %}
      <li>
        <a href="{{ item.url }}"{% if item.url == page.url %} aria-current="page"{% endif %}>
          {{ item.data.title }}
        </a>
      </li>
    {% endfor %}
  </ul>
</nav>
```

### Pagination
```liquid
---
pagination:
  data: collections.posts
  size: 10
  alias: posts
---

{% for post in posts %}
  <!-- post summary -->
{% endfor %}

{% if pagination.href.previous %}
  <a href="{{ pagination.href.previous }}">← Previous</a>
{% endif %}

{% if pagination.href.next %}
  <a href="{{ pagination.href.next }}">Next →</a>
{% endif %}
```

## Plugin Recommendations

### Essential Plugins
- `@11ty/eleventy-plugin-rss` for RSS feeds
- `@11ty/eleventy-img` for image optimization
- `@11ty/eleventy-plugin-syntaxhighlight` for code highlighting
- `@11ty/eleventy-plugin-navigation` for breadcrumbs and menus

### Configuration Example
```javascript
// eleventy.config.js
module.exports = function(eleventyConfig) {
  // Add plugins
  eleventyConfig.addPlugin(require("@11ty/eleventy-plugin-rss"));
  eleventyConfig.addPlugin(require("@11ty/eleventy-img"));

  // Custom filters
  eleventyConfig.addFilter("dateToRfc3339", require("./src/_filters/date.js"));

  // Pass through files
  eleventyConfig.addPassthroughCopy("src/assets");

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    }
  };
};
```

## Troubleshooting Common Issues

### Template Errors
- Check for missing closing tags in Liquid syntax
- Verify variable names match data structure
- Use proper filter syntax and chaining

### Build Failures
- Ensure all referenced files exist
- Check for circular dependencies in includes
- Validate front matter YAML syntax

### Performance Issues
- Use pagination for large collections
- Optimize image sizes and formats
- Minimize template complexity in loops

Always prioritize clean, semantic HTML output and maintainable template structure. When in doubt, refer to the official Eleventy documentation and Liquid template language guides.