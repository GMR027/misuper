// Signs the release APK with Mi Súper's own key instead of the template's
// public debug key, so an update installs over an install someone already
// has. The key lives outside the repo: the keystore at
// ~/.android/misuper-mobile-release.jks and its four properties in
// ~/.gradle/gradle.properties. `cli/release-key.sh` creates both.
//
// Without them a release build stops with an error rather than fall back to
// the debug key; debug builds are unaffected. `expo prebuild --clean`
// rewrites build.gradle, so the signing is set here.
const { withAppBuildGradle } = require("expo/config-plugins");

const MARK = "// misuper: release signing";

const PRELUDE = `${MARK}
def releaseStoreFile = findProperty('MISUPER_MOBILE_RELEASE_STORE_FILE')
def releaseSigning = releaseStoreFile != null && file(releaseStoreFile).exists()
gradle.taskGraph.whenReady { graph ->
    def release = graph.allTasks.any { it.path.startsWith(':app:') && it.name.contains('Release') }
    if (release && !releaseSigning) {
        throw new GradleException(
            "Mi Super: no release key. Run cli/release-key.sh (or pnpm android) to create " +
            "~/.android/misuper-mobile-release.jks and the MISUPER_MOBILE_RELEASE_* " +
            "properties in ~/.gradle/gradle.properties.")
    }
}

android {`;

const RELEASE_CONFIG = `
        release {
            if (releaseSigning) {
                storeFile file(releaseStoreFile)
                storePassword findProperty('MISUPER_MOBILE_RELEASE_STORE_PASSWORD')
                keyAlias findProperty('MISUPER_MOBILE_RELEASE_KEY_ALIAS')
                keyPassword findProperty('MISUPER_MOBILE_RELEASE_KEY_PASSWORD')
            }
        }
    }
    buildTypes {`;

// Each edit must match the template exactly once; a template change fails the
// prebuild here instead of shipping a debug-signed APK.
function replaceOnce(src, pattern, replacement, what) {
  const matches =
    src.match(new RegExp(pattern.source, `${pattern.flags}g`)) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `release-signing: expected one ${what} in app/build.gradle, found ${matches.length}`,
    );
  }
  return src.replace(pattern, replacement);
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes(MARK)) return cfg;
    gradle = replaceOnce(gradle, /^android \{/m, PRELUDE, "`android {`");
    gradle = replaceOnce(
      gradle,
      /\n {4}\}\n {4}buildTypes \{/,
      RELEASE_CONFIG,
      "end of signingConfigs",
    );
    gradle = replaceOnce(
      gradle,
      /(\n {8}release \{\n)(?: *\/\/.*\n)*( *)signingConfig signingConfigs\.debug/,
      "$1$2signingConfig signingConfigs.release",
      "release buildType signed with the debug key",
    );
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
