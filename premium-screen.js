import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { PREMIUM_PLANS, storePriceLabel, yearlySavingsPercent } from "./premium-catalog.js";
import { premiumCopy, selectedPlanTerms, settingsCardCopy } from "./premium-copy.js";
import { EveningRoad, SlideArt, SlideIcon } from "./premium-pro-art.js";

const INK = "#E7EEF6";
const MUTED = "#9BB0C7";
const NIGHT = "#071525";
const CARD = "#10263B";
const LINE = "#1E3D5C";
const YEAR = "#F5B64C";
const ACTION = "#1260E8";
const EVENING = "#160A24";
const GOLD = "#E4B15A";
const CREAM = "#F6EFE2";
const STAGE_MS = 4500;

export function PremiumEntryCard({ language = "ru", night = true, entitlement = null, now, onPress }) {
  const card = settingsCardCopy(entitlement, language, now);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.subtitle}`}
      onPress={onPress}
      style={[styles.entry, night ? styles.entryNight : styles.entryDay]}
    >
      <View style={styles.entryMark}>
        <Text style={styles.entryStar}>★</Text>
      </View>
      <View style={styles.entryCopy}>
        <Text maxFontSizeMultiplier={1.3} style={styles.entryTitle}>{card.title}</Text>
        <Text maxFontSizeMultiplier={1.3} style={styles.entrySub}>{card.subtitle}</Text>
      </View>
      <Text style={styles.entryArrow}>›</Text>
    </Pressable>
  );
}

export default function PremiumScreen(props) {
  if (Platform.OS === "android") return <AndroidPremiumScreen {...props} />;
  return <IosPremiumScreen {...props} />;
}

function proHeadline(title) {
  return String(title || "").replace("CamAlert PRO", "").replace(/[.\s]+/g, " ").trim();
}

function IosPremiumScreen({
  language = "ru",
  prices = {},
  selectedId = "camalert_premium_yearly",
  trialEligible = false,
  onSelect,
  onContinue,
  onRestore,
  onRedeem,
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
  const { height } = useWindowDimensions();
  const compact = height < 700;
  const slides = Array.isArray(copy.proSlides) ? copy.proSlides : [];
  const selected = PREMIUM_PLANS.find(plan => plan.id === selectedId) || PREMIUM_PLANS[2];
  const yearlyOffer = trialEligible === true;
  const selectedPrice = storePriceLabel(prices[selected.id]);
  const terms = selectedPlanTerms({
    period: selected.period,
    price: selectedPrice,
    trialEligible: selected.id === "camalert_premium_yearly" && yearlyOffer,
    copy,
  });
  const savings = yearlySavingsPercent(prices);
  const saveText = Number.isInteger(savings) && copy.savePercent ? copy.savePercent.split("{percent}").join(String(savings)) : "";
  const lockedLifetime = lifetimeOwned && selected.period === "lifetime";
  return (
    <View style={styles.evening}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.eveningContent, compact && styles.eveningCompact]} showsVerticalScrollIndicator={false}>
        <View style={styles.roadBleed}>
          <EveningRoad />
          {onBack ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.backOnRoad}>
              <Text style={styles.backGold}>{copy.back}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={1.2} style={styles.logo} accessibilityRole="header">
          CamAlert <Text style={styles.logoPro}>PRO</Text>
        </Text>
        <Text maxFontSizeMultiplier={1.2} style={[styles.headline, compact && styles.headlineCompact]}>{proHeadline(copy.proTitle)}</Text>
        <Text maxFontSizeMultiplier={1.25} style={styles.eveningLead}>{copy.proSubtitle}</Text>
        <ProStage slides={slides} compact={compact} />
        <View style={styles.plans}>
          {PREMIUM_PLANS.map(plan => {
            const price = storePriceLabel(prices[plan.id]);
            const active = plan.id === selected.id;
            const trialLine = plan.period === "year" && yearlyOffer && price
              ? selectedPlanTerms({ period: "year", price, trialEligible: true, copy })
              : "";
            return (
              <Pressable
                key={plan.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onSelect?.(plan.id)}
                style={[styles.eveningPlan, active && styles.eveningPlanOn]}
              >
                <View style={styles.planCopy}>
                  <View style={styles.planTitleRow}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.eveningPeriod}>{copy.periods[plan.period]}</Text>
                    {plan.period === "year" && saveText ? <Text maxFontSizeMultiplier={1.1} style={styles.save}>{saveText}</Text> : null}
                  </View>
                  {trialLine ? <Text maxFontSizeMultiplier={1.2} style={styles.trialLine}>{trialLine}</Text> : null}
                </View>
                <Text maxFontSizeMultiplier={1.2} style={styles.eveningPrice}>{price || copy.priceWait}</Text>
              </Pressable>
            );
          })}
        </View>
        {legacy ? <Text style={styles.eveningNote}>{copy.legacy}</Text> : null}
        {status ? <Text style={styles.eveningNote}>{status}</Text> : null}
        <Pressable accessibilityRole="button" onPress={onRestore} style={styles.linkHit}>
          <Text style={styles.eveningLink}>{copy.restore}</Text>
        </Pressable>
        {onRedeem ? (
          <Pressable accessibilityRole="button" onPress={onRedeem} style={styles.linkHit}>
            <Text style={styles.eveningLink}>{copy.redeemCode}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onManage} style={styles.linkHit}>
          <Text style={styles.eveningLink}>{copy.manage}</Text>
        </Pressable>
        <View style={styles.legal}>
          <Pressable accessibilityRole="link" onPress={onTerms}><Text style={styles.eveningLegal}>{copy.terms}</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={onPrivacy}><Text style={styles.eveningLegal}>{copy.privacy}</Text></Pressable>
        </View>
      </ScrollView>
      <View style={styles.buyBar}>
        <Text maxFontSizeMultiplier={1.2} style={styles.eveningTerms}>{terms}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || lockedLifetime, busy }}
          disabled={busy || lockedLifetime}
          onPress={() => onContinue?.(selected.id)}
          style={styles.unlock}
        >
          {busy ? <ActivityIndicator color="#2A1608" /> : (
            <Text style={styles.unlockText}>{lockedLifetime ? copy.lifetimeActive : copy.unlock}</Text>
          )}
        </Pressable>
        <Text maxFontSizeMultiplier={1.2} style={styles.charge}>{copy.charge}</Text>
      </View>
    </View>
  );
}

function ProStage({ slides, compact }) {
  const scroller = useRef(null);
  const indexRef = useRef(0);
  const dragging = useRef(false);
  const [index, setIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const count = slides.length;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (live) setReduceMotion(value === true);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", value => setReduceMotion(value === true));
    return () => {
      live = false;
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!pageWidth || reduceMotion || count < 2) return undefined;
    const timer = setInterval(() => {
      if (dragging.current) return;
      const next = (indexRef.current + 1) % count;
      indexRef.current = next;
      setIndex(next);
      scroller.current?.scrollTo({ x: next * pageWidth, animated: true });
    }, STAGE_MS);
    return () => clearInterval(timer);
  }, [pageWidth, reduceMotion, count]);

  function go(next) {
    if (!pageWidth) return;
    const bounded = Math.max(0, Math.min(count - 1, next));
    indexRef.current = bounded;
    setIndex(bounded);
    scroller.current?.scrollTo({ x: bounded * pageWidth, animated: !reduceMotion });
  }

  function settle(offset) {
    dragging.current = false;
    if (!pageWidth) return;
    go(Math.round(offset / pageWidth));
  }

  return (
    <View
      style={[styles.stageFrame, compact && styles.stageFrameCompact]}
      onLayout={event => {
        const frame = Math.round(event.nativeEvent.layout.width);
        const inner = Math.max(0, frame - (compact ? 16 : 24));
        if (inner > 0 && inner !== pageWidth) setPageWidth(inner);
      }}
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onMomentumScrollEnd={event => settle(event.nativeEvent.contentOffset.x)}
        onScrollEndDrag={event => {
          if (!event.nativeEvent.velocity?.x) settle(event.nativeEvent.contentOffset.x);
        }}
      >
        {slides.map(slide => (
          <View key={slide.id} style={{ width: pageWidth || "100%" }} accessibilityLabel={`${slide.title}. ${slide.text}`}>
            <SlideArt id={slide.id} />
            <View style={styles.slideCopy}>
              <SlideIcon id={slide.id} />
              <View style={styles.slideText}>
                <Text maxFontSizeMultiplier={1.2} style={styles.slideTitle}>{slide.title}</Text>
                <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={[styles.slideBody, pageWidth ? { width: Math.max(120, pageWidth - 64) } : null]}>{slide.text}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {slides.map((slide, dot) => (
          <Pressable
            key={slide.id}
            accessibilityRole="button"
            accessibilityState={{ selected: dot === index }}
            accessibilityLabel={slide.title}
            onPress={() => go(dot)}
            style={[styles.dot, dot === index && styles.dotOn]}
          />
        ))}
      </View>
    </View>
  );
}

function AndroidPremiumScreen({
  language = "ru",
  prices = {},
  selectedId = "camalert_premium_yearly",
  trialEligible = false,
  onSelect,
  onContinue,
  onRestore,
  onRedeem,
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
      <Text maxFontSizeMultiplier={1.25} style={styles.title}>{copy.proTitle}</Text>
      <Text maxFontSizeMultiplier={1.25} style={styles.lead}>{copy.proSubtitle}</Text>
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
          <Text style={styles.continueText}>{lifetimeOwned && selected.period === "lifetime" ? copy.lifetimeActive : copy.unlock}</Text>
        )}
      </Pressable>
      <Text maxFontSizeMultiplier={1.3} style={styles.terms}>{terms}</Text>
      <View style={styles.benefits}>
        {copy.proBenefits.map(item => (
          <Text key={item} maxFontSizeMultiplier={1.3} style={styles.benefit}>{item}</Text>
        ))}
      </View>
      {legacy ? <Text style={styles.note}>{copy.legacy}</Text> : null}
      {status ? <Text style={styles.note}>{status}</Text> : null}
      <Text style={styles.note}>{copy.charge}</Text>
      <Pressable accessibilityRole="button" onPress={onRestore} style={styles.linkHit}>
        <Text style={styles.link}>{copy.restore}</Text>
      </Pressable>
      {onRedeem ? (
        <Pressable accessibilityRole="button" onPress={onRedeem} style={styles.linkHit}>
          <Text style={styles.link}>{copy.redeemCode}</Text>
        </Pressable>
      ) : null}
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
  evening: { flex: 1, backgroundColor: EVENING },
  scroll: { flex: 1 },
  eveningContent: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 16, gap: 8 },
  roadBleed: { marginHorizontal: -20 },
  backOnRoad: { position: "absolute", top: 6, left: 16, minHeight: 44, justifyContent: "center", paddingRight: 12 },
  eveningCompact: { gap: 4 },
  backGold: { color: GOLD, fontSize: 17, fontWeight: "700" },
  logo: { color: CREAM, fontSize: 15, letterSpacing: 1.4, fontWeight: "700" },
  logoPro: { color: GOLD, fontWeight: "800" },
  headline: { color: CREAM, fontSize: 34, lineHeight: 38, fontWeight: "800" },
  headlineCompact: { fontSize: 28, lineHeight: 32 },
  eveningLead: { color: "#E4D3BE", fontSize: 15, lineHeight: 20 },
  stageFrame: { marginTop: 6, borderRadius: 18, borderWidth: 1, borderColor: "rgba(228,177,90,0.55)", backgroundColor: "#1A1028", padding: 12, gap: 10 },
  stageFrameCompact: { padding: 8, gap: 6 },
  slideCopy: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10 },
  slideText: { flex: 1, minWidth: 0, gap: 2 },
  slideTitle: { color: CREAM, fontSize: 17, fontWeight: "800" },
  slideBody: { color: "#E4D3BE", fontSize: 14, lineHeight: 18 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(246,239,226,0.35)" },
  dotOn: { width: 22, backgroundColor: GOLD },
  eveningPeriod: { color: CREAM, fontSize: 17, fontWeight: "700", flexShrink: 1 },
  eveningPrice: { color: CREAM, fontSize: 16, fontWeight: "700", textAlign: "right" },
  eveningTerms: { color: CREAM, fontSize: 14, lineHeight: 18, fontWeight: "600", textAlign: "center" },
  eveningNote: { color: "#D5C7B4", fontSize: 14, lineHeight: 20 },
  eveningLink: { color: CREAM, fontSize: 16, fontWeight: "700" },
  eveningLegal: { color: "#D5C7B4", fontSize: 13 },
  eveningPlan: { minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: "rgba(228,177,90,0.35)", backgroundColor: "#241433", paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  eveningPlanOn: { borderWidth: 2, borderColor: GOLD },
  planCopy: { flex: 1, gap: 2 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  save: { color: "#2A1608", backgroundColor: GOLD, overflow: "hidden", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, fontSize: 12, fontWeight: "800" },
  trialLine: { color: GOLD, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  buyBar: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 6, backgroundColor: "rgba(22,10,36,0.94)", borderTopWidth: 1, borderTopColor: "rgba(228,177,90,0.28)" },
  unlock: { backgroundColor: GOLD, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  unlockText: { color: "#2A1608", fontSize: 18, fontWeight: "800" },
  charge: { color: "#D5C7B4", fontSize: 12, lineHeight: 16, textAlign: "center" },
});
