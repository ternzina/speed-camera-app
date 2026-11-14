import React from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { premiumCopy, statusLines } from "./premium-copy.js";

const MANAGE_URL = "https://apps.apple.com/account/subscriptions";

export function openSubscriptionManagement() {
  return Linking.openURL(MANAGE_URL);
}

export default function PremiumManageScreen({ language = "ru", entitlement, onRestore, onBack, busy = false, notice = "" }) {
  const copy = premiumCopy(language);
  const card = statusLines(entitlement, language);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backHit}>
        <Text style={styles.back}>{copy.back}</Text>
      </Pressable>
      <Text style={styles.title}>{card?.title || copy.mySubscription}</Text>
      {(card?.lines || []).map(line => <Text key={line} style={styles.note}>{line}</Text>)}
      {notice ? <Text style={styles.note}>{notice}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={onRestore} style={styles.button}>
        {busy ? <ActivityIndicator color="#E7EEF6" /> : <Text style={styles.buttonText}>{copy.restore}</Text>}
      </Pressable>
      {busy ? <Text style={styles.note}>{copy.checking}</Text> : null}
      {card?.manage === true ? (
        <Pressable accessibilityRole="button" onPress={openSubscriptionManagement} style={styles.button}>
          <Text style={styles.buttonText}>{copy.manage}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#071525" },
  content: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 28, gap: 14 },
  backHit: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingRight: 12 },
  back: { color: "#E7EEF6", fontSize: 17, fontWeight: "700" },
  title: { color: "#E7EEF6", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  note: { color: "#E7EEF6", fontSize: 16, lineHeight: 22 },
  button: { minHeight: 48, borderRadius: 14, backgroundColor: "#10263B", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#E7EEF6", fontSize: 16, fontWeight: "700" },
});
