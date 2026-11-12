import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildPreviewCases,
  movePoint,
  nearestAhead,
  settleUkraineLast,
  ukraineFixDecision,
  warningDistanceForSpeed,
} from "../../camera-fix.js";
import { googleAudioMode } from "../../google-nav-banner.js";

const SETTINGS = {
  smartDistance: true,
  cityDistance: 600,
  roadDistance: 900,
  highwayDistance: 1200,
  fastDistance: 1500,
};
const cameras = JSON.parse(readFileSync(new URL("../../cameras.json", import.meta.url), "utf8")).cameras;
const plan = buildPreviewCases(cameras);
const camera = plan.primary.camera;
const bearing = plan.primary.bearing;

function pointAt(signedDistance, heading) {
  const travel = signedDistance >= 0 ? (bearing + 180) % 360 : bearing;
  const spot = movePoint(Number(camera.latitude), Number(camera.longitude), travel, Math.abs(signedDistance));
  return { lat: spot.lat, lon: spot.lon, heading };
}

function audioFor(decision, guiding) {
  if (!decision.speak) return guiding ? "alerts-and-guidance" : "silent-no-route";
  const during = googleAudioMode({ cameraSpeaking: true, guiding, voiceEnabled: true });
  const after = googleAudioMode({ cameraSpeaking: false, guiding, voiceEnabled: true });
  return `${during}->${after}`;
}

function samples(from, to, step) {
  const dir = to >= from ? 1 : -1;
  const out = [];
  for (let value = from; dir > 0 ? value <= to : value >= to; value += dir * step) out.push(value);
  if (out[out.length - 1] !== to) out.push(to);
  return out;
}

function drive(state, { from, to, step, speed, heading, guiding, name }) {
  const threshold = warningDistanceForSpeed(speed, SETTINGS);
  const rows = [];
  let previous = from;
  for (const signed of samples(from, to, step)) {
    const moved = Math.abs(signed - previous);
    if (rows.length) state.t += moved / (speed / 3.6);
    previous = signed;
    const point = pointAt(signed, heading);
    let decision;
    if (!(speed >= 8) || heading == null || !Number.isFinite(Number(heading))) {
      decision = { speak: false, reason: "below-speed", distance: null, cameraId: null, angle: null };
    } else {
      const ahead = nearestAhead(cameras, point.lat, point.lon, heading);
      decision = ukraineFixDecision({
        speedKmh: speed,
        heading,
        ahead,
        threshold,
        last: state.last,
        minSpeed: 8,
      });
      state.last = settleUkraineLast(state.last, decision);
    }
    rows.push({
      name,
      t: Math.round(state.t),
      speed,
      distance: decision.distance ?? null,
      cameraId: decision.cameraId ?? null,
      reason: decision.speak ? "warn" : decision.reason,
      audio: audioFor(decision, guiding),
      target: decision.cameraId === camera.id,
      signed,
    });
  }
  return rows;
}

function warns(rows, id = camera.id) {
  return rows.filter(row => row.reason === "warn" && row.cameraId === id);
}

const report = [];

function check(name, ok, detail) {
  report.push({ name, ok, detail });
  assert.equal(ok, true, `${name}: ${detail}`);
}

