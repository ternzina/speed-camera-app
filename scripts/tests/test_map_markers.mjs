import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  clusterFocusRegion,
  clusterMapPoints,
  mapMarkerKind,
  markerPixelSize,
  showsIndividualCameras,
} from "../../map-camera-markers.js";

const root = new URL("../../", import.meta.url);
const read = name => fs.readFileSync(new URL(name, root), "utf8");

test("marker kind and size follow the camera type and the zoom", () => {
  assert.equal(mapMarkerKind({ type: "speed_camera" }), "speed");
  assert.equal(mapMarkerKind({ camera_type: "fixed_speed" }), "speed");
  assert.equal(mapMarkerKind({ type: "red_light" }), "light");
  assert.equal(mapMarkerKind({ type: "speed_and_red_light" }), "speed_light");
  assert.equal(mapMarkerKind({ camera_type: "average_speed_section" }), "section");
  assert.equal(mapMarkerKind({ type: "average_speed" }), "section");
  assert.equal(mapMarkerKind({ camera_type: "other_enforcement" }), "checkpoint");
  assert.equal(mapMarkerKind({}), "speed");
  assert.equal(markerPixelSize(0.2), 24);
  assert.equal(markerPixelSize(0.05), 28);
  assert.equal(markerPixelSize(0.01), 32);
});

test("nearby cameras cluster when zoomed out and keep exact coordinates when zoomed in", () => {
  const cameras = [
    { id: "a", latitude: 50.45, longitude: 30.52 },
    { id: "b", latitude: 50.4504, longitude: 30.5203 },
    { id: "c", latitude: 48.46, longitude: 35.04 },
  ];
  const before = cameras.map(camera => ({ ...camera }));
  const wide = { latitude: 49.5, longitude: 32, latitudeDelta: 4, longitudeDelta: 6, width: 360, height: 560 };
  assert.equal(showsIndividualCameras(wide), false);
  const clustered = clusterMapPoints(cameras, wide);
  const group = clustered.find(item => item.kind === "cluster");
  assert.ok(group);
  assert.equal(group.count, 2);
  assert.equal(clustered.filter(item => item.kind === "camera").length, 1);
  assert.equal(clustered.find(item => item.kind === "camera").camera.id, "c");
  assert.deepEqual(cameras, before);

  const close = { ...wide, latitudeDelta: 0.004, longitudeDelta: 0.004 };
  assert.equal(showsIndividualCameras(close), true);
  const separate = clusterMapPoints(cameras, close);
  assert.equal(separate.length, 3);
  assert.deepEqual(separate.map(item => [item.kind, item.latitude, item.longitude]), [
    ["camera", 50.45, 30.52],
    ["camera", 50.4504, 30.5203],
    ["camera", 48.46, 35.04],
  ]);
  for (const item of separate) assert.equal(item.camera.latitude, item.latitude);

  const focus = clusterFocusRegion(group, wide);
  assert.equal(focus.latitude, group.latitude);
  assert.ok(focus.latitudeDelta < wide.latitudeDelta);
  assert.equal(showsIndividualCameras({ ...close, latitudeDelta: focus.latitudeDelta, height: 560 }), true);
});

test("zoomed-out markers stay a footprint apart without moving stored coordinates", () => {
  const parsed = JSON.parse(read("cameras.json"));
  const usable = (Array.isArray(parsed) ? parsed : parsed.cameras).filter(camera => Number.isFinite(Number(camera.latitude)));
  const before = JSON.stringify(usable[0]);
  const region = { latitude: 49.2, longitude: 31.4, latitudeDelta: 7.2, longitudeDelta: 10, width: 357, height: 430 };
  const inView = usable.filter(camera => Math.abs(Number(camera.latitude) - region.latitude) <= region.latitudeDelta / 2
    && Math.abs(Number(camera.longitude) - region.longitude) <= region.longitudeDelta / 2);
  const items = clusterMapPoints(inView, region);
  assert.ok(items.length < inView.length);
  assert.equal(markerPixelSize(region.latitudeDelta), 24);
  let nearest = Infinity;
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const dx = (items[i].longitude - items[j].longitude) / region.longitudeDelta * region.width;
      const dy = (items[i].latitude - items[j].latitude) / region.latitudeDelta * region.height;
      nearest = Math.min(nearest, Math.hypot(dx, dy));
    }
  }
  assert.ok(nearest >= 32, nearest);
  assert.equal(JSON.stringify(usable[0]), before);
});

test("the map uses the new pins and the drive screen still uses its own marker", () => {
  const app = read("App.js");
  const drive = app.slice(app.indexOf("function DriveModeScreen"), app.indexOf("function BrowseMap"));
  const browse = app.slice(app.indexOf("function BrowseMap"), app.indexOf("function RoadCamerasScreen"));
  const catalog = app.slice(app.indexOf("function RoadCamerasScreen"), app.indexOf("function formatRoadDistance"));
  assert.match(drive, /cameraGlyph\(camera\)/);
  assert.doesNotMatch(drive, /MapCameraPin|clusterMapPoints/);
  assert.match(browse, /clusterMapPoints/);
  assert.match(browse, /MapCameraPin/);
  assert.doesNotMatch(browse, /fontSize:\s*24|cameraGlyph/);
  assert.match(catalog, /clusterMapPoints/);
  assert.match(catalog, /MapCameraPin/);
  assert.doesNotMatch(catalog, /fontSize:\s*24/);
  assert.match(app, /screenHeader:\{flexDirection:"row",alignItems:"center",gap:10,minHeight:52,paddingTop:6,overflow:"visible"\}/);
  assert.match(app, /title:\{fontSize:28,lineHeight:36,fontWeight:"800",marginTop:0/);
  assert.match(app, /style=\{s\.screenHeader\}[\s\S]{0,1200}numberOfLines=\{2\}/);
  assert.match(app, /Камери на дорогах/);
  assert.equal(read("cameras.json").includes("latitude"), true);
});
