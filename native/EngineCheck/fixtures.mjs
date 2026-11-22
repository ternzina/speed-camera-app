import { nearestAhead, ukraineFixDecision, settleUkraineLast, warningDistanceForSpeed, idleWarningDecision, distanceMeters } from "../../camera-fix.js";
import { nearestPolandPoint, detectAverageSpeedSection, averageSectionSpeech } from "../../poland-engine.js";
import { cameraAlertCopy } from "../../camera-alert-copy.js";
import { googleAudioMode } from "../../google-nav-banner.js";
import { premiumAllows, PREMIUM_ENFORCEMENT } from "../../premium-access.js";

const cameras = [
  { id: "a", latitude: 50.45, longitude: 30.52, speed_limit: 50, direction: "0" },
  { id: "b", latitude: 50.47, longitude: 30.52, speed_limit: 80 },
  { id: "side", latitude: 50.45, longitude: 30.55, speed_limit: 50, direction: "90" },
];
const ahead = nearestAhead(cameras, 50.45, 30.52, 0, 5000, 45);
const repeat = ukraineFixDecision({ speedKmh: 70, heading: 0, ahead: { ...cameras[1], distance: 700, angle: 2 }, threshold: 900, last: { id: "b", distance: 800 } });
const fresh = ukraineFixDecision({ speedKmh: 70, heading: 0, ahead: { ...cameras[1], distance: 500, angle: 2 }, threshold: 900, last: { id: "b", distance: 800 } });
const settled = settleUkraineLast({ id: "b", distance: 800 }, { speak: false, reason: "none-ahead" });
const idle = idleWarningDecision({
  speedKmh: 0,
  latitude: 50.4501,
  longitude: 30.52,
  reliable: { heading: 0, latitude: 50.45, longitude: 30.52 },
  cameras,
});
const pl = {
  speed_cameras: [{ id: "p1", latitude: 52.23, longitude: 21.01, speed_limit: 50, direction: "0" }],
  red_light_cameras: [],
  checkpoints: [],
  average_speed_sections: [{
    id: "s1",
    speed_limit: 80,
    direction: "0",
    length_km: 2,
    start: { latitude: 52.24, longitude: 21.01 },
    end: { latitude: 52.26, longitude: 21.01 },
  }],
};
const section = detectAverageSpeedSection(pl, 52.23, 21.01, 0, null);
console.log(JSON.stringify({
  distance: Math.round(distanceMeters(50.45, 30.52, 50.47, 30.52)),
  ahead: ahead && { id: ahead.id, distance: ahead.distance, angle: ahead.angle },
  repeat: repeat.reason,
  fresh: fresh.reason,
  settled,
  bands: [20, 70, 100, 130].map(speed => warningDistanceForSpeed(speed, { smartDistance: true, cityDistance: 600, roadDistance: 900, highwayDistance: 1200, fastDistance: 1500 })),
  idle: idle.reason,
  poland: nearestPolandPoint(pl, 52.22, 21.01, 0)?.id || null,
  section: section && { state: section.state, distance: section.distance },
  sectionSpeech: averageSectionSpeech(section, "ru"),
  copy: cameraAlertCopy("ru", { distance: 420, speed_limit: 50 }, 70, true).speech,
  audio: googleAudioMode({ cameraSpeaking: true, guiding: true, voiceEnabled: true }),
  audioAfter: googleAudioMode({ cameraSpeaking: false, guiding: true, voiceEnabled: true }),
  premium: premiumAllows(null, Date.now(), PREMIUM_ENFORCEMENT).allowed,
}, null, 2));
