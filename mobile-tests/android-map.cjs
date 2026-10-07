const fs = require("fs"),
  vm = require("vm"),
  babel = require("@babel/core"),
  assert = require("assert/strict");
const commands = [],
  callbacks = [],
  refs = [];
let imperative;
const React = {
  createElement: (type, props) => ({ type, props }),
  forwardRef: (fn) => fn,
  useRef: (value) => {
    const ref = {
      current:
        refs.length === 0
          ? { injectJavaScript: (js) => commands.push(js) }
          : value,
    };
    refs.push(ref);
    return ref;
  },
  useState: () => [true, () => {}],
  useEffect: (fn) => fn(),
  useImperativeHandle: (ref, fn) => {
    imperative = fn();
  },
  Children: { toArray: (children) => children },
};
function load(file) {
  const m = { exports: {} };
  const code = babel.transformSync(fs.readFileSync(file, "utf8"), {
    configFile: false,
    babelrc: false,
    plugins: [
      "@babel/plugin-transform-react-jsx",
      "@babel/plugin-transform-modules-commonjs",
    ],
  }).code;
  vm.runInNewContext(code, {
    module: m,
    exports: m.exports,
    Number,
    JSON,
    require: (name) =>
      name === "react"
        ? React
        : name === "react-native-webview"
          ? { WebView: "WebView" }
          : name === "react-native"
            ? { Linking: { openURL: () => {} } }
            : load(
                name.includes("leaflet-assets")
                  ? "map-vendor/leaflet-assets.js"
                  : "android-map-html.js",
              ),
  });
  return m.exports;
}
const map = load("map-surface.android.js");
const region = {
  latitude: 50,
  longitude: 30,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};
const tree = map.default(
  {
    initialRegion: region,
    userCoordinate: { latitude: 50, longitude: 30 },
    onRegionChangeComplete: (r) => callbacks.push(r),
    children: [
      {
        key: "cluster",
        props: {
          coordinate: { latitude: 50.01, longitude: 30.01 },
          title: "Камеры рядом",
          clusterCount: 5,
          mapIcon: "camera",
          onPress: () => callbacks.push("cluster"),
        },
      },
    ],
  },
  {},
);
assert.equal(tree.type, "WebView");
assert(commands.some((c) => c.includes('"count":5')));
const bridge = tree.props.onMessage;
bridge({
  nativeEvent: { data: JSON.stringify({ type: "marker", id: "cluster" }) },
});
assert(callbacks.includes("cluster"));
bridge({ nativeEvent: { data: JSON.stringify({ type: "region", region }) } });
assert.equal(callbacks.at(-1).latitude, 50);
bridge({ nativeEvent: { data: "invalid JSON" } });
bridge({
  nativeEvent: {
    data: JSON.stringify({ type: "region", region: { latitude: "bad" } }),
  },
});
assert.equal(callbacks.length, 2);
imperative.animateToRegion(region);
imperative.fitToCoordinates([{ latitude: 50, longitude: 30 }], {
  edgePadding: { top: 85, left: 55, right: 55, bottom: 180 },
});
assert(commands.some((c) => c.includes("camMap.region")));
assert(commands.some((c) => c.includes("camMap.fit")));
const html = tree.props.source.html;
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
  new vm.Script(match[1]);
assert(!html.includes("<script src="), "Map scripts must work without CDN");
assert(html.includes("OpenStreetMap contributors"));
console.log(
  "Android map passed: local assets, marker/viewport bridge, bad-message rejection, locate/fit commands and no Google Maps view requirement.",
);
