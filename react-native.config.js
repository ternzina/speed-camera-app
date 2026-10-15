module.exports = {
  dependencies: {
    // iOS keeps Apple Maps / external Google Maps until its own restricted key
    // and native Navigation configuration are supplied. Never reuse Android's key.
    '@googlemaps/react-native-navigation-sdk': { platforms: { ios: null } },
  },
};
