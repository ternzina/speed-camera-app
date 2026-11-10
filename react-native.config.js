// The iOS Navigation SDK is a separate link test. It stays out of the normal
// pod install unless CAMALERT_IOS_GOOGLE_NAV_TEST=1. Never reuse the Android key.
const iosGoogleNavTest = process.env.CAMALERT_IOS_GOOGLE_NAV_TEST === '1';

module.exports = {
  dependencies: iosGoogleNavTest ? {} : {
    '@googlemaps/react-native-navigation-sdk': { platforms: { ios: null } },
  },
};
