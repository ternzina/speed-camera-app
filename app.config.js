// Supplied by the selected EAS environment, never stored in source control.
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !key) {
    throw new Error('GOOGLE_MAPS_ANDROID_API_KEY is required for Android builds');
  }
  return {
    ...config,
    plugins: [
      ...(config.plugins || []).filter(plugin =>
        (Array.isArray(plugin) ? plugin[0] : plugin) !== 'react-native-maps'),
      ['react-native-maps', { androidGoogleMapsApiKey: key }],
      './plugins/withGoogleNavigation',
    ],
  };
};
