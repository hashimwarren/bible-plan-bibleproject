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

  // Simple filters
  eleventyConfig.addFilter("dateISO", (value) => {
    try {
      return new Date(value).toISOString();
    } catch {
      return new Date().toISOString();
    }
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
