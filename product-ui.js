import React, { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import MapView, { Marker } from "./map-surface";
import Feather from "@expo/vector-icons/Feather";
import { distanceBetween } from "./driver-engine";
import { displayDistance, displaySpeed } from "./premium-presentation";
import { drivingLabel } from "./driver-copy";

import { CONTROL_ICONS, mapClusters } from "./product-presentation";
export function Icon({ name, size = 20, color = "#46617a" }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Feather name={name} size={size} color={color} />
    </View>
  );
}
export function CameraMap({
  height,
  units = "metric",
  unitsCopy,
  trail,
  voice,
  onVoice,
  points,
  coords,
  copy,
  driverCopy,
  language,
  warning,
  onLocate,
  onReport,
}) {
  const initial = coords || points[0] || { latitude: 50.45, longitude: 30.52 };
  const [region, setRegion] = useState({
    ...initial,
    latitudeDelta: 0.12,
    longitudeDelta: 0.12,
  });
  const [locating, setLocating] = useState(false);
  const map = useRef(null);
  const clusters = useMemo(() => mapClusters(points, region), [points, region]);
  const nearest = useMemo(
    () =>
      coords
        ? points
            .map((p) => ({ ...p, distance: distanceBetween(coords, p) }))
            .sort((a, b) => a.distance - b.distance)[0]
        : null,
    [points, coords],
  );
  async function locate() {
    setLocating(true);
    try {
      const position = await onLocate();
      if (position)
        map.current?.animateToRegion(
          { ...position, latitudeDelta: 0.025, longitudeDelta: 0.025 },
          400,
        );
    } finally {
      setLocating(false);
    }
  }
  function nearby() {
    if (!nearest) {
      locate();
      return;
    }
    map.current?.fitToCoordinates([coords, nearest], {
      edgePadding: { top: 85, left: 55, right: 55, bottom: 180 },
      animated: true,
    });
  }
  return (
    <View style={[m.frame, height && { height, flex: 0 }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        userCoordinate={coords}
        trail={trail}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsCompass={false}
        toolbarEnabled={false}
      >
        {clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            coordinate={cluster}
            clusterCount={cluster.items.length}
            mapIcon={CONTROL_ICONS[cluster.items[0].type] || "camera"}
            title={
              cluster.items.length > 1
                ? `${copy.nearby}: ${cluster.items.length}`
                : drivingLabel(cluster.items[0], driverCopy)
            }
            onPress={() =>
              cluster.items.length > 1 &&
              map.current?.animateToRegion(
                {
                  ...cluster,
                  latitudeDelta: region.latitudeDelta / 2,
                  longitudeDelta: region.longitudeDelta / 2,
                },
                350,
              )
            }
          >
            <View style={[m.pin, cluster.items.length > 1 && m.cluster]}>
              {cluster.items.length > 1 ? (
                <Text style={m.clusterNumber}>{cluster.items.length}</Text>
              ) : (
                <Icon
                  name={CONTROL_ICONS[cluster.items[0].type] || "camera"}
                  color="#007aff"
                  size={18}
                />
              )}
            </View>
          </Marker>
        ))}
      </MapView>
      {warning ? (
        <View
          style={[
            m.warning,
            warning.over && {
              backgroundColor: "#ffe3df",
              borderColor: "#f04438",
            },
          ]}
        >
          <View style={m.warningIcon}>
            <Icon
              name={CONTROL_ICONS[warning.camera.type] || "camera"}
              color={warning.over ? "#d92d20" : "#182230"}
              size={24}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={m.warningTitle}>
              {drivingLabel(warning.camera, driverCopy)}
            </Text>
            <Text style={m.warningDistance}>
              {displayDistance(
                warning.distance,
                units,
                unitsCopy || driverCopy,
              )}
              {warning.camera.speed_limit > 0 && !warning.limitHidden
                ? ` · ${driverCopy.limit} ${displaySpeed(warning.camera.speed_limit, units)}`
                : ""}
            </Text>
          </View>
        </View>
      ) : (
        <View style={m.hint}>
          <Icon name="layers" size={15} />
          <Text style={m.hintText}>{copy.mapHint}</Text>
        </View>
      )}
      <View style={m.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.locate}
          disabled={locating}
          onPress={locate}
          style={[m.control, onVoice && {width:44,height:44}]}
        >
          <Icon name={locating ? "clock" : "navigation"} />
        </Pressable>
        {onVoice && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.voiceOn}
            onPress={onVoice}
            style={[m.control, onVoice && {width:44,height:44}]}
          >
            <Icon name={voice ? "volume-2" : "volume-x"} color="#007aff" />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.report}
          onPress={onReport}
          style={[m.control, onVoice && {width:44,height:44}]}
        >
          <Icon name="plus" />
        </Pressable>
      </View>
      <View style={m.bottom}>
        <View style={m.bottomIcon}>
          <Icon
            name={nearest ? CONTROL_ICONS[nearest.type] || "camera" : "map-pin"}
            size={24}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={m.caption}>
            {coords
              ? nearest && nearest.distance <= 5000
                ? copy.nearest
                : copy.noCameras
              : copy.mapHint}
          </Text>
          <Text style={m.title}>
            {coords
              ? nearest && nearest.distance <= 5000
                ? displayDistance(
                    nearest.distance,
                    units,
                    unitsCopy || driverCopy,
                  )
                : copy.calm
              : copy.enableGPS}
          </Text>
          {nearest && nearest.distance <= 5000 && (
            <Text style={m.detail}>{drivingLabel(nearest, driverCopy)}</Text>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.nearby}
          onPress={nearby}
          style={[m.control, onVoice && {width:44,height:44}]}
        >
          <Icon name="crosshair" color="#007aff" />
        </Pressable>
      </View>
    </View>
  );
}
const m = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 300,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#e3eaf1",
  },
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#aac4e5",
  },
  cluster: {
    backgroundColor: "#007aff",
    borderColor: "#fff",
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  clusterNumber: { color: "#fff", fontSize: 15, fontWeight: "800" },
  warning: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff0ba",
    borderWidth: 1,
    borderColor: "#f8ce5c",
    borderRadius: 18,
    padding: 14,
  },
  warningIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  warningTitle: { fontSize: 16, fontWeight: "700", color: "#182230" },
  warningDistance: {
    fontSize: 20,
    fontWeight: "800",
    color: "#182230",
    marginTop: 4,
  },
  hint: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 7,
    backgroundColor: "#fffffff0",
    borderRadius: 15,
    padding: 12,
  },
  hintText: { fontSize: 12, color: "#46617a", flex: 1 },
  controls: { position: "absolute", right: 16, top: 108, gap: 8 },
  control: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  bottom: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 22,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  bottomIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#edf3fa",
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { fontSize: 12, color: "#6d8091" },
  title: {
    fontSize: 20,
    color: "#152535",
    fontWeight: "700",
    marginVertical: 4,
  },
  detail: { fontSize: 14, color: "#526779" },
});
