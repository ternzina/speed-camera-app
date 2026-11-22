import React from "react";
import { ImageBackground, StyleSheet, View } from "react-native";

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

function CameraArt() { return <PhotoArt id="cameras" />; }
function NavigationArt() { return <PhotoArt id="navigation" />; }
function VoiceArt() { return <PhotoArt id="voice" />; }
function BackgroundArt() { return <PhotoArt id="background" />; }
function SettingsArt() { return <PhotoArt id="settings" />; }

function PhotoArt({ id }) {
  return (
    <ImageBackground source={require("./assets/pro-evening-road.png")} resizeMode="cover" imageStyle={styles.photoImage} style={styles.photoArt}>
      <View style={styles.photoShade} />
      {id === "navigation" ? <View style={styles.routeGlow}><View style={styles.routeLine} /><View style={styles.routePin} /></View> : null}
      {id === "voice" ? <View style={styles.voiceVisual}><View style={styles.voiceCore} /><View style={styles.voiceRing} /><View style={[styles.voiceRing, styles.voiceRingOuter]} /></View> : null}
      {id === "background" ? <View style={styles.backgroundVisual}><View style={styles.backgroundMoon} /><View style={styles.backgroundPhone}><View style={styles.phoneLine} /><View style={styles.phoneLineShort} /></View></View> : null}
      {id === "settings" ? <View style={styles.settingsVisual}>{[0, 1, 2].map((item) => <View key={item} style={styles.settingTrack}><View style={[styles.settingKnob, item === 1 && styles.settingKnobMiddle]} /></View>)}</View> : null}
    </ImageBackground>
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
  photoArt: { height: 198, overflow: "hidden", justifyContent: "center" },
  photoImage: { opacity: 0.98 },
  photoShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,10,28,0.10)" },
  routeGlow: { position: "absolute", left: 26, top: 28, width: 124, height: 102, transform: [{ rotate: "-18deg" }] },
  routeLine: { position: "absolute", left: 18, top: 12, width: 86, height: 84, borderLeftWidth: 5, borderBottomWidth: 5, borderColor: "#56C9FF", borderBottomLeftRadius: 42, shadowColor: "#42C9FF", shadowOpacity: 0.9, shadowRadius: 9 },
  routePin: { position: "absolute", left: 80, top: 58, width: 20, height: 20, borderRadius: 11, borderWidth: 4, borderColor: "#B8F2FF", backgroundColor: "#178DE4" },
  voiceVisual: { position: "absolute", left: 66, top: 36, width: 94, height: 94, alignItems: "center", justifyContent: "center" },
  voiceCore: { width: 18, height: 35, borderRadius: 9, backgroundColor: GOLD, borderWidth: 2, borderColor: "#FFF1B3" },
  voiceRing: { position: "absolute", width: 54, height: 65, borderRadius: 30, borderWidth: 3, borderColor: "rgba(255,198,41,0.78)" },
  voiceRingOuter: { width: 84, height: 96, borderColor: "rgba(255,198,41,0.42)" },
  backgroundVisual: { position: "absolute", left: 55, top: 28, width: 110, height: 110, alignItems: "center", justifyContent: "center" },
  backgroundMoon: { position: "absolute", right: 12, top: 3, width: 29, height: 29, borderRadius: 15, backgroundColor: "#FFE5A1", shadowColor: GOLD, shadowOpacity: 0.8, shadowRadius: 13 },
  backgroundPhone: { width: 43, height: 78, borderRadius: 10, borderWidth: 2, borderColor: "#E3E8F4", backgroundColor: "rgba(5,12,30,0.78)", alignItems: "center", justifyContent: "center", gap: 7 },
  phoneLine: { width: 25, height: 3, borderRadius: 2, backgroundColor: GOLD },
  phoneLineShort: { width: 16, height: 3, borderRadius: 2, backgroundColor: "#DEE7FA" },
  settingsVisual: { position: "absolute", left: 38, top: 39, width: 110, gap: 13, transform: [{ rotate: "-8deg" }] },
  settingTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(231,235,255,0.85)" },
  settingKnob: { position: "absolute", left: "28%", top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: GOLD, borderWidth: 2, borderColor: "#FFF0B2" },
  settingKnobMiddle: { left: "68%" },
});
