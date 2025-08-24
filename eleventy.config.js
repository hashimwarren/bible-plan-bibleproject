module.exports = function(eleventyConfig) {
  // Plugins (safe defaults; they don't change output unless used)
  // RSS plugin temporarily disabled due to version compatibility
  // try {
  //   eleventyConfig.addPlugin(require("@11ty/eleventy-plugin-rss"));
  // } catch {}
  try {
    eleventyConfig.addPlugin(require("@11ty/eleventy-plugin-syntaxhighlight"));
  } catch {}
  try {
    eleventyConfig.addPlugin(require("@11ty/eleventy-navigation"));
  } catch {}

  // Passthrough static assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/assets/app.js": "assets/app.js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/mobile-fallback.css": "assets/mobile-fallback.css" });
  eleventyConfig.addPassthroughCopy({ "src/sw.js": "sw.js" });

  // Simple filters
  eleventyConfig.addFilter("dateISO", (value) => {
    try {
      return new Date(value).toISOString();
    } catch {
      return new Date().toISOString();
    }
  });

  // Get current day of year (1-365/366)
  eleventyConfig.addFilter("currentDayOfYear", () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  });

  // Get current week of year (1-53)
  eleventyConfig.addFilter("currentWeekOfYear", () => {
    const dayOfYear = (() => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now - start;
      const oneDay = 1000 * 60 * 60 * 24;
      return Math.floor(diff / oneDay);
    })();
    return Math.ceil(dayOfYear / 7);
  });

  // Shortcodes
  try {
    const Image = require("@11ty/eleventy-img");
    eleventyConfig.addNunjucksAsyncShortcode("image", async (src, alt, sizes = "100vw") => {
      const metadata = await Image(src, {
        widths: [320, 640, 960, 1280],
        formats: ["avif", "webp", "jpeg"],
        urlPath: "/assets/img/",
        outputDir: "_site/assets/img/",
      });
      const imageAttributes = { alt, sizes, loading: "lazy", decoding: "async" };
      return Image.generateHTML(metadata, imageAttributes);
    });
  } catch {}

  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
      output: "_site",
    },
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid",
    templateFormats: ["liquid", "md", "njk"],
    pathPrefix: "/",
  };
};
