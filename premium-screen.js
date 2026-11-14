import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PREMIUM_PLANS, storePriceLabel } from "./premium-catalog.js";
import { premiumCopy, selectedPlanTerms } from "./premium-copy.js";

const INK = "#E7EEF6";
const MUTED = "#9BB0C7";
const NIGHT = "#071525";
const CARD = "#10263B";
const LINE = "#1E3D5C";
const YEAR = "#F5B64C";
const ACTION = "#1260E8";

export function PremiumEntryCard({ language = "ru", night = true, onPress }) {
  const copy = premiumCopy(language);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.open}. ${copy.cardSubtitle}`}
      onPress={onPress}
      style={[styles.entry, night ? styles.entryNight : styles.entryDay]}
    >
      <View style={styles.entryMark}>
        <Text style={styles.entryStar}>★</Text>
      </View>
      <View style={styles.entryCopy}>
        <Text maxFontSizeMultiplier={1.3} style={styles.entryTitle}>{copy.open}</Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.entrySub}>{copy.cardSubtitle}</Text>
      </View>
      <Text style={styles.entryArrow}>›</Text>
    </Pressable>
  );
}

export default function PremiumScreen({
  language = "ru",
  prices = {},
  selectedId = "camalert_premium_yearly",
  trialEligible = false,
  onSelect,
  onContinue,
  onRestore,
  onManage,
  onTerms,
  onPrivacy,
  onBack,
  status,
  legacy,
  busy = false,
  lifetimeOwned = false,
}) {
  const copy = premiumCopy(language);
  const selected = PREMIUM_PLANS.find(plan => plan.id === selectedId) || PREMIUM_PLANS[2];
  const yearlyOffer = trialEligible === true;
  const terms = selectedPlanTerms({
    period: selected.period,
    price: storePriceLabel(prices[selected.id]),
    trialEligible: selected.id === "camalert_premium_yearly" && yearlyOffer,
    copy,
  });
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backHit}>
          <Text style={styles.back}>{copy.back}</Text>
        </Pressable>
      ) : null}
      <Text maxFontSizeMultiplier={1.25} style={styles.title}>{yearlyOffer ? copy.offerTitle : copy.offerPlain}</Text>
      <Text maxFontSizeMultiplier={1.25} style={yearlyOffer ? styles.offer : styles.lead}>
        {yearlyOffer ? copy.offerSub : copy.offerPlainSub}
      </Text>
      <View style={styles.plans}>
        {PREMIUM_PLANS.map(plan => {
          const price = storePriceLabel(prices[plan.id]);
          const active = plan.id === selected.id;
          return (
            <Pressable
              key={plan.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect?.(plan.id)}
              style={[styles.plan, plan.highlighted && styles.planYear, active && styles.planOn]}
            >
              <Text maxFontSizeMultiplier={1.2} style={styles.period}>{copy.periods[plan.period]}</Text>
              <Text maxFontSizeMultiplier={1.2} style={styles.price}>{price || copy.priceWait}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || (lifetimeOwned && selected.period === "lifetime"), busy }}
        disabled={busy || (lifetimeOwned && selected.period === "lifetime")}
        onPress={() => onContinue?.(selected.id)}
        style={styles.continue}
      >
        {busy ? <ActivityIndicator color="#FFFFFF" /> : (
          <Text style={styles.continueText}>{lifetimeOwned && selected.period === "lifetime" ? copy.lifetimeActive : copy.continue}</Text>
        )}
      </Pressable>
      <Text maxFontSizeMultiplier={1.3} style={styles.terms}>{terms}</Text>
      <View style={styles.benefits}>
        {copy.benefits.map(item => (
          <Text key={item} maxFontSizeMultiplier={1.3} style={styles.benefit}>{item}</Text>
        ))}
      </View>
      {legacy ? <Text style={styles.note}>{copy.legacy}</Text> : null}
      {status ? <Text style={styles.note}>{status}</Text> : null}
      <Text style={styles.note}>{copy.charge}</Text>
      <Pressable accessibilityRole="button" onPress={onRestore} style={styles.linkHit}>
        <Text style={styles.link}>{copy.restore}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onManage} style={styles.linkHit}>
        <Text style={styles.link}>{copy.manage}</Text>
      </Pressable>
      <View style={styles.legal}>
        <Pressable accessibilityRole="link" onPress={onTerms}><Text style={styles.legalText}>{copy.terms}</Text></Pressable>
        <Pressable accessibilityRole="link" onPress={onPrivacy}><Text style={styles.legalText}>{copy.privacy}</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NIGHT },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 28, gap: 8 },
  backHit: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", paddingRight: 12 },
  back: { color: INK, fontSize: 17, fontWeight: "700" },
  title: { color: INK, fontSize: 26, lineHeight: 32, fontWeight: "800" },
  offer: { color: YEAR, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  lead: { color: MUTED, fontSize: 16, lineHeight: 22 },
  plans: { gap: 6, marginTop: 4 },
  plan: { minHeight: 46, backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: LINE, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  planYear: { borderColor: YEAR },
  planOn: { backgroundColor: "#17324E" },
  period: { color: INK, fontSize: 17, fontWeight: "700", flexShrink: 1 },
  price: { color: INK, fontSize: 16, fontWeight: "700", textAlign: "right" },
  continue: { backgroundColor: ACTION, minHeight: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 2 },
  continueText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  terms: { color: INK, fontSize: 15, lineHeight: 20, fontWeight: "600" },
  benefits: { gap: 6, paddingTop: 8 },
  benefit: { color: MUTED, fontSize: 15, lineHeight: 20 },
  note: { color: MUTED, fontSize: 14, lineHeight: 20 },
  linkHit: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  link: { color: INK, fontSize: 16, fontWeight: "700" },
  legal: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  legalText: { color: MUTED, fontSize: 13 },
  entry: { minHeight: 76, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1 },
  entryDay: { backgroundColor: "#1A3270", borderColor: "#C9A15B" },
  entryNight: { backgroundColor: "#2A2460", borderColor: "#E2B657" },
  entryMark: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(226,182,87,0.16)" },
  entryStar: { color: YEAR, fontSize: 22, lineHeight: 26 },
  entryCopy: { flex: 1, gap: 2 },
  entryTitle: { color: "#F7FBFF", fontSize: 17, fontWeight: "800" },
  entrySub: { color: "#D7E2F2", fontSize: 13, lineHeight: 18 },
  entryArrow: { color: YEAR, fontSize: 28, fontWeight: "500", marginTop: -2 },
});
