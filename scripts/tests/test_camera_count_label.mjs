import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);
const app = fs.readFileSync(new URL("App.js", root), "utf8");
const screen = fs.readFileSync(new URL("google-nav-test-screen.js", root), "utf8");

const start = app.indexOf("function cameraCountLabel");
const end = app.indexOf("\nfunction ", start + 1);
const cameraCountLabel = new Function(`${app.slice(start, end)}; return cameraCountLabel;`)();

test("camera counts keep the number and use the language's plural", () => {
  assert.equal(cameraCountLabel(1, "ru"), "камера");
  assert.equal(cameraCountLabel(2, "ru"), "камеры");
  assert.equal(cameraCountLabel(5, "ru"), "камер");
  assert.equal(cameraCountLabel(11, "ru"), "камер");
  assert.equal(cameraCountLabel(21, "ru"), "камера");
  assert.equal(cameraCountLabel(22, "ru"), "камеры");
  assert.equal(cameraCountLabel(426, "ru"), "камер");
  assert.equal(cameraCountLabel(1, "uk"), "камера");
  assert.equal(cameraCountLabel(2, "uk"), "камери");
  assert.equal(cameraCountLabel(4, "uk"), "камери");
  assert.equal(cameraCountLabel(5, "uk"), "камер");
  assert.equal(cameraCountLabel(11, "uk"), "камер");
  assert.equal(cameraCountLabel(14, "uk"), "камер");
  assert.equal(cameraCountLabel(21, "uk"), "камера");
  assert.equal(cameraCountLabel(22, "uk"), "камери");
  assert.equal(cameraCountLabel(426, "uk"), "камер");
  assert.equal(cameraCountLabel(1, "en"), "camera");
  assert.equal(cameraCountLabel(0, "en"), "cameras");
  assert.equal(cameraCountLabel(426, "en"), "cameras");
  assert.equal(cameraCountLabel(1, "pl"), "kamera");
  assert.equal(cameraCountLabel(2, "pl"), "kamery");
  assert.equal(cameraCountLabel(4, "pl"), "kamery");
  assert.equal(cameraCountLabel(5, "pl"), "kamer");
  assert.equal(cameraCountLabel(12, "pl"), "kamer");
  assert.equal(cameraCountLabel(14, "pl"), "kamer");
  assert.equal(cameraCountLabel(22, "pl"), "kamery");
  assert.equal(cameraCountLabel(426, "pl"), "kamer");
});

test("the map subtitle and the catalog count both use that word", () => {
  assert.match(app, /cameraCountLabel\(visibleCameras\(\)\.length, settings\.language\)/);
  assert.match(app, /cameraCountLabel\(points\.length, language\)/);
  assert.doesNotMatch(app, /visibleCameras\(\)\.length\} камер/);
  const uk = app.slice(app.indexOf("uk: { map:"), app.indexOf("en: { map:"));
  assert.match(uk, /map: "Мапа камер"/);
  assert.doesNotMatch(uk, /Карта камер/);
  const ru = app.slice(app.indexOf("ru: { map:"), app.indexOf("uk: { map:"));
  assert.match(ru, /map: "Карта камер"/);
});

test("the warning banner wraps the camera name onto two lines", () => {
  const banner = screen.slice(screen.indexOf("{banner && ("), screen.indexOf("{!!error &&"));
  assert.match(banner, /numberOfLines=\{2\}[\s\S]{0,120}styles\.cameraType/);
  assert.match(banner, /styles\.cameraDistance/);
  const style = screen.slice(screen.indexOf("camera: { alignSelf"), screen.indexOf("cameraDistance:"));
  assert.match(style, /flexWrap: "wrap"/);
  assert.doesNotMatch(style, /nowrap/);
  const type = screen.slice(screen.indexOf("cameraType: {"), screen.indexOf("note:"));
  assert.match(type, /flexShrink: 0/);
});
