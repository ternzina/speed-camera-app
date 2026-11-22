const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Watchman cannot open this project while it lives in Documents.
// Metro then retries through a crawl that times out. The node file index is enough.
config.resolver.useWatchman = false;

module.exports = config;
