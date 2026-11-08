// Expo's Metro config already resolves a single app. `unstable_enablePackageExports`
// lets @expo/ui and the app's own imports resolve through their `exports` field.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
