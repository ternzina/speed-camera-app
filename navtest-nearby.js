import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import {
  NEARBY_CATEGORIES, createNearbyController, formatNearbyDistance, nearbyCategory, nearbyCopy,
} from "./google-places";
import { readPlacesKey } from "./google-places-key";
import { savedPlaceCopy } from "./navtest-saved-places";

async function readNearbyFix() {
  const current = await Location.getForegroundPermissionsAsync();
  let status = current.status;
  if (status !== "granted" && current.canAskAgain !== false) {
    status = (await Location.requestForegroundPermissionsAsync()).status;
  }
  if (status !== "granted") return { permission: status === "denied" ? "denied" : status };
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return {
    permission: "granted",
    latitude: position?.coords?.latitude,
    longitude: position?.coords?.longitude,
  };
}

export default function NavtestNearby({ language, coords, permission, onGo, onKind, onFavorite }) {
  const copy = nearbyCopy(language);
  const savedCopy = savedPlaceCopy(language);
  const [categoryId, setCategoryId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [places, setPlaces] = useState([]);
  const requests = useRef(null);
  if (!requests.current) requests.current = createNearbyController();

  function choose(id) {
    setCategoryId(id);
    onKind?.(id);
    if (!nearbyCategory(id)?.types?.length) {
      requests.current.stop();
      setPlaces([]);
      setStatus("cameras");
      return;
    }
    search(id);
  }

  async function search(id) {
    if (!nearbyCategory(id)?.types?.length) return;
    setPlaces([]);
    setStatus("loading");
    const result = await requests.current.search({
      categoryId: id,
      permission,
      coords,
      languageCode: language,
      key: readPlacesKey(),
      fetch: global.fetch.bind(global),
      locate: readNearbyFix,
    });
    if (result.status === "stale") return;
    setPlaces(result.places);
    setStatus(result.status);
  }

  useEffect(() => () => requests.current?.stop(), []);

  return (
    <View style={styles.screen}>
      <View style={styles.grid}>
        {NEARBY_CATEGORIES.map(category => {
          const selected = category.id === categoryId;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => choose(category.id)}
              style={[styles.category, selected && styles.categoryOn]}
            >
              <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={[styles.categoryText, selected && styles.categoryTextOn]}>{copy[category.id]}</Text>
            </Pressable>
          );
        })}
      </View>
      {status === "loading" && (
        <View style={styles.note}>
          <ActivityIndicator />
          <Text maxFontSizeMultiplier={1.4} style={styles.noteText}>{copy.loading}</Text>
        </View>
      )}
      {status === "empty" && <Text maxFontSizeMultiplier={1.4} style={styles.noteText}>{copy.empty}</Text>}
      {(status === "error" || status === "timeout") && (
        <View style={styles.note}>
          <Text maxFontSizeMultiplier={1.4} style={styles.noteText}>{status === "timeout" ? copy.timeout : copy.error}</Text>
          <Pressable accessibilityRole="button" onPress={() => search(categoryId)} style={styles.retry}>
            <Text maxFontSizeMultiplier={1.3} style={styles.retryText}>{copy.retry}</Text>
          </Pressable>
        </View>
      )}
      {status === "denied" && (
        <View style={styles.note}>
          <Text maxFontSizeMultiplier={1.4} style={styles.noteText}>{copy.denied}</Text>
          <Pressable accessibilityRole="button" onPress={() => Linking.openSettings().catch(() => {})} style={styles.retry}>
            <Text maxFontSizeMultiplier={1.3} style={styles.retryText}>{copy.settings}</Text>
          </Pressable>
        </View>
      )}
      {status === "ready" && places.map(place => {
        const distanceLabel = formatNearbyDistance(place.distance, language);
        return (
        <View key={place.id} style={styles.card}>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={styles.name}>{place.name}</Text>
          {!!place.address && <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={styles.address}>{place.address}</Text>}
          {!!distanceLabel && <Text maxFontSizeMultiplier={1.3} style={styles.meta}>{distanceLabel}</Text>}
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={savedCopy.favorite} onPress={() => onFavorite?.(place)} style={styles.heart}>
              <Text maxFontSizeMultiplier={1.3} style={styles.heartGlyph}>♡</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => onGo?.(place)} style={styles.go}>
              <Text maxFontSizeMultiplier={1.3} style={styles.goText}>{copy.go}</Text>
            </Pressable>
          </View>
        </View>
        );
      })}
    </View>
  );
}

const styles = {
  screen: { gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  category: {
    width: "31.5%", minHeight: 72, borderRadius: 16, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e4e8ed", alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6, paddingVertical: 8,
  },
  categoryOn: { backgroundColor: "#10263B", borderColor: "#10263B" },
  categoryText: { fontSize: 13, lineHeight: 17, fontWeight: "800", color: "#10263B", textAlign: "center" },
  categoryTextOn: { color: "#fff" },
  note: { gap: 8, alignItems: "flex-start" },
  noteText: { fontSize: 15, lineHeight: 21, color: "#526A80" },
  retry: { minHeight: 44, borderRadius: 14, backgroundColor: "#10263B", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  retryText: { color: "#fff", fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 14, gap: 4, borderWidth: 1, borderColor: "#e4e8ed" },
  name: { fontSize: 16, lineHeight: 21, fontWeight: "800", color: "#10263B" },
  address: { fontSize: 13, lineHeight: 18, color: "#526A80" },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: "#10263B" },
  actions: { marginTop: 6, flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 8 },
  heart: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: "#e4e8ed", alignItems: "center", justifyContent: "center" },
  heartGlyph: { fontSize: 18, color: "#9A3412" },
  go: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: "#1260E8", alignItems: "center", justifyContent: "center" },
  goText: { color: "#fff", fontWeight: "800" },
};
