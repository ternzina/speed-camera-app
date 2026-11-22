import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import SystemSafeArea from "./system-safe-area";
import { backgroundModeStatus, locationPermissionCopy } from "./location-permission";

export default function LocationPermissionScreen({
  language = "ru",
  launch = false,
  voiceReady = "",
  backgroundOn = false,
  onBack,
  onContinue,
  onEnableBackground,
}) {
  const copy = locationPermissionCopy(language);
  const backgroundStatus = backgroundModeStatus(language, backgroundOn);
  const primary = voiceReady && launch ? copy.next : copy.continue;
  const { fontScale, width, height } = useWindowDimensions();
  const compact = width < 360 || height < 700 || fontScale > 1.15;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SystemSafeArea style={styles.safe}>
        <View style={styles.topbar}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={onBack} style={styles.back}>
            <View style={styles.backArrow} />
            <Text maxFontSizeMultiplier={1.3} style={styles.backText}>{copy.back}</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, compact && styles.contentCompact]} showsVerticalScrollIndicator={false}>
          <Text maxFontSizeMultiplier={1.15} style={styles.brand}>{copy.brandLead}<Text style={styles.cyan}>{copy.brandAccent}</Text></Text>
          <Text maxFontSizeMultiplier={1.4} style={[styles.title, compact && styles.titleCompact]}>{copy.title}</Text>
          <Text maxFontSizeMultiplier={1.4} style={styles.body}>{copy.body}</Text>
          <Text maxFontSizeMultiplier={1.4} style={styles.status}>{backgroundStatus}</Text>
          {!!voiceReady && <Text maxFontSizeMultiplier={1.4} style={styles.ready}>{voiceReady}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          {!!onEnableBackground && !backgroundOn && (
            <Pressable accessibilityRole="button" onPress={onEnableBackground} style={styles.backgroundButton}>
              <Text maxFontSizeMultiplier={1.3} style={styles.backgroundText}>{copy.enableBackground}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={onContinue} style={styles.continueButton}>
            <Text maxFontSizeMultiplier={1.3} style={styles.continueText}>{primary}</Text>
          </Pressable>
        </View>
      </SystemSafeArea>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#071525" },
  safe: { flex: 1 },
  topbar: { minHeight: 44, marginHorizontal: 20, justifyContent: "center" },
  back: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, backgroundColor: "rgba(7,21,37,0.65)", flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  backArrow: { width: 12, height: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: "#FFF", transform: [{ rotate: "45deg" }], marginRight: 8 },
  backText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, paddingBottom: 12, gap: 14 },
  contentCompact: { justifyContent: "flex-start", paddingTop: 8, gap: 10 },
  brand: { color: "#FFF", fontSize: 32, fontWeight: "900", letterSpacing: -1.3 },
  cyan: { color: "#23D3EF" },
  title: { color: "#FFF", fontSize: 28, lineHeight: 34, fontWeight: "800" },
  titleCompact: { fontSize: 24, lineHeight: 30 },
  body: { color: "#B8C8DA", fontSize: 17, lineHeight: 23 },
  status: { color: "#FFF", fontSize: 16, lineHeight: 22, fontWeight: "700" },
  ready: { color: "#8EEAFF", fontSize: 16, lineHeight: 22, fontWeight: "800" },
  footer: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12, gap: 8, backgroundColor: "#071525" },
  backgroundButton: { minHeight: 56, borderRadius: 21, backgroundColor: "#1260E8", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backgroundText: { color: "#FFF", fontSize: 20, fontWeight: "700", textAlign: "center" },
  continueButton: { minHeight: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  continueText: { color: "#8EEAFF", fontSize: 17, fontWeight: "700", textAlign: "center" },
});
