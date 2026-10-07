import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  ImageBackground,
  Image,
  StyleSheet,
  Animated,
  Switch,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { themeStyles } from "./premium-theme";
import { Icon, CameraMap } from "./product-ui";
import { CONTROL_ICONS } from "./product-presentation";
import { drivingLabel } from "./driver-copy";
import {
  countryMetrics,
  typeCounts,
  displaySpeed,
  displayDistance,
  FILTER_TYPES,
} from "./premium-presentation";
const HERO = require("./assets/premium/hero-road.png");
const NIGHT = require("./assets/premium/warning-road.png");
const APP_ICON = require("./assets/icon.png");
const TYPE_ICONS = {
  speed_camera: "camera",
  red_light_camera: "stop-circle",
  average_speed: "activity",
  combined: "layers",
  mobile_control: "shield",
  other: "more-horizontal",
};
const TYPE_COLORS = {
  speed_camera: "#007aff",
  red_light_camera: "#ed394b",
  average_speed: "#21a56c",
  combined: "#8b5cf6",
  mobile_control: "#ff9900",
  other: "#667085",
};
export function TypeIcon({ type, size = 21 }) {
  const color = TYPE_COLORS[type] || "#007aff";
  return (
    <View style={[p.typeIcon, { backgroundColor: color + "18" }]}>
      <Icon name={TYPE_ICONS[type] || "camera"} color={color} size={size} />
    </View>
  );
}
export function HeroLanding({ copy, onStart }) {
  return (
    <ImageBackground source={HERO} style={p.fill} resizeMode="cover">
      <StatusBar style="light" />
      <View style={p.heroShade} />
      <SafeAreaView style={p.fill}>
        <View style={p.heroContent}>
          <View style={p.heroTitle}>
            <Image source={APP_ICON} style={p.appIcon} />
            <Text maxFontSizeMultiplier={1.35} style={p.heroName}>{copy.title}</Text>
            <Text maxFontSizeMultiplier={1.35} style={p.heroSubtitle}>{copy.subtitle}</Text>
          </View>
          <View style={p.heroBottom}>
            {[
              ["camera", copy.speed],
              ["stop-circle", copy.red],
              ["activity", copy.average],
              ["globe", copy.world],
            ].map(([icon, label]) => (
              <View key={icon} style={p.feature}>
                <Icon name={icon} color="#fff" size={22} />
                <Text maxFontSizeMultiplier={1.35} style={p.featureText}>{label}</Text>
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={onStart}
              style={p.blueButton}
            >
              <Text maxFontSizeMultiplier={1.35} style={p.buttonText}>{copy.start}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
export function FullWarning({
  height,
  camera,
  speed,
  distance,
  heading,
  copy,
  driverCopy,
  voice,
  units,
  onVoice,
  onReport,
  onStop,
  stopLabel,
  reportLabel,
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.18,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const limit = camera.speed_limit,
    over = limit > 0 && speed > limit + 3;
  return (
    <ImageBackground
      source={NIGHT}
      style={[p.warningFrame, height && { minHeight: height, borderRadius: 0 }]}
    >
      <View style={p.nightShade} />
      <View style={p.warningTop}>
        {limit > 0 && (
          <View style={p.limit}>
            <Text maxFontSizeMultiplier={1.35} style={p.limitNumber}>{displaySpeed(limit, units)}</Text>
          </View>
        )}
        <View>
          <Text maxFontSizeMultiplier={1.35} style={p.warningSpeed}>{displaySpeed(speed, units)}</Text>
          <Text maxFontSizeMultiplier={1.35} style={p.white}>
            {units === "imperial" ? copy.mph : driverCopy.unit}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.voice}
          onPress={onVoice}
          style={p.darkControl}
        >
          <Icon name={voice ? "volume-2" : "volume-x"} color="#fff" size={26} />
        </Pressable>
      </View>
      <View style={p.warningCenter}>
        <View style={p.pulseFrame}>
          <Animated.View
            style={[
              p.pulse,
              {
                transform: [{ scale: pulse }],
                backgroundColor: over ? "#ff303044" : "#ff9d3044",
                borderColor: over ? "#ff4242" : "#ff9d30",
              },
            ]}
          />
          <View
            style={[
              p.cameraDisc,
              { backgroundColor: over ? "#f33939" : "#f58a24" },
            ]}
          >
            <Icon
              name={CONTROL_ICONS[camera.type] || "camera"}
              color="#fff"
              size={42}
            />
          </View>
        </View>
        <Text maxFontSizeMultiplier={1.35} style={p.warningCaption}>{copy.ahead}</Text>
        <Text maxFontSizeMultiplier={1.35} style={p.warningDistance}>
          {displayDistance(distance, units, copy)}
        </Text>
        <Text maxFontSizeMultiplier={1.35} style={p.warningType}>{drivingLabel(camera, driverCopy)}</Text>
        {over && <Text maxFontSizeMultiplier={1.35} style={p.slow}>{driverCopy.slow}</Text>}
        <Text maxFontSizeMultiplier={1.35} numberOfLines={2} style={p.roadName}>
          {camera.road_index ||
            camera.road_name ||
            camera.location ||
            camera.region ||
            ""}
        </Text>
        <Text maxFontSizeMultiplier={1.35} style={p.direction}>
          {copy.direction}
          {Number.isFinite(heading) ? ` · ${Math.round(heading)}°` : ""}
        </Text>
      </View>
      <View style={p.warningActions}>
        <Pressable
          accessibilityRole="button"
          onPress={onStop}
          style={p.darkControl}
        >
          <Text maxFontSizeMultiplier={1.35} style={p.white}>{stopLabel}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onReport}
          style={[p.blueButton, { flex: 1, marginTop: 0 }]}
        >
          <Icon name="plus" color="#fff" />
          <Text maxFontSizeMultiplier={1.35} style={p.buttonText}>{reportLabel}</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}
export function PremiumTrip({
  dark,
  points,
  camera,
  distance,
  coords,
  heading,
  speed,
  limit,
  copy,
  driverCopy,
  mapCopy,
  language,
  country,
  gps,
  voice,
  onVoice,
  onLocate,
  onReport,
  onStop,
  stopLabel,
  reportLabel,
  height,
  units,
  showLimits,
  trail,
  averageTrip,
}) {
  const p = themeStyles(premiumStyles, dark);
  return (
    <View style={p.trip}>
      <View style={p.driveTop}>
        {showLimits && limit > 0 ? (
          <View style={[p.limit, { width: 72, height: 72, borderRadius: 36 }]}>
            <Text maxFontSizeMultiplier={1.35} style={[p.limitNumber, { fontSize: 30 }]}>
              {displaySpeed(limit, units)}
            </Text>
          </View>
        ) : (
          <View style={p.gpsDisc}>
            <Icon name="navigation" color="#007aff" size={28} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={1.35} style={p.driveSpeed}>{displaySpeed(speed, units)}</Text>
          <Text maxFontSizeMultiplier={1.35} style={p.muted}>
            {units === "imperial" ? copy.mph : driverCopy.unit}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text maxFontSizeMultiplier={1.35} style={p.country}>{country}</Text>
          <Text maxFontSizeMultiplier={1.35} style={p.gps}>{gps}</Text>
          {Number.isFinite(heading) && (
            <Text maxFontSizeMultiplier={1.35} style={p.muted}>{Math.round(heading)}°</Text>
          )}
        </View>
      </View>
      <CameraMap
        height={Math.max(260, height - 220)}
        points={points}
        units={units}
        unitsCopy={copy}
        warning={
          camera
            ? {
                camera,
                distance,
                over: camera.speed_limit > 0 && speed > camera.speed_limit + 3,
                limitHidden: !showLimits,
              }
            : null
        }
        coords={coords}
        trail={trail}
        copy={{...mapCopy, mapHint:driverCopy.clear}}
        driverCopy={driverCopy}
        language={language}
        onLocate={onLocate}
        onReport={onReport}
        voice={voice}
        onVoice={onVoice}
      />
      {averageTrip && (
        <View style={p.averageCard}>
          <TypeIcon type="average_speed" />
          <View>
            <Text maxFontSizeMultiplier={1.35} style={p.rowTitle}>{copy.average}</Text>
            <Text maxFontSizeMultiplier={1.35}>
              {displaySpeed(averageTrip.average, units)}{" "}
              {units === "imperial" ? copy.mph : driverCopy.unit} ·{" "}
              {displayDistance(averageTrip.remaining, units, copy)}
            </Text>
          </View>
        </View>
      )}
      <View style={p.warningActions}>
        <Pressable
          onPress={onStop}
          style={[p.darkControl, { backgroundColor: "#e8ecf2" }]}
        >
          <Text maxFontSizeMultiplier={1.35}>{stopLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onReport}
          style={[p.blueButton, { flex: 1, marginTop: 0 }]}
        >
          <Icon name="plus" color="#fff" />
          <Text maxFontSizeMultiplier={1.35} style={p.buttonText}>{reportLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
export function CountryDetails({
  dark,
  footer,
  entry,
  feed,
  copy,
  ui,
  driverCopy,
  language,
  version,
  size,
  date,
  progress,
  onDownload,
  onClose,
  busy,
}) {
  const p = themeStyles(premiumStyles, dark);
  const metrics = countryMetrics(entry, feed),
    counts = typeCounts(feed, entry);
  const labels = {
    speed_camera: copy.speed,
    red_light_camera: copy.red,
    average_speed: copy.average,
    combined: copy.combined,
    mobile_control: driverCopy.mobile,
    other: copy.other,
  };
  const ratio = progress?.total
    ? Math.min(1, progress.loaded / progress.total)
    : null;
  const eta =
    progress?.phase === "download" && ratio > 0 && progress.seconds > 1
      ? Math.round(progress.seconds * (1 / ratio - 1))
      : null;
  return (
    <SafeAreaView style={p.detailSafe}>
      <ScrollView contentContainerStyle={p.detailContent}>
        <Pressable accessibilityRole="button" onPress={onClose} style={p.back}>
          <Icon name="chevron-left" color="#007aff" />
          <Text maxFontSizeMultiplier={1.35} style={p.blue}>{ui.countries}</Text>
        </Pressable>
        <View style={p.flagHero}>
          <Text maxFontSizeMultiplier={1.35} style={p.flag}>{entry?.label?.split(" ")[0]}</Text>
          <Text maxFontSizeMultiplier={1.35} style={p.countryName}>
            {entry?.label?.split(" ").slice(1).join(" ")}
          </Text>
        </View>
        <View style={p.metrics}>
          {[
            [copy.found, metrics.found],
            [copy.published, metrics.published],
            [copy.candidates, metrics.candidates],
          ].map(([label, value]) => (
            <View key={label} style={p.metric}>
              <Text maxFontSizeMultiplier={1.35} style={p.metricValue}>
                {value == null ? "—" : value.toLocaleString(language)}
              </Text>
              <Text maxFontSizeMultiplier={1.35} style={p.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>
        {(metrics.found == null || metrics.candidates == null) && (
          <Text maxFontSizeMultiplier={1.35} style={p.unavailable}>
            {copy.noMetric}: {copy.found.toLowerCase()},{" "}
            {copy.candidates.toLowerCase()}
          </Text>
        )}
        {busy && progress ? (
          <View style={p.downloadCard}>
            <Text maxFontSizeMultiplier={1.35} style={p.rowTitle}>
              {progress.phase === "verify" ? copy.checking : copy.loading}
            </Text>
            <View style={p.progressRow}>
              <View style={p.progressTrack}>
                <View
                  style={[
                    p.progressFill,
                    { width: ratio == null ? "12%" : `${ratio * 100}%` },
                  ]}
                />
              </View>
              <Text maxFontSizeMultiplier={1.35} style={p.rowTitle}>
                {ratio == null ? "…" : `${Math.floor(ratio * 100)}%`}
              </Text>
            </View>
            <Text maxFontSizeMultiplier={1.35} style={p.muted}>
              {(progress.loaded / 1e6).toLocaleString(language, {
                maximumFractionDigits: 2,
              })}{" "}
              MB
              {progress.total
                ? ` / ${(progress.total / 1e6).toLocaleString(language, { maximumFractionDigits: 2 })} MB`
                : ""}
              {eta != null ? ` · ${copy.left}: ${eta}s` : ""}
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onDownload}
            style={[p.blueButton, feed && { backgroundColor: "#eaf3ff" }]}
          >
            <Icon
              name={feed ? "check-circle" : "download-cloud"}
              color={feed ? "#007aff" : "#fff"}
            />
            <Text maxFontSizeMultiplier={1.35} style={[p.buttonText, feed && { color: "#007aff" }]}>
              {feed ? copy.offline : copy.download}
            </Text>
            {feed && <Icon name="refresh-cw" color="#007aff" size={18} />}
          </Pressable>
        )}
        {progress?.phase === "failed" && <Text maxFontSizeMultiplier={1.35} accessibilityLiveRegion="polite" style={{color:"#d92d20"}}>{copy.failed}</Text>}
        <View style={p.whiteCard}>
          {[
            [
              ui.fileSize,
              size
                ? `${(size / 1e6).toLocaleString(language, { maximumFractionDigits: 2 })} MB`
                : copy.noMetric,
              "hard-drive",
            ],
            [copy.version, version || copy.noMetric, "layers"],
            [ui.updated, date, "clock"],
            [
              copy.published,
              metrics.published?.toLocaleString(language) || "—",
              "camera",
            ],
          ].map(([label, value, icon]) => (
            <View style={p.detailRow} key={label}>
              <Icon name={icon} size={18} />
              <Text maxFontSizeMultiplier={1.35} style={p.detailLabel}>{label}</Text>
              <Text maxFontSizeMultiplier={1.35} style={p.detailValue}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={p.whiteCard}>
          <Text maxFontSizeMultiplier={1.35} style={p.section}>{copy.types}</Text>
          {FILTER_TYPES.map((type) => (
            <View key={type} style={p.detailRow}>
              <TypeIcon type={type} />
              <Text maxFontSizeMultiplier={1.35} style={p.detailLabel}>{labels[type] || copy.other}</Text>
              <Text maxFontSizeMultiplier={1.35} style={p.detailValue}>{counts?.[type] ?? "—"}</Text>
            </View>
          ))}
        </View>
        <View style={p.downloadCard}>
          <Icon name="wifi-off" color="#007aff" />
          <Text maxFontSizeMultiplier={1.35} style={p.muted}>{driverCopy.maps}</Text>
        </View>
      </ScrollView>
      {footer}
    </SafeAreaView>
  );
}
export function Filters({
  dark,
  copy,
  driverCopy,
  filters,
  onFilters,
  voice,
  onVoice,
  vibration,
  onVibration,
  showLimits,
  onLimits,
  onClose,
}) {
  const p = themeStyles(premiumStyles, dark);
  const labels = {
    speed_camera: copy.speed,
    red_light_camera: copy.red,
    average_speed: copy.average,
    combined: copy.combined,
    mobile_control: driverCopy.mobile,
    other: copy.other,
  };
  return (
    <SafeAreaView style={p.detailSafe}>
      <ScrollView contentContainerStyle={p.detailContent}>
        <View style={p.sheetHeader}>
          <Text maxFontSizeMultiplier={1.35} style={p.sheetTitle}>{copy.filters}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={p.close}
          >
            <Icon name="x" size={24} />
          </Pressable>
        </View>
        <View style={p.whiteCard}>
          {FILTER_TYPES.map((type) => (
            <View key={type} style={p.filterRow}>
              <TypeIcon type={type} />
              <Text maxFontSizeMultiplier={1.35} style={p.detailLabel}>{labels[type]}</Text>
              <Switch
                accessibilityLabel={labels[type]}
                trackColor={{ true: "#007aff" }}
                value={filters[type] !== false}
                onValueChange={(v) => onFilters({ ...filters, [type]: v })}
              />
            </View>
          ))}
        </View>
        <Text maxFontSizeMultiplier={1.35} style={p.muted}>{copy.mapOnly}</Text>
        <View style={p.whiteCard}>
          {[
            [copy.limits, showLimits, onLimits, "eye"],
            [copy.voice, voice, onVoice, "volume-2"],
            [copy.vibration, vibration, onVibration, "smartphone"],
          ].map(([label, value, onValueChange, icon]) => (
            <View key={label} style={p.filterRow}>
              <Icon name={icon} color="#007aff" />
              <Text maxFontSizeMultiplier={1.35} style={p.detailLabel}>{label}</Text>
              <Switch
                accessibilityLabel={label}
                value={value}
                onValueChange={onValueChange}
                trackColor={{ true: "#007aff" }}
              />
            </View>
          ))}
        </View>
        <Pressable onPress={onClose} style={p.blueButton}>
          <Icon name="check" color="#fff" />
          <Text maxFontSizeMultiplier={1.35} style={p.buttonText}>{copy.save || "Сохранить"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const premiumStyles = StyleSheet.create({
  fill: { flex: 1 },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "#06101f22" },
  heroContent: { flex: 1, padding: 26, justifyContent: "space-between" },
  heroTitle: { alignItems: "center", paddingTop: 54, gap: 12 },
  appIcon: { width: 100, height: 100, borderRadius: 25 },
  heroName: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    textAlign: "center",
    textShadowColor: "#0005",
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 2 },
  },
  heroSubtitle: { color: "#fff", fontSize: 18 },
  heroBottom: {
    gap: 18,
    padding: 20,
    borderRadius: 26,
    backgroundColor: "#0a1724b8",
    marginBottom: 18,
  },
  feature: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureText: { color: "#fff", fontSize: 16 },
  blueButton: {
    backgroundColor: "#007aff",
    borderRadius: 18,
    minHeight: 56,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 14,
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  white: { color: "#fff", fontSize: 16 },
  warningFrame: {
    flex: 1,
    minHeight: 510,
    borderRadius: 26,
    overflow: "hidden",
    padding: 22,
    justifyContent: "space-between",
  },
  nightShade: { ...StyleSheet.absoluteFill, backgroundColor: "#02091377" },
  warningTop: { flexDirection: "row", alignItems: "center", gap: 18 },
  limit: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: "#ff3b30",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  limitNumber: { fontSize: 34, fontWeight: "800", color: "#101828" },
  warningSpeed: { fontSize: 48, fontWeight: "800", color: "#fff" },
  darkControl: {
    minWidth: 54,
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#ffffff24",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  warningCenter: { alignItems: "center", gap: 10, paddingVertical: 12 },
  pulseFrame: {
    width: 156,
    height: 156,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
  },
  cameraDisc: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  warningCaption: { fontSize: 23, fontWeight: "700", color: "#fff" },
  warningDistance: {
    fontSize: 56,
    fontWeight: "800",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  warningType: { fontSize: 17, color: "#fff" },
  slow: { fontSize: 18, fontWeight: "700", color: "#ffb4a5" },
  roadName: { fontSize: 15, color: "#e3e9f0", textAlign: "center" },
  direction: { fontSize: 12, color: "#c3ccd9" },
  warningActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  trip: { gap: 14 },
  driveTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  driveSpeed: {
    fontSize: 64,
    fontWeight: "800",
    color: "#101828",
    lineHeight: 72,
  },
  gpsDisc: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: "#eaf3ff",
    alignItems: "center",
    justifyContent: "center",
  },
  country: { fontSize: 13, fontWeight: "700", color: "#344054" },
  gps: { fontSize: 12, color: "#21966c" },
  muted: { fontSize: 12, color: "#667085", lineHeight: 18 },
  tripMap: { flex: 1 },
  averageCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  detailSafe: { flex: 1, backgroundColor: "#f5f6f9" },
  detailContent: { padding: 16, gap: 10, paddingBottom: 24 },
  back: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  blue: { color: "#007aff", fontSize: 17 },
  flagHero: { alignItems: "center", gap: 6, paddingVertical: 4 },
  flag: {color: "#101828",  fontSize: 54 },
  countryName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#101828",
    textAlign: "center",
  },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { fontSize: 27, fontWeight: "800", color: "#101828" },
  metricLabel: { fontSize: 11, color: "#667085", marginTop: 5 },
  unavailable: { fontSize: 11, color: "#8a94a2", textAlign: "center" },
  whiteCard: { backgroundColor: "#fff", borderRadius: 20, padding: 12 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 38,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eef1f5",
  },
  detailLabel: { flex: 1, fontSize: 14, color: "#344054" },
  detailValue: {
    fontSize: 13,
    color: "#667085",
    maxWidth: "48%",
    textAlign: "right",
  },
  section: {color: "#101828",  fontSize: 18, fontWeight: "800", marginBottom: 10 },
  rowTitle: { fontSize: 16, fontWeight: "700", color: "#101828" },
  downloadCard: {
    padding: 18,
    backgroundColor: "#eaf3ff",
    borderRadius: 20,
    gap: 12,
  },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressTrack: {
    height: 10,
    backgroundColor: "#d6e4f8",
    borderRadius: 5,
    flex: 1,
    overflow: "hidden",
  },
  progressFill: { height: 10, backgroundColor: "#007aff", borderRadius: 5 },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {color: "#101828",  fontSize: 28, fontWeight: "800" },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
  },
});

const p = premiumStyles;
