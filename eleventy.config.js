

export default function (eleventyConfig) {
  // Copy the contents of the `public` folder to the output folder
  // For example, `./public/css/` ends up in `_site/css/`
  eleventyConfig.addPassthroughCopy({
    "./public/": "/"
  });

  // Watch content images for the image pipeline.
  eleventyConfig.addWatchTarget("content/**/*.{svg,webp,png,jpeg}");
};

