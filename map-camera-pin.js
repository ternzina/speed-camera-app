import React from "react";
import { View, Text } from "react-native";
import { MARKER_COLORS, mapMarkerKind } from "./map-camera-markers";

function frame(size, backgroundColor, borderColor) {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
    borderWidth: 1.5,
    borderColor,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  };
}

function SpeedGlyph({ size, hole }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center" }}>
      <View style={{ position: "absolute", top: size * 0.08, width: size * 0.34, height: size * 0.14, borderTopLeftRadius: 2, borderTopRightRadius: 2, backgroundColor: "#fff" }} />
      <View style={{ marginTop: size * 0.2, width: size * 0.84, height: size * 0.52, borderRadius: 3, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: size * 0.26, height: size * 0.26, borderRadius: size, backgroundColor: hole }} />
      </View>
    </View>
  );
}

function LightGlyph({ size }) {
  const width = size * 0.38;
  const dot = width * 0.46;
  return (
    <View style={{ width, height: size * 0.9, borderRadius: width * 0.32, backgroundColor: "#fff", alignItems: "center", justifyContent: "space-evenly" }}>
      <View style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: "#E24B4B" }} />
      <View style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: "#F0C14A" }} />
      <View style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: "#37C26B" }} />
    </View>
  );
}

function SectionGlyph({ size }) {
  return (
    <View style={{ width: size * 0.88, height: size * 0.62, justifyContent: "center" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, backgroundColor: "#fff" }} />
      <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 2, backgroundColor: "#fff" }} />
      <View style={{ height: 2, marginHorizontal: 3, backgroundColor: "#fff" }} />
    </View>
  );
}

function CheckpointGlyph({ size }) {
  const side = size * 0.42;
  return <View style={{ width: side, height: side, backgroundColor: "#fff", transform: [{ rotate: "45deg" }] }} />;
}

function glyphFor(kind, size, hole) {
  if (kind === "light") return <LightGlyph size={size} />;
  if (kind === "section") return <SectionGlyph size={size} />;
  if (kind === "checkpoint") return <CheckpointGlyph size={size} />;
  if (kind === "speed_light") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <SpeedGlyph size={size * 0.72} hole={hole} />
        <LightGlyph size={size * 0.7} />
      </View>
    );
  }
  return <SpeedGlyph size={size} hole={hole} />;
}

export function MapCameraPin({ camera, count, size = 26, night = false }) {
  if (count > 1) {
    const background = night ? MARKER_COLORS.clusterNight : MARKER_COLORS.clusterDay;
    return (
      <View style={frame(size, background, night ? "#F7FAFF" : "#FFFFFF")}>
        <Text style={{ color: night ? "#10263B" : "#FFFFFF", fontSize: size >= 30 ? 13 : 11, fontWeight: "800" }}>{count > 99 ? "99+" : String(count)}</Text>
      </View>
    );
  }
  const kind = mapMarkerKind(camera);
  const background = MARKER_COLORS[kind] || MARKER_COLORS.speed;
  return (
    <View style={frame(size, background, "#FFFFFF")}>
      {glyphFor(kind, size * 0.66, background)}
    </View>
  );
}

export function MapMarkerLegend({ items, night, labelStyle }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {items.map(item => (
        <View key={item.type} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <MapCameraPin camera={{ type: item.type }} size={22} night={night} />
          <Text style={labelStyle}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
