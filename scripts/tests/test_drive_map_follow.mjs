import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { nextDriveCameraCommand } from "../../drive-map-follow.js";

const root = new URL("../../", import.meta.url);

test("stationary GPS and heading jitter issues one camera command, not a stream", () => {
  let previous = null;
  let commands = 0;
  for (let i = 0; i < 40; i += 1) {
    const command = nextDriveCameraCommand(previous, {
      latitude: 50.4501,
      longitude: 30.5234,
      heading: 90 + (i % 5),
      moving: false,
      zoom: 17,
      at: i * 100,
    });
    if (command) {
      commands += 1;
      previous = command;
      assert.equal(command.api, "animateCamera");
    }
  }
  assert.equal(commands, 1);
});

test("a moving car is followed, and a second fix inside the animation window is not", () => {
  const first = nextDriveCameraCommand(null, {
    latitude: 50.45, longitude: 30.52, heading: 10, moving: true, zoom: 17, at: 0,
  });
  assert.ok(first);
  const tooSoon = nextDriveCameraCommand(first, {
    latitude: 50.4504, longitude: 30.52, heading: 12, moving: true, zoom: 17, at: 200,
  });
  assert.equal(tooSoon, null);
  const later = nextDriveCameraCommand(first, {
    latitude: 50.4504, longitude: 30.52, heading: 12, moving: true, zoom: 17, at: 1000,
  });
  assert.equal(later?.api, "animateCamera");
  assert.ok(later.latitude > first.latitude);
});

test("zoom changes still move the camera, and an explicit recenter is not dropped", () => {
  const first = nextDriveCameraCommand(null, {
    latitude: 52.23, longitude: 21.01, heading: null, moving: false, zoom: 17, at: 0,
  });
  const zoomed = nextDriveCameraCommand(first, {
    latitude: 52.23, longitude: 21.01, heading: null, moving: false, zoom: 15, at: 50,
  });
  assert.equal(zoomed?.zoom, 15);
  const forced = nextDriveCameraCommand(zoomed, {
    latitude: 52.23, longitude: 21.01, heading: null, moving: false, zoom: 15, at: 60,
  }, { force: true });
  assert.equal(forced?.api, "animateCamera");
});

test("the trip screen does not restart iOS region animation on location updates", () => {
  const app = fs.readFileSync(new URL("App.js", root), "utf8");
  const start = app.indexOf("function DriveModeScreen(");
  const end = app.indexOf("\nfunction CameraAlertCompact(");
  const body = app.slice(start, end);
  assert.ok(start > 0 && end > start);
  assert.equal(body.includes("animateToRegion"), false);
  assert.ok(body.includes("nextDriveCameraCommand"));
  assert.ok(body.includes("animateCamera"));
});
