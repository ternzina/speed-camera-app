const { withProjectBuildGradle, withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

// Navigation SDK contains the Google Maps classes. Substitute the standalone
// Maps artifact for every Android module (including react-native-maps) so the
// compile and runtime classpaths use the same implementation without duplicates.
module.exports = function withGoogleNavigation(config) {
  config = require('./withCamAlertLocale')(config);
  config = withGradleProperties(config, mod => {
    for (const [key, value] of [['newArchEnabled', 'true'], ['android.enableJetifier', 'true']]) {
      mod.modResults = mod.modResults.filter(item => item.key !== key);
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  config = withProjectBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Google Navigation requires a Groovy Android build configuration');
    if (!mod.modResults.contents.includes('// CamAlert Google Navigation')) {
      mod.modResults.contents += `
// CamAlert Google Navigation
allprojects {
  configurations.configureEach {
    resolutionStrategy.dependencySubstitution {
      substitute module('com.google.android.gms:play-services-maps') using module('com.google.android.libraries.navigation:navigation:7.6.1')
    }
  }
}
`;
    }
    return mod;
  });
  return withAppBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Google Navigation requires a Groovy app build configuration');
    if (!mod.modResults.contents.includes('// CamAlert navigation desugaring')) {
      mod.modResults.contents += `
// CamAlert navigation desugaring
android {
  compileOptions {
    coreLibraryDesugaringEnabled true
  }
}
dependencies {
  coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.0.4'
}
`;
    }
    return mod;
  });
};
