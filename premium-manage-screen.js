import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { premiumCopy } from "./premium-copy.js";
import { renewalDescription } from "./premium-access.js";

const MANAGE_URL = "https://apps.apple.com/account/subscriptions";

export function openSubscriptionManagement() {
  return Linking.openURL(MANAGE_URL);
}

export default function PremiumManageScreen({ language = "ru", entitlement, onRestore, onBack }) {
  const copy = premiumCopy(language);
  const renew = renewalDescription({
    productId: entitlement?.productId,
    trial: entitlement?.trial,
    renewsAt: entitlement?.expiresAt,
    cancelled: entitlement?.cancelled,
  });
  const when = renew.renewsAt ? new Date(renew.renewsAt).toLocaleDateString() : "";
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.back}>{copy.back}</Text></Pressable>
      <Text style={styles.title}>{copy.manage}</Text>
      <Text style={styles.note}>{entitlement?.trial ? copy.trialEnds : copy.access}</Text>
      {when ? <Text style={styles.date}>{when}</Text> : null}
      <Text style={styles.note}>{renew.renews ? copy.afterTrial : copy.noRenew}</Text>
      <Text style={styles.note}>{copy.charge}</Text>
      <Pressable accessibilityRole="button" onPress={onRestore} style={styles.button}>
        <Text style={styles.buttonText}>{copy.restore}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={openSubscriptionManagement} style={styles.button}>
        <Text style={styles.buttonText}>{copy.manage}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#071525" },
  content: { padding: 22, gap: 14 },
  back: { color: "#E7EEF6", fontSize: 17, fontWeight: "700" },
  title: { color: "#E7EEF6", fontSize: 32, fontWeight: "800" },
  note: { color: "#9BB0C7", fontSize: 16, lineHeight: 22 },
  date: { color: "#F5B64C", fontSize: 22, fontWeight: "800" },
  button: { minHeight: 48, borderRadius: 14, backgroundColor: "#10263B", alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#E7EEF6", fontSize: 16, fontWeight: "700" },
});
