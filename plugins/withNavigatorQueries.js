const { withAndroidManifest } = require("@expo/config-plugins");

const SCHEMES = ["google.navigation", "comgooglemaps"];

module.exports = function withNavigatorQueries(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.queries = manifest.queries || [];
    const queries = manifest.queries;
    const base = queries[0] || {};
    const intents = queries.flatMap(query => query.intent || []);
    const packages = queries.flatMap(query => query.package || []);
    const existing = new Set(intents.flatMap(intent =>
      (intent.data || []).map(data => data.$?.["android:scheme"])
    ));
    for (const scheme of SCHEMES) {
      if (existing.has(scheme)) continue;
      intents.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        data: [{ $: { "android:scheme": scheme } }],
      });
    }
    manifest.queries = [{ ...base, ...(intents.length ? { intent: intents } : {}), ...(packages.length ? { package: packages } : {}) }];
    return mod;
  });
};
