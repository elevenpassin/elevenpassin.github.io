import * as DarkReader from "./darkreader.js";

DarkReader.setFetchMethod(window.fetch);

// Enable when the system color scheme is dark.
DarkReader.auto({
  brightness: 0,
  contrast: 50,
  sepia: 0,
  grayscale: 0
});
