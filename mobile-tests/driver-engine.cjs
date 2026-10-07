const fs = require("fs"),
  vm = require("vm"),
  assert = require("assert"),
  babel = require("@babel/core");
const moduleDriver = { exports: {} };
vm.runInNewContext(
  babel.transformSync(fs.readFileSync("driver-engine.js", "utf8"), {
    configFile: false,
    babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code,
  { module: moduleDriver, exports: moduleDriver.exports, Date, Set },
);
const e = moduleDriver.exports;
const pos = { latitude: 50, longitude: 4 },
  point = {
    id: "a",
    latitude: 50.005,
    longitude: 4,
    speed_limit: 70,
    type: "speed_camera",
  };
assert(e.isDrivingAhead(pos, 0, point));
assert(!e.isDrivingAhead(pos, 180, point));
assert(!e.isDrivingAhead(pos, 0, { ...point, direction: 180 }));
assert(e.isDrivingAhead(pos, 0, { ...point, direction: "N" }));
assert(!e.isDrivingAhead(pos, 0, { ...point, direction: "S" }));
assert(!e.isDrivingAhead(pos, 0, { ...point, longitude: 4.001 }));
assert(!e.isDrivingAhead(pos, null, point));
assert(!e.usablePoint({ ...point, _example_only: true }));
assert(!e.usablePoint({ latitude: null, longitude: null }));
for (const speed of [20, 50, 90, 130, 250]) {
  const d = e.warningDistances(speed);
  assert(d.first >= 150 && d.first <= 1500);
  assert(d.second >= 60 && d.second <= 500);
  if (speed >= 50 && speed <= 130) {
    assert(Math.abs(d.first / (speed / 3.6) - 22) < 1);
    assert(Math.abs(d.second / (speed / 3.6) - 8) < 1);
  }
}
let state = null;
let events = [];
for (let n = 0; n < 30; n++) {
  const result = e.warningDecision(
    state,
    { ...point, distance: 500 - n * 12 },
    78,
    {},
    100000 + n * 1000,
  );
  state = result.memory;
  if (result.event) events.push(result.event);
}
assert.deepEqual(events, ["first", "second"]);
assert(e.warningPhrase(point, "first", false).includes("Ограничение 70"));
assert(
  !e
    .warningPhrase({ ...point, speed_limit: null }, "first", false)
    .includes("null"),
);
assert(
  e
    .warningPhrase({ ...point, type: "red_light_camera" }, "first", false)
    .includes("красного"),
);
let r = e.warningDecision(null, { ...point, distance: 380 }, 65, {}, 100000);
r = e.warningDecision(r.memory, { ...point, distance: 350 }, 80, {}, 109000);
assert.equal(r.event, "over");
assert.equal(
  e.warningDecision(r.memory, { ...point, distance: 340 }, 80, {}, 120000)
    .event,
  null,
);
const section = {
  id: "zone",
  start: pos,
  end: { latitude: 50.01, longitude: 4 },
  speed_limit: 90,
  direction: 0,
};
const feed = { average_speed_sections: [section] };
assert.equal(
  e.advanceAverageTrip(
    null,
    feed,
    { latitude: 49.999, longitude: 4 },
    0,
    100000,
  ).trip,
  null,
);
let trip = e.advanceAverageTrip(null, feed, pos, 0, 100000).trip;
assert(trip);
trip = e.advanceAverageTrip(
  trip,
  feed,
  { latitude: 50.001, longitude: 4 },
  0,
  110000,
).trip;
assert(Math.abs(trip.average - 40) < 1);
trip = e.advanceAverageTrip(
  trip,
  feed,
  { latitude: 50.001, longitude: 4 },
  0,
  120000,
).trip;
assert(Math.abs(trip.average - 20) < 1);
assert.equal(
  e.advanceAverageTrip(trip, feed, section.end, 0, 140000).event,
  "ending",
);
assert.equal(
  e.advanceAverageTrip(trip, feed, { latitude: 51, longitude: 4 }, 0, 130000)
    .trip,
  null,
);
const canonical = e.drivingPoints({
  speed_cameras: [{ ...point, camera_type: "fixed_speed" }],
  red_light_cameras: [{ ...point, id: "r" }],
  checkpoints: [{ ...point, id: "m" }],
  average_speed_sections: [section],
});
assert.deepEqual(Array.from(canonical.map((p) => p.type)), [
  "speed_camera",
  "red_light_camera",
  "mobile_control",
  "average_speed_start",
  "average_speed_end",
]);
assert.equal(e.canonicalType({ type: "unknown" }), "speed_camera");
console.log(
  "Driver engine passed: direction/corridor/behind checks, time-based distances, two-stage voice suppression, overspeed transition, trip odometer with stopped time and exit reset, canonical legacy types.",
);

let alternation = null,
  alternatingEvents = [];
for (let n = 0; n < 12; n++) {
  const result = e.warningDecision(
    alternation,
    { ...point, id: n % 2 ? "one" : "two", distance: 380 },
    65,
    {},
    200000 + n * 1000,
  );
  alternation = result.memory;
  if (result.event) alternatingEvents.push(result.event);
}
assert.deepEqual(
  alternatingEvents,
  ["first", "first"],
  "nearby camera identity changes must not repeat speech",
);
assert.equal(
  e.advanceAverageTrip(trip, feed, pos, 0, 140000, 120).trip,
  null,
  "poor GPS accuracy must not invent section average",
);
assert.equal(
  e.usableCameraRecordCount(feed),
  1,
  "two section gates represent one published record",
);

assert.equal(
  e.advanceAverageTrip(
    null,
    feed,
    { latitude: 49.99975, longitude: 4 },
    0,
    100000,
    5,
  ).trip,
  null,
  "do not start trip odometer at the approach warning or 28m before the gate",
);
