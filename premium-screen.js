import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PREMIUM_PLANS, storePriceLabel } from "./premium-catalog.js";
import { premiumCopy } from "./premium-copy.js";
import { renewalDescription } from "./premium-access.js";

const INK = "#E7EEF6";
const MUTED = "#9BB0C7";
const NIGHT = "#071525";
const CARD = "#10263B";
const LINE = "#1E3D5C";
const YEAR = "#F5B64C";
const ACTION = "#1260E8";

export default function PremiumScreen({
  language = "ru",
  prices = {},
  selectedId = "camalert_premium_yearly",
  onSelect,
  onContinue,
  onRestore,
  onManage,
  onTerms,
  onPrivacy,
  onBack,
  renewal,
  status,
  legacy,
}) {
  const copy = premiumCopy(language);
  const selected = PREMIUM_PLANS.find(plan => plan.id === selectedId) || PREMIUM_PLANS[2];
  const renew = renewalDescription({
    productId: selected.id,
    trial: renewal?.trial,
    renewsAt: renewal?.renewsAt,
    cancelled: renewal?.cancelled,
  });
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {onBack ? <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.link}>{copy.back}</Text></Pressable> : null}
      <Text style={styles.kicker}>CamAlert</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.lead}>{copy.lead}</Text>
      <View style={styles.benefits}>
        {copy.benefits.map(item => (
          <Text key={item} style={styles.benefit}>{item}</Text>
        ))}
      </View>
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
              <View style={styles.planMain}>
                <Text style={styles.period}>{copy.periods[plan.period]}</Text>
                {plan.highlighted ? <Text style={styles.yearMark}>{copy.highlighted}</Text> : null}
              </View>
              <Text style={styles.price}>{price || copy.priceWait}</Text>
            </Pressable>
          );
        })}
      </View>
      {legacy ? <Text style={styles.note}>{copy.legacy}</Text> : null}
      {status ? <Text style={styles.note}>{status}</Text> : null}
      {selected.id === "camalert_premium_yearly" ? <Text style={styles.note}>{copy.trial}</Text> : null}
      <Text style={styles.note}>{copy.charge}</Text>
      <Text style={styles.note}>
        {renew.renews ? copy.nextCharge : copy.noRenew}
        {renew.renewsAt ? ` · ${new Date(renew.renewsAt).toLocaleDateString()}` : ""}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => onContinue?.(selected.id)} style={styles.continue}>
        <Text style={styles.continueText}>{copy.continue}</Text>
      </Pressable>
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
  content: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 36, gap: 14 },
  kicker: { color: YEAR, fontSize: 15, fontWeight: "700" },
  title: { color: INK, fontSize: 34, lineHeight: 40, fontWeight: "800" },
  lead: { color: MUTED, fontSize: 17, lineHeight: 24 },
  benefits: { gap: 8, paddingVertical: 4 },
  benefit: { color: INK, fontSize: 16, lineHeight: 22 },
  plans: { gap: 8 },
  plan: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  planYear: { borderColor: YEAR },
  planOn: { backgroundColor: "#17324E" },
  planMain: { flexGrow: 1, flexShrink: 1, gap: 2 },
  period: { color: INK, fontSize: 18, fontWeight: "700" },
  yearMark: { color: YEAR, fontSize: 13, fontWeight: "700" },
  price: { color: INK, fontSize: 16, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  note: { color: MUTED, fontSize: 14, lineHeight: 20 },
  continue: { backgroundColor: ACTION, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  continueText: { color: "#FFFFFF", fontSize: 18, fontWeight: "800" },
  linkHit: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  link: { color: INK, fontSize: 16, fontWeight: "700" },
  legal: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  legalText: { color: MUTED, fontSize: 13 },
});
