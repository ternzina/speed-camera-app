const fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  babel = require("@babel/core");
const moduleUI = { exports: {} };
vm.runInNewContext(
  babel.transformSync(fs.readFileSync("product-presentation.js", "utf8"), {
    configFile: false,
    babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code,
  { module: moduleUI, exports: moduleUI.exports, Map, Date },
);
const ui = moduleUI.exports;
const points = [
  { id: 1, latitude: 50, longitude: 30, type: "speed_camera" },
  { id: 2, latitude: 50.00005, longitude: 30.00005, type: "red_light_camera" },
  { id: 3, latitude: 50.08, longitude: 30.07, type: "mobile_control" },
  { id: 4, latitude: 55, longitude: 35 },
];
const snapshot = JSON.stringify(points),
  region = {
    latitude: 50,
    longitude: 30,
    latitudeDelta: 0.2,
    longitudeDelta: 0.2,
  };
const clusters = ui.mapClusters(points, region);
assert.equal(
  clusters.reduce((n, c) => n + c.items.length, 0),
  3,
);
assert(clusters.some((c) => c.items.length === 2));
assert.equal(
  JSON.stringify(points),
  snapshot,
  "map grouping must not mutate warning engine data",
);
const zoomed = ui.mapClusters(points, {
  ...region,
  latitudeDelta: 0.0001,
  longitudeDelta: 0.0001,
});
assert(zoomed.every((c) => c.items.length === 1));
assert.equal(
  ui.datasetDate(null, "ru", ui.PRODUCT_COPY.ru),
  ui.PRODUCT_COPY.ru.unknownDate,
);
for (const lang of ["ru", "uk", "en", "pl"])
  assert(ui.PRODUCT_COPY[lang].report && ui.PRODUCT_COPY[lang].countries);
console.log(
  "Product presentation passed: local clustering, zoom separation, dataset immutability and honest date labels.",
);
