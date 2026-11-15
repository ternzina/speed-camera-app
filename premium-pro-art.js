import React from "react";
import { StyleSheet, View } from "react-native";

const NIGHT = "#160A24";
const GOLD = "#E4B15A";
const CREAM = "#F6EFE2";

const STARS = [
  [12, 8], [28, 16], [46, 6], [70, 12], [84, 7], [18, 22], [62, 20], [90, 18], [38, 14],
];

const LANES = [0, 1, 2, 3, 4, 5].map(step => {
  const t = step / 5;
  return { top: 62 + t * 44, width: 22 + t * 74, lamp: step % 2 === 0 };
});

export function EveningRoad() {
  return (
    <View pointerEvents="none" style={styles.clip}>
      <View style={styles.sky} />
      <View style={styles.dusk} />
      <View style={styles.sun} />
      {STARS.map(([left, top]) => (
        <View key={`${left}-${top}`} style={[styles.star, { left: `${left}%`, top }]} />
      ))}
      <View style={styles.hillLeft} />
      <View style={styles.hillRight} />
      <View style={styles.horizon} />
      {LANES.map(lane => (
        <View key={lane.top} style={[styles.lane, { top: lane.top, width: `${lane.width}%`, left: `${(100 - lane.width) / 2}%` }]}>
          {lane.lamp ? <View style={styles.lampLeft} /> : null}
          {lane.lamp ? <View style={styles.lampRight} /> : null}
          <View style={styles.dash} />
        </View>
      ))}
      <View style={styles.fade} />
    </View>
  );
}

export function SlideArt({ id }) {
  if (id === "navigation") return <NavigationArt />;
  if (id === "voice") return <VoiceArt />;
  if (id === "background") return <BackgroundArt />;
  if (id === "settings") return <SettingsArt />;
  return <CameraArt />;
}

export function SlideIcon({ id }) {
  if (id === "navigation") return <View style={styles.pin}><View style={styles.pinHole} /></View>;
  if (id === "voice") return <View style={styles.voiceIcon}><View style={styles.waveShort} /><View style={styles.waveTall} /><View style={styles.waveShort} /></View>;
  if (id === "background") return <View style={styles.moonIcon}><View style={styles.moonCut} /></View>;
  if (id === "settings") return <View style={styles.sliders}><View style={styles.slider} /><View style={[styles.slider, styles.sliderMid]} /><View style={styles.slider} /></View>;
  return <View style={styles.cameraIcon}><View style={styles.lens} /></View>;
}

function CameraArt() {
  return (
    <View style={styles.stage}>
      <View style={styles.stageRoad} />
      <View style={styles.beam} />
      <View style={styles.cameraBody}><View style={styles.cameraLens} /></View>
    </View>
  );
}

function NavigationArt() {
  return (
    <View style={styles.stage}>
      <View style={styles.stageRoad} />
      <View style={styles.route} />
      <View style={[styles.pin, styles.pinOnArt]}><View style={styles.pinHole} /></View>
    </View>
  );
}

function VoiceArt() {
  return (
    <View style={styles.stage}>
      <View style={styles.voiceArcWide} />
      <View style={styles.voiceArc} />
      <View style={styles.speaker} />
    </View>
  );
}

function BackgroundArt() {
  return (
    <View style={styles.stage}>
      <View style={styles.fullMoon} />
      <View style={styles.stageRoadLow} />
      <View style={styles.pocket} />
    </View>
  );
}

