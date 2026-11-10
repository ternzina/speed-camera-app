import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import {
  NEARBY_CATEGORIES, formatNearbyDistance, nearbyCategory, nearbyCopy, nearbyFix, nearbyPlaces,
} from "./google-places";
import { readPlacesKey } from "./google-places-key";

export default function NavtestNearby({ language, coords, permission, onGo }) {
  const copy = nearbyCopy(language);
  const [categoryId, setCategoryId] = useState(null);
  const [status, setStatus] = useState("idle");
  const [places, setPlaces] = useState([]);
  const waitRef = useRef(null);
  const abortRef = useRef(null);
  const point = nearbyFix(permission, coords);

  async function search(id, origin = point) {
    abortRef.current?.abort();
    if (!nearbyCategory(id)) return;
    if (!origin.ok && origin.reason === "denied") {
      waitRef.current = null;
      setPlaces([]);
      setStatus("denied");
      return;
    }
    if (!origin.ok) {
      waitRef.current = id;
      setPlaces([]);
      setStatus("loading");
      return;
    }
    waitRef.current = null;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    try {
      const found = await nearbyPlaces({
        categoryId: id,
        latitude: origin.latitude,
        longitude: origin.longitude,
        languageCode: language,
        key: readPlacesKey(),
        fetch: global.fetch.bind(global),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setPlaces(found);
      setStatus(found.length ? "ready" : "empty");
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") return;
      setPlaces([]);
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!waitRef.current) return undefined;
    if (!point.ok && point.reason === "denied") {
      waitRef.current = null;
      setPlaces([]);
      setStatus("denied");
      return undefined;
    }
    if (!point.ok) return undefined;
    const id = waitRef.current;
    waitRef.current = null;
    search(id, point);
    return undefined;
  }, [point.ok, point.reason, point.latitude, point.longitude, permission]);

  useEffect(() => () => abortRef.current?.abort(), []);

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
              onPress={() => { setCategoryId(category.id); search(category.id); }}
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
      {status === "error" && (
        <View style={styles.note}>
          <Text maxFontSizeMultiplier={1.4} style={styles.noteText}>{copy.error}</Text>
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
      {status === "ready" && places.map(place => (
        <View key={place.id} style={styles.card}>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={styles.name}>{place.name}</Text>
          {!!place.address && <Text numberOfLines={2} maxFontSizeMultiplier={1.4} style={styles.address}>{place.address}</Text>}
          <Text maxFontSizeMultiplier={1.3} style={styles.meta}>
            {formatNearbyDistance(place.distance, language)}
            {place.rating != null ? ` · ${place.rating}` : ""}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => onGo?.(place)} style={styles.go}>
            <Text maxFontSizeMultiplier={1.3} style={styles.goText}>{copy.go}</Text>
          </Pressable>
        </View>
      ))}
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
  go: { marginTop: 6, minHeight: 44, borderRadius: 14, backgroundColor: "#1260E8", alignItems: "center", justifyContent: "center" },
  goText: { color: "#fff", fontWeight: "800" },
};
