import React from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { premiumCopy } from "./premium-copy.js";
import { subscriptionStatus } from "./premium-access.js";

const MANAGE_URL = "https://apps.apple.com/account/subscriptions";

export function openSubscriptionManagement() {
  return Linking.openURL(MANAGE_URL);
}

function dated(template, value) {
  if (!Number.isFinite(Number(value))) return "";
  return template.split("{date}").join(new Date(Number(value)).toLocaleDateString());
}

export function statusLines(entitlement, language, now = Date.now()) {
  const copy = premiumCopy(language);
  const status = subscriptionStatus(entitlement, now);
  if (!status) return null;
  const period = entitlement?.period && copy.periods[entitlement.period] ? copy.periods[entitlement.period] : "";
  const price = typeof entitlement?.displayPrice === "string" ? entitlement.displayPrice : "";
  if (status.code === "lifetime") {
    return {
      title: copy.lifetimeTitle,
      lines: [copy.lifetimeOnce, price].filter(Boolean),
    };
  }
  const title = {
    active: copy.statusActive,
    trial: copy.statusTrial,
    "renewal-cancelled": copy.statusRenewalCancelled,
    expired: copy.statusExpired,
    revoked: copy.statusRevoked,
  }[status.code] || "";
  const lines = [];
  if (period) lines.push(period);
  if (price) lines.push(price);
  if (status.renewsAt) lines.push(dated(copy.renewsOn, status.renewsAt));
  else if (status.endsAt && status.code !== "expired") lines.push(dated(copy.accessUntil, status.endsAt));
  else if (status.endsAt && status.code === "expired") lines.push(dated(copy.accessUntil, status.endsAt));
  return { title, lines: lines.filter(Boolean) };
}

export default function PremiumManageScreen({ language = "ru", entitlement, onRestore, onBack, busy = false, notice = "" }) {
  const copy = premiumCopy(language);
  const card = statusLines(entitlement, language);
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backHit}>
        <Text style={styles.back}>{copy.back}</Text>
      </Pressable>
      <Text style={styles.title}>{card?.title || copy.manage}</Text>
      {(card?.lines || []).map(line => <Text key={line} style={styles.note}>{line}</Text>)}
      {notice ? <Text style={styles.note}>{notice}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={onRestore} style={styles.button}>
        {busy ? <ActivityIndicator color="#E7EEF6" /> : <Text style={styles.buttonText}>{copy.restore}</Text>}
      </Pressable>
      {busy ? <Text style={styles.note}>{copy.checking}</Text> : null}
      <Pressable accessibilityRole="button" onPress={openSubscriptionManagement} style={styles.button}>
        <Text style={styles.buttonText}>{copy.manage}</Text>
      </Pressable>
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