function SettingsArt() {
  return (
    <View style={styles.stage}>
      {[0.3, 0.62, 0.45].map(knob => (
        <View key={knob} style={styles.track}>
          <View style={[styles.knob, { left: `${knob * 100}%` }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { height: 118, overflow: "hidden", borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  sky: { ...StyleSheet.absoluteFillObject, backgroundColor: "#241042" },
  dusk: { position: "absolute", left: 0, right: 0, top: 8, height: 58, backgroundColor: "#5A2C78" },
  sun: { position: "absolute", alignSelf: "center", top: 12, width: 180, height: 52, borderRadius: 40, backgroundColor: "#E4B15A", opacity: 0.5 },
  star: { position: "absolute", width: 3, height: 3, borderRadius: 2, backgroundColor: CREAM, opacity: 0.85 },
  hillLeft: { position: "absolute", left: -80, top: 36, width: 240, height: 54, borderTopLeftRadius: 80, borderTopRightRadius: 80, backgroundColor: "#2A1548" },
  hillRight: { position: "absolute", right: -50, top: 44, width: 200, height: 48, borderTopLeftRadius: 70, borderTopRightRadius: 70, backgroundColor: "#1C1036" },
  horizon: { position: "absolute", left: 0, right: 0, top: 58, height: 2, backgroundColor: GOLD, opacity: 0.8 },
  lane: { position: "absolute", height: 14, alignItems: "center", backgroundColor: "#2A1A44" },
  dash: { width: 7, height: 7, marginTop: 3, borderRadius: 2, backgroundColor: GOLD },
  lampLeft: { position: "absolute", left: 8, top: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  lampRight: { position: "absolute", right: 8, top: 4, width: 5, height: 5, borderRadius: 3, backgroundColor: GOLD },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 54, backgroundColor: NIGHT },
  stage: { height: 64, borderRadius: 14, overflow: "hidden", backgroundColor: "#2A1848", alignItems: "center", justifyContent: "center" },
  stageRoad: { position: "absolute", left: "28%", right: "28%", bottom: 0, height: 46, backgroundColor: "#1A102E", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  beam: { position: "absolute", right: 54, bottom: 18, width: 70, height: 8, borderRadius: 8, backgroundColor: GOLD, opacity: 0.45 },
  cameraBody: { position: "absolute", right: 22, bottom: 16, width: 36, height: 26, borderRadius: 6, backgroundColor: "#140C22", borderWidth: 1, borderColor: GOLD, alignItems: "center", justifyContent: "center" },
  cameraLens: { width: 12, height: 12, borderRadius: 6, backgroundColor: GOLD },
  route: { position: "absolute", left: 36, top: 34, width: 130, height: 5, borderRadius: 3, backgroundColor: GOLD, transform: [{ rotate: "-24deg" }] },
  pin: { width: 16, height: 16, borderRadius: 8, borderBottomRightRadius: 2, backgroundColor: GOLD, transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center" },
  pinOnArt: { position: "absolute", right: 54, top: 14 },
  pinHole: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#2A1848" },
  voiceIcon: { width: 22, height: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  waveShort: { width: 4, height: 8, borderRadius: 2, backgroundColor: GOLD },
  waveTall: { width: 4, height: 16, borderRadius: 2, backgroundColor: GOLD },
  voiceArcWide: { position: "absolute", width: 74, height: 74, borderRadius: 37, borderWidth: 3, borderColor: GOLD, opacity: 0.35 },
  voiceArc: { position: "absolute", width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: GOLD },
  speaker: { width: 14, height: 18, borderRadius: 3, backgroundColor: CREAM },
  moonIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: GOLD, overflow: "hidden" },
  moonCut: { position: "absolute", right: -2, width: 12, height: 16, borderRadius: 8, backgroundColor: "#2A1848" },
  fullMoon: { position: "absolute", top: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: "#F0D7A2" },
  stageRoadLow: { position: "absolute", left: 0, right: 0, bottom: 0, height: 22, backgroundColor: "#1A102E" },
  pocket: { position: "absolute", right: 28, bottom: 8, width: 22, height: 34, borderRadius: 4, backgroundColor: "#120A1C", borderWidth: 1, borderColor: GOLD },
  sliders: { width: 18, height: 16, justifyContent: "space-between" },
  slider: { height: 3, borderRadius: 2, backgroundColor: GOLD },
  sliderMid: { width: 12 },
  track: { width: "72%", height: 4, borderRadius: 2, backgroundColor: "#4A3568", marginVertical: 6 },
  knob: { position: "absolute", top: -5, width: 14, height: 14, borderRadius: 7, backgroundColor: GOLD },
});
