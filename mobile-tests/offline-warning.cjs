const fs = require("node:fs"),
  fsp = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  vm = require("node:vm"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  babel = require("@babel/core");
const root = path.resolve(__dirname, "..");
let networkBlocked = false,
  networkRequests = 0;
const guardedFetch = (...args) => {
  if (networkBlocked) {
    networkRequests++;
    throw Error("Airplane mode: no network");
  }
  return fetch(...args);
};
function plain(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    babel.transformSync(fs.readFileSync(path.join(root, file), "utf8"), {
      configFile: false,
      babelrc: false,
      plugins: ["@babel/plugin-transform-modules-commonjs"],
    }).code,
    {
      module,
      exports: module.exports,
      require: (name) => plain(name.replace(/^\.\//, "") + ".js"),
      fetch: guardedFetch,
      AbortController,
      setTimeout,
      clearTimeout,
      Uint8Array,
      Uint32Array,
      DataView,
      Set,
      Map,
      Date,
      console,
    },
  );
  return module.exports;
}
const delivery = plain("camera-delivery.js"),
  cache = plain("camera-data.js"),
  engine = plain("driver-engine.js");
function diskStorage(dir) {
  let reads = 0;
  const file = (key) =>
    path.join(dir, crypto.createHash("sha256").update(key).digest("hex"));
  return {
    get reads() {
      return reads;
    },
    getItem: async (key) => {
      reads++;
      try {
        return await fsp.readFile(file(key), "utf8");
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    setItem: (key, value) => fsp.writeFile(file(key), value),
    removeItem: async (key) => {
      try {
        await fsp.unlink(file(key));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
    },
  };
}
function loadBackgroundTask(storage, notifications, settings, feeds) {
  let task, gpsCallback;
  const spoken = [];
  let stateIndex = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: (value) => {
      const i = stateIndex++;
      return [i === 0 ? settings : i === 12 ? feeds : value, () => {}];
    },
    useRef: (value) => ({ current: value }),
    useMemo: (fn) => fn(),
    useEffect: () => {},
  };
  const noop = () => {};
  const stubs = {
    react: React,
    "react-native": {
      StyleSheet: { create: (v) => v },
      Alert: { alert: noop },
      Vibration: { vibrate: noop },
    },
    "expo-location": {
      Accuracy: { BestForNavigation: 1 },
      requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
      watchPositionAsync: async (options, callback) => {
        gpsCallback = callback;
        return { remove: noop };
      },
    },
    "expo-speech": { speak: (text) => spoken.push(text), stop: noop },
    "expo-task-manager": {
      defineTask: (name, callback) => {
        task = callback;
      },
    },
    "expo-notifications": {
      setNotificationHandler: noop,
      scheduleNotificationAsync: async (item) => notifications.push(item),
    },
    "expo-haptics": {},
    "@react-native-async-storage/async-storage": storage,
    "react-native-maps": {},
    "expo-status-bar": {},
  };
  const module = { exports: {} };
  const code = babel.transformSync(
    fs.readFileSync(path.join(root, "App.js"), "utf8"),
    {
      configFile: false,
      babelrc: false,
      plugins: [
        "@babel/plugin-transform-react-jsx",
        "@babel/plugin-transform-modules-commonjs",
      ],
    },
  ).code;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) =>
      name in stubs
        ? stubs[name]
        : name.endsWith(".json")
          ? JSON.parse(fs.readFileSync(path.join(root, name), "utf8"))
          : plain(name.slice(2) + ".js"),
    Set,
    Map,
    Date,
    console,
    setInterval,
    clearInterval,
    fetch: guardedFetch,
  });
  assert.equal(typeof task, "function");
  const tree = module.exports.default();
  function findStart(node) {
    if (!node || typeof node !== "object") return null;
    if (
      node.props?.onPress &&
      node.children?.some((c) => c?.children?.includes("Начать поездку"))
    )
      return node.props.onPress;
    for (const c of node.children || [])
      for (const child of Array.isArray(c) ? c : [c]) {
        const found = findStart(child);
        if (found) return found;
      }
    return null;
  }
  return {
    task,
    spoken,
    start: findStart(tree),
    gps: (pos) => gpsCallback(pos),
    get networkRequests() {
      return networkRequests;
    },
  };
}
(async () => {
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "camalert-offline-warning-"),
  );
  try {
    const storage = diskStorage(dir),
      feeds = {},
      versions = {};
    const manifest = delivery.validateManifest(
      await (
        await fetch(
          delivery.CAMERA_DELIVERY_URL + "/production/v1/manifest.json",
        )
      ).json(),
    );
    for (const code of ["UA", "PL", "DE", "FR", "US", "CA"]) {
      const entry = manifest.countries.find((e) => e.country_code === code);
      assert.ok(entry);
      feeds[code] = delivery.verifyCountryExport(
        await (
          await fetch(delivery.CAMERA_DELIVERY_URL + "/" + entry.path)
        ).text(),
        entry,
      );
      versions[code] = entry.version;
    }
    await cache.saveCameraCache(storage, "camera_remote_cache_v081", {
      feeds,
      countries: manifest.countries,
      countryVersions: versions,
      stamp: "offline-test",
    });
    networkBlocked = true;
    const restarted = diskStorage(dir);
    const loaded = await cache.loadCameraCache(
      restarted,
      "camera_remote_cache_v081",
    );
    assert.equal(Object.keys(loaded.feeds).length, 6);
    assert.ok(restarted.reads > 6);
    const results = [];
    for (const code of Object.keys(loaded.feeds)) {
      await restarted.setItem(
        "camera_settings_v060",
        JSON.stringify({
          country: code.toLowerCase(),
          language: "ru",
          voice: true,
          smartDistance: true,
          cityDistance: 500,
          roadDistance: 800,
          highwayDistance: 1000,
          fastDistance: 1500,
        }),
      );
      await restarted.setItem("camera_hidden_v060", "[]");
      const point = cache
        .cameraPoints(loaded.feeds[code])
        .find((p) => !p._example_only);
      assert.ok(point);
      const heading =
        point.direction != null && /^\d+(\.\d+)?$/.test(String(point.direction))
          ? Number(point.direction)
          : 0;
      const radians = (heading * Math.PI) / 180;
      const latitude = point.latitude - (80 / 111320) * Math.cos(radians),
        longitude =
          point.longitude -
          (80 / (111320 * Math.cos((point.latitude * Math.PI) / 180))) *
            Math.sin(radians);
      const foreground = engine.nearestDrivingPoint(
        engine.drivingPoints(loaded.feeds[code]),
        { latitude, longitude },
        heading,
      );
      assert.ok(
        foreground && foreground.distance <= 500,
        code + " foreground warning selection",
      );
      const warning = engine.warningDecision(null, foreground, 54, {}, 100000);
      assert.ok(warning.event);
      assert.ok(
        engine.warningPhrase(foreground, warning.event, warning.over, "ru"),
      );
      const notifications = [],
        running = loadBackgroundTask(
          restarted,
          notifications,
          {
            country: code.toLowerCase(),
            language: "ru",
            voice: true,
            vibration: false,
            smartDistance: true,
          },
          loaded.feeds,
        );
      assert.equal(typeof running.start, "function");
      await running.start();
      running.gps({
        timestamp: 100000,
        coords: { latitude, longitude, speed: 15, heading, accuracy: 5 },
      });
      assert.equal(
        running.spoken.length,
        1,
        code + " actual foreground GPS callback must speak offline",
      );
      for (let i = 0; i < 10; i++)
        running.gps({
          timestamp: 101000 + i * 1000,
          coords: { latitude, longitude, speed: 15, heading, accuracy: 5 },
        });
      assert.equal(
        running.spoken.length,
        1,
        code + " repeated GPS callbacks must not repeat speech",
      );
      await running.task({
        data: {
          locations: [{ coords: { latitude, longitude, speed: 15, heading } }],
        },
      });
      assert.equal(running.networkRequests, 0);
      assert.equal(
        notifications.length,
        1,
        code + " must warn from persisted dataset",
      );
      assert.ok(notifications[0].content.title.includes("Камера"));
      results.push({
        country: code,
        backgroundWarningFromDiskCache: true,
        foregroundSelection: "actual App GPS callback passed",
        localVoicePhrase: true,
        foregroundSpeechCalls: running.spoken.length,
        networkRequests: running.networkRequests,
      });
    }
    const section = loaded.feeds.PL.average_speed_sections.find(
      (s) => !s._example_only,
    );
    assert.ok(section);
    const sectionHeading = engine.bearingBetween(section.start, section.end);
    const entered = engine.advanceAverageTrip(
      null,
      loaded.feeds.PL,
      section.start,
      sectionHeading,
      100000,
    );
    assert.ok(entered.trip);
    assert.equal(
      engine.advanceAverageTrip(
        entered.trip,
        loaded.feeds.PL,
        section.end,
        sectionHeading,
        100001,
      ).event,
      "lost",
    ); // Impossible GPS jump is rejected rather than generating an invented average.
    const steps = Math.ceil(
      engine.distanceBetween(section.start, section.end) / 100,
    );
    let cachedTrip = entered.trip,
      finishedSection = false;
    for (let step = 1; step <= steps; step++) {
      const fraction = step / steps;
      const position = {
        latitude:
          section.start.latitude +
          (section.end.latitude - section.start.latitude) * fraction,
        longitude:
          section.start.longitude +
          (section.end.longitude - section.start.longitude) * fraction,
      };
      const progress = engine.advanceAverageTrip(
        cachedTrip,
        loaded.feeds.PL,
        position,
        sectionHeading,
        100000 + step * 10000,
        5,
      );
      if (progress.event === "ending") {
        assert.equal(progress.trip, null);
        finishedSection = true;
        break;
      }
      assert.ok(
        progress.trip &&
          progress.trip.average > 20 &&
          progress.trip.average <= 37,
      );
      cachedTrip = progress.trip;
    }
    assert.ok(
      finishedSection,
      "cached Polish section resets at its actual end gate without network",
    );
    const report = {
      checkedAt: new Date().toISOString(),
      datasetsStoredOnDisk: 6,
      newStorageInstanceAfterRestart: true,
      cacheChunksChecksumVerified: true,
      networkDisabled: true,
      results,
      polishAverageSpeedFromCache: true,
      physicalDeviceAirplaneTest: false,
    };
    fs.writeFileSync(
      path.join(root, "mobile-tests/offline-warning-verification.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
