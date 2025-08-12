module.exports = function(eleventyConfig) {
  // Copy assets directory
  eleventyConfig.addPassthroughCopy("src/assets");
  
  // Configure directories
  return {
    dir: {
      input: "src",
      includes: "_includes",
      layouts: "_layouts", 
      data: "_data",
      output: "_site"
    },
    templateFormats: ["liquid", "md", "html"],
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
    dataTemplateEngine: "liquid"
  };
};