test("virtual trips use the live camera rule on real Ukraine cameras", () => {
  assert.ok(camera?.id != null);
  assert.match(readFileSync(new URL("../../App.js", import.meta.url), "utf8"), /settleUkraineLast\(lastSpoken\.current, decision\)/);

  for (const speed of [20, 50, 90, 120]) {
    const threshold = warningDistanceForSpeed(speed, SETTINGS);
    const state = { t: 0, last: { id: null, distance: Infinity } };
    const approach = drive(state, {
      from: threshold + 400,
      to: 80,
      step: 40,
      speed,
      heading: bearing,
      guiding: true,
      name: `approach-${speed}`,
    });
    const spoken = warns(approach);
    check(
      `подход ${speed} км/ч`,
      spoken.length >= 1 && spoken[0].distance <= threshold && spoken[0].distance >= threshold - 80,
      `первое ${spoken[0]?.distance ?? "нет"} м, порог ${threshold}, предупреждений ${spoken.length}`,
    );
    for (let index = 1; index < spoken.length; index += 1) {
      const closed = spoken[index - 1].distance - spoken[index].distance;
      check(`повтор не раньше 250 м при ${speed}`, closed >= 250, `сближение ${closed} м`);
    }
    const outside = approach.filter(row => row.target && row.distance > threshold && row.reason === "warn");
    check(`нет ложного за порогом при ${speed}`, outside.length === 0, `ложных ${outside.length}`);
    const early = [];
    for (let index = 1; index < approach.length; index += 1) {
      const previous = approach[index - 1];
      const row = approach[index];
      if (row.reason !== "warn" || !row.target || !previous.target) continue;
      if (previous.reason === "warn" && previous.distance - row.distance < 250) early.push(row.distance);
    }
    check(`нет раннего повтора при ${speed}`, early.length === 0, `ранних ${early.length}`);

    const passed = drive(state, {
      from: 40,
      to: -300,
      step: 40,
      speed,
      heading: bearing,
      guiding: true,
      name: `pass-${speed}`,
    });
    const behindWarns = warns(passed).filter(row => row.signed <= 0);
    const aheadWarns = warns(passed).filter(row => row.signed > 0);
    check(
      `проезд ${speed}`,
      behindWarns.length === 0 && aheadWarns.length <= 1,
      `позади ${behindWarns.length}, впереди ${aheadWarns.length}`,
    );

    const away = drive(state, {
      from: -300,
      to: -(threshold + 200),
      step: 80,
      speed,
      heading: bearing,
      guiding: true,
      name: `away-${speed}`,
    });
    check(`удаление ${speed}`, warns(away).length === 0, `предупреждений цели ${warns(away).length}`);

    const back = drive(state, {
      from: threshold + 200,
      to: threshold - 80,
      step: 40,
      speed,
      heading: bearing,
      guiding: true,
      name: `return-${speed}`,
    });
    const returned = warns(back);
    check(
      `повторный подход ${speed}`,
      returned.length === 1 && returned[0].distance <= threshold,
      `предупреждений ${returned.length}, дистанция ${returned[0]?.distance ?? "нет"}`,
    );
    report.push({
      name: `аудио с маршрутом ${speed}`,
      ok: spoken.every(row => row.audio === "silent->alerts-and-guidance"),
      detail: spoken.map(row => `${row.t}с ${row.distance}м ${row.audio}`).join("; ") || "нет",
    });
    check(
      `приоритет камеры при ${speed}`,
      spoken.every(row => row.audio === "silent->alerts-and-guidance"),
      spoken[0]?.audio || "нет",
    );
  }

  const sideBearing = (bearing + 90) % 360;
  const side = movePoint(Number(camera.latitude), Number(camera.longitude), sideBearing, 350);
  const sideAhead = nearestAhead(cameras, side.lat, side.lon, bearing);
  const sideDecision = ukraineFixDecision({
    speedKmh: 50,
    heading: bearing,
    ahead: sideAhead,
    threshold: 600,
    last: { id: null, distance: Infinity },
  });
  check(
    "камера сбоку",
    sideAhead?.id !== camera.id,
    sideAhead?.id === camera.id ? "цель выбрана сбоку" : "цель не впереди",
  );
  check("сбоку нет предупреждения цели", sideDecision.cameraId !== camera.id || sideDecision.speak === false, sideDecision.reason);

  const behind = pointAt(-250, bearing);
  const behindAhead = nearestAhead(cameras, behind.lat, behind.lon, bearing);
  check("камера позади", behindAhead?.id !== camera.id, behindAhead?.id === camera.id ? "цель всё ещё впереди" : "цель не впереди");

  const stopped = { t: 0, last: { id: camera.id, distance: 500 } };
  const halt = drive(stopped, { from: 480, to: 480, step: 40, speed: 0, heading: bearing, guiding: true, name: "stop" });
  check("остановка", halt.every(row => row.reason === "below-speed"), halt.map(row => row.reason).join(","));
  const resumed = drive(stopped, { from: 460, to: 420, step: 40, speed: 50, heading: bearing, guiding: true, name: "resume" });
  check("после остановки нет раннего повтора", warns(resumed).length === 0, `предупреждений ${warns(resumed).length}`);

  const lost = { t: 0, last: { id: camera.id, distance: 500 } };
  const gap = drive(lost, { from: 470, to: 430, step: 40, speed: 50, heading: null, guiding: false, name: "gps-loss" });
  check("потеря GPS", gap.every(row => row.reason === "below-speed"), gap.map(row => row.reason).join(","));
  const restored = drive(lost, { from: 420, to: 380, step: 40, speed: 50, heading: bearing, guiding: false, name: "gps-back" });
  check("после GPS нет раннего повтора", warns(restored).length === 0, `предупреждений ${warns(restored).length}`);

  const turned = { t: 0, last: { id: null, distance: Infinity } };
  const toward = drive(turned, { from: 700, to: 520, step: 40, speed: 50, heading: bearing, guiding: false, name: "before-turn" });
  check("до разворота есть предупреждение", warns(toward).length === 1, `предупреждений ${warns(toward).length}`);
  const reverse = drive(turned, { from: 520, to: 800, step: 40, speed: 50, heading: (bearing + 180) % 360, guiding: false, name: "turn-away" });
  check("после смены направления цель молчит", warns(reverse).length === 0, `предупреждений ${warns(reverse).length}`);
  const again = drive(turned, { from: 760, to: 520, step: 40, speed: 50, heading: bearing, guiding: false, name: "turn-back" });
  const againWarns = warns(again);
  check("повтор сигнала после разворота", againWarns.length === 1, `предупреждений ${againWarns.length}, ${againWarns[0]?.distance ?? "нет"} м`);
  check(
    "без маршрута Google молчит",
    againWarns.every(row => row.audio === "silent->silent"),
    againWarns[0]?.audio || "нет",
  );

  const failed = report.filter(item => !item.ok);
  const summary = JSON.stringify({
    checked: report.length,
    passed: report.length - failed.length,
    names: report.map(item => item.name),
  });
  assert.equal(/-?\d{1,3}\.\d{4,}/.test(summary), false);
  assert.equal(failed.length, 0, failed.map(item => `${item.name}: ${item.detail}`).join(" | "));
  console.log(summary);
});
