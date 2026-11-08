// Gives the debug build its own applicationId (`<package>.debug`), so a
// development APK, signed with the machine's debug key, installs next to the
// release APK signed with the repo's release key instead of failing with
// INSTALL_FAILED_UPDATE_INCOMPATIBLE. `pnpm android --dev` passes the suffixed
// package to adb when it launches the app.
//
// `expo prebuild --clean` rewrites build.gradle, so the suffix is set here.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// misuper: debug applicationId suffix";

module.exports = function withDebugAppId(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;

    // Only the buildTypes block starts at four spaces; signingConfigs' debug
    // block sits one level deeper and comes earlier.
    const pattern = /(\n {4}buildTypes \{\n {8}debug \{\n)/;
    const matches = gradle.match(new RegExp(pattern.source, "g")) ?? [];
    if (matches.length !== 1) {
      throw new Error(
        `debug-app-id: expected one buildTypes debug block in app/build.gradle, found ${matches.length}`,
      );
    }

    gradle = gradle.replace(
      pattern,
      `$1${MARK}\n            applicationIdSuffix '.debug'\n`,
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
