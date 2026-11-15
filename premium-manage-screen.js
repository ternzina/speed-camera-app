import React, { useState } from "react";
import { ActivityIndicator, Linking, NativeModules, Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { premiumCopy, statusLines } from "./premium-copy.js";

const MANAGE_URL = "https://apps.apple.com/account/subscriptions";

export async function openSubscriptionManagement() {
  if (Platform.OS !== "ios") return Linking.openURL(MANAGE_URL);
  const native = NativeModules.CamAlertPremiumStore;
  if (!native?.showManageSubscriptions) return "unavailable";
  try {
    const result = await native.showManageSubscriptions();
    if (result === "shown" || result === "unavailable") return result;
    return "failed";
  } catch {
    return "failed";
  }
}

export default function PremiumManageScreen({ language = "ru", entitlement, onRestore, onBack, busy = false, notice = "" }) {
  const copy = premiumCopy(language);
  const card = statusLines(entitlement, language);
  const [manageNotice, setManageNotice] = useState("");
  async function onManage() {
    setManageNotice("");
    try {
      const result = await openSubscriptionManagement();
      if (result === "unavailable" || result === "failed") setManageNotice(copy.manageUnavailable);
    } catch {
      if (Platform.OS === "ios") setManageNotice(copy.manageUnavailable);
    }
  }
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backHit}>
        <Text style={styles.back}>{copy.back}</Text>
      </Pressable>
      <Text style={styles.title}>{card?.title || copy.mySubscription}</Text>
      {(card?.lines || []).map(line => <Text key={line} style={styles.note}>{line}</Text>)}
      {notice ? <Text style={styles.note}>{notice}</Text> : null}
      {manageNotice ? <Text style={styles.note}>{manageNotice}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={onRestore} style={styles.button}>
        {busy ? <ActivityIndicator color="#E7EEF6" /> : <Text style={styles.buttonText}>{copy.restore}</Text>}
      </Pressable>
      {busy ? <Text style={styles.note}>{copy.checking}</Text> : null}
      {card?.manage === true ? (
        <Pressable accessibilityRole="button" onPress={onManage} style={styles.button}>
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
