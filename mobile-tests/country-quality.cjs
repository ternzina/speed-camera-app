const fs = require("node:fs"),
  vm = require("node:vm"),
  babel = require("@babel/core"),
  assert = require("node:assert/strict");
function plain(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    babel.transformSync(fs.readFileSync(file, "utf8"), {
      configFile: false,
      babelrc: false,
      plugins: ["@babel/plugin-transform-modules-commonjs"],
    }).code,
    {
      module,
      exports: module.exports,
      require: (n) => plain(n.replace(/^\.\//, "") + ".js"),
      Set,
      Map,
      Date,
      fetch,
      AbortController,
      setTimeout,
      clearTimeout,
      Uint8Array,
      Uint32Array,
      DataView,
    },
  );
  return module.exports;
}
const delivery = plain("camera-delivery.js"),
  engine = plain("driver-engine.js"),
  countries = plain("countries.js"),
  geography = plain("geography.js");
(async () => {
  const manifest = delivery.validateManifest(
    await (
      await fetch(delivery.CAMERA_DELIVERY_URL + "/production/v1/manifest.json")
    ).json(),
  );
  const results = [],
    errors = [];
  for (let i = 0; i < manifest.countries.length; i += 4)
    await Promise.all(
      manifest.countries.slice(i, i + 4).map(async (entry) => {
        try {
          const response = await fetch(
            delivery.CAMERA_DELIVERY_URL + "/" + entry.path,
            { signal: AbortSignal.timeout(30000) },
          );
          assert(response.ok);
          const feed = delivery.verifyCountryExport(
            await response.text(),
            entry,
          );
          const usable = engine.drivingPoints(feed);
          results.push({
            code: entry.country_code,
            name: countries.countryName(entry.country_code, "ru"),
            published: entry.record_count,
            usableCameraRecords: engine.usableCameraRecordCount(feed),
            usableCameraPoints: usable.length,
            withLimit: usable.filter((p) => p.speed_limit > 0).length,
            exampleRecordsExcluded: JSON.stringify(feed).includes(
              '"_example_only":true',
            ),
            geographyLevel: geography.classifyGeography(entry).level,
            visible:
              geography.classifyGeography(entry).level === "country" &&
              (countries.CORE_COUNTRIES.includes(entry.country_code) ||
                engine.usableCameraRecordCount(feed) >=
                  countries.MIN_PUBLISHED_CAMERAS),
            version: entry.version,
          });
        } catch (e) {
          errors.push({ code: entry.country_code, error: e.message });
        }
      }),
    );
  results.sort((a, b) => a.code.localeCompare(b.code));
  const report = {
    checkedAt: new Date().toISOString(),
    manifestGeneratedAt: manifest.generated_at,
    datasets: manifest.countries.length,
    verified: results.length,
    minimumUsableCameraPoints: 300,
    results,
    errors,
  };
  fs.writeFileSync(
    "mobile-tests/country-quality-audit.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      datasets: report.datasets,
      verified: report.verified,
      errors,
    }),
  );
  assert.equal(errors.length, 0);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
