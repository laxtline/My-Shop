const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The @shared alias in tsconfig points outside this app's project root.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, "../shared")];

module.exports = config;
