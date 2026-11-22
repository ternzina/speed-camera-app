import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, ImageBackground, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { PREMIUM_PLANS, storePriceLabel, yearlySavingsPercent } from "./premium-catalog.js";
import { premiumCopy, selectedPlanTerms, settingsCardCopy } from "./premium-copy.js";
import { SlideArt, SlideIcon } from "./premium-pro-art.js";
import { stagePlacement } from "./premium-stage.js";

const INK = "#E7EEF6";
const MUTED = "#9BB0C7";
const NIGHT = "#071525";
const CARD = "#10263B";
const LINE = "#1E3D5C";
const YEAR = "#F5B64C";
const ACTION = "#1260E8";
const EVENING = "#080F29";
const GOLD = "#FFC629";
const CREAM = "#F6F4F1";
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
  const compact = height < 740;
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
        <ImageBackground source={require("./assets/pro-evening-road.png")} resizeMode="cover" style={[styles.hero, compact && styles.heroCompact]} imageStyle={styles.heroImage}>
          <View style={styles.heroShade} />
          {onBack ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.backOnRoad}>
              <Text style={styles.close}>×</Text>
            </Pressable>
          ) : null}
          <View style={styles.brandLine}>
            <View style={styles.brandCamera}><View style={styles.brandLens} /></View>
            <Text maxFontSizeMultiplier={1.2} style={styles.logo} accessibilityRole="header">CamAlert</Text>
            <Text style={styles.logoPro}>PRO</Text>
          </View>
          <Text maxFontSizeMultiplier={1.2} style={[styles.headline, compact && styles.headlineCompact]}>{proHeadline(copy.proTitle)}</Text>
          <View style={styles.titleSwoosh} />
          <Text maxFontSizeMultiplier={1.25} style={styles.eveningLead}>{copy.proSubtitle}</Text>
        </ImageBackground>
        <ProStage slides={slides} compact={compact} />
        <View style={styles.plansRow}>
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
                style={[styles.eveningPlan, compact && styles.eveningPlanCompact, active && styles.eveningPlanOn, plan.period === "year" && styles.yearPlan]}
              >
                <View style={styles.planCopy}>
                  {plan.period === "year" && saveText ? <Text maxFontSizeMultiplier={1.05} numberOfLines={1} style={styles.save}>{saveText}</Text> : null}
                  <Text maxFontSizeMultiplier={1.1} numberOfLines={1} style={styles.eveningPeriod}>{copy.periods[plan.period]}</Text>
                </View>
                <Text maxFontSizeMultiplier={1.05} numberOfLines={1} adjustsFontSizeToFit style={styles.eveningPrice}>{price || copy.priceWait}</Text>
              </Pressable>
            );
          })}
        </View>
        {legacy ? <Text style={styles.eveningNote}>{copy.legacy}</Text> : null}
        {status ? <Text style={styles.eveningNote}>{status}</Text> : null}
        <Text maxFontSizeMultiplier={1.2} style={styles.eveningTerms}>{terms}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || lockedLifetime, busy }}
          disabled={busy || lockedLifetime}
          onPress={() => onContinue?.(selected.id)}
          style={[styles.unlock, compact && styles.unlockCompact]}
        >
          {busy ? <ActivityIndicator color="#2A1608" /> : (
            <Text style={styles.unlockText}>{lockedLifetime ? copy.lifetimeActive : `${copy.unlock}  ›`}</Text>
          )}
        </Pressable>
        <Text maxFontSizeMultiplier={1.2} style={styles.charge}>{copy.charge}</Text>
        <View style={styles.utilityRow}>
          <Pressable accessibilityRole="button" onPress={onRestore} style={styles.utilityLink}><Text style={[styles.utilityGlyph, compact && styles.utilityGlyphCompact]}>↻</Text><Text numberOfLines={1} style={[styles.eveningLink, compact && styles.eveningLinkCompact]}>{copy.restore}</Text></Pressable>
          {onRedeem ? <Pressable accessibilityRole="button" onPress={onRedeem} style={styles.utilityLink}><Text style={[styles.utilityGlyph, compact && styles.utilityGlyphCompact]}>◇</Text><Text numberOfLines={1} style={[styles.eveningLink, compact && styles.eveningLinkCompact]}>{copy.redeemCode}</Text></Pressable> : null}
        </View>
        <Pressable accessibilityRole="button" onPress={onManage} style={styles.manageLink}><Text style={styles.eveningLink}>{copy.manage}</Text></Pressable>
        <View style={styles.legal}>
          <Pressable accessibilityRole="link" onPress={onTerms}><Text style={styles.eveningLegal}>{copy.terms}</Text></Pressable>
          <Pressable accessibilityRole="link" onPress={onPrivacy}><Text style={styles.eveningLegal}>{copy.privacy}</Text></Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function loopedSlides(slides) {
  if (slides.length < 2) return slides;
  return [slides[slides.length - 1], ...slides, slides[0]];
}

function ProStage({ slides, compact }) {
  const scroller = useRef(null);
  const positionRef = useRef(slides.length > 1 ? 1 : 0);
  const dragging = useRef(false);
  const jumping = useRef(false);
  const resetTimer = useRef(null);
  const [page, setPage] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const cardWidth = Math.max(230, frameWidth - 62);
  const interval = cardWidth + 12;
  const count = slides.length;
  const cards = loopedSlides(slides);

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (live) setReduceMotion(value === true);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.("reduceMotionChanged", value => setReduceMotion(value === true));
    return () => {
      live = false;
      subscription?.remove?.();
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  function clearReset() {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
  }

  function recenter(fromSlot) {
    const placement = stagePlacement(count, fromSlot);
    if (placement.recenter == null || positionRef.current !== fromSlot) return;
    jumping.current = true;
    positionRef.current = placement.recenter;
    setPage(stagePlacement(count, placement.recenter).page);
    scroller.current?.scrollTo({ x: placement.recenter * interval, animated: false });
    requestAnimationFrame(() => { jumping.current = false; });
  }

  function moveTo(slot, animated) {
    if (!frameWidth) return;
    const placement = stagePlacement(count, slot);
    clearReset();
    positionRef.current = placement.slot;
    setPage(placement.page);
    scroller.current?.scrollTo({ x: placement.slot * interval, animated });
    if (placement.recenter != null) {
      const fromSlot = placement.slot;
      resetTimer.current = setTimeout(() => recenter(fromSlot), animated ? 750 : 0);
    }
  }

  useEffect(() => {
    if (!frameWidth || reduceMotion || count < 2) return undefined;
    const timer = setInterval(() => {
      if (dragging.current || jumping.current) return;
      moveTo(positionRef.current + 1, true);
    }, STAGE_MS);
    return () => clearInterval(timer);
  }, [frameWidth, interval, reduceMotion, count]);

  function settle(offset) {
    dragging.current = false;
    if (!frameWidth || jumping.current) return;
    const placement = stagePlacement(count, Math.round(offset / interval));
    clearReset();
    positionRef.current = placement.slot;
    setPage(placement.page);
    if (placement.recenter != null) recenter(placement.slot);
  }

  return (
    <View
      style={[styles.stageFrame, compact && styles.stageFrameCompact]}
      onLayout={event => setFrameWidth(Math.round(event.nativeEvent.layout.width))}
    >
      {frameWidth > 0 ? (
        <ScrollView
          key={String(interval)}
          ref={scroller}
          horizontal
          snapToInterval={interval}
          decelerationRate="fast"
          bounces={false}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: (count > 1 ? 1 : 0) * interval }}
          contentContainerStyle={{ paddingHorizontal: Math.max(0, (frameWidth - cardWidth) / 2) }}
          onScrollBeginDrag={() => { dragging.current = true; }}
          onMomentumScrollEnd={event => settle(event.nativeEvent.contentOffset.x)}
          onScrollEndDrag={event => {
            if (!event.nativeEvent.velocity?.x) settle(event.nativeEvent.contentOffset.x);
          }}
        >
          {cards.map((slide, slot) => (
            <View key={`${slot}-${slide.id}`} style={{ width: cardWidth, marginRight: 12 }} accessibilityLabel={`${slide.title}. ${slide.text}`}>
              <View style={[styles.slideCard, compact && styles.slideCardCompact]}>
                <SlideArt id={slide.id} />
                <View style={styles.slideCopy}>
                  <SlideIcon id={slide.id} />
                  <View style={styles.slideText}>
                    <Text maxFontSizeMultiplier={1.2} style={styles.slideTitle}>{slide.title}</Text>
                    <Text maxFontSizeMultiplier={1.2} numberOfLines={2} style={styles.slideBody}>{slide.text}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.dots}>
        {slides.map((slide, dot) => (
          <Pressable
            key={slide.id}
            accessibilityRole="button"
            accessibilityState={{ selected: dot === page }}
            accessibilityLabel={slide.title}
            onPress={() => moveTo(count > 1 ? dot + 1 : dot, !reduceMotion)}
            style={[styles.dot, dot === page && styles.dotOn]}
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
  eveningContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 14, gap: 7 },
  eveningCompact: { gap: 5, paddingBottom: 10 },
  hero: { height: 184, marginHorizontal: -16, paddingHorizontal: 24, alignItems: "center", justifyContent: "flex-start", overflow: "hidden" },
  heroCompact: { height: 148, paddingHorizontal: 18 },
  heroImage: { opacity: 0.95 },
  heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,10,31,0.24)" },
  backOnRoad: { position: "absolute", top: 10, left: 14, width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(245,244,255,0.45)", backgroundColor: "rgba(6,12,34,0.35)", alignItems: "center", justifyContent: "center", zIndex: 2 },
  close: { color: CREAM, fontSize: 29, lineHeight: 32, fontWeight: "300", marginTop: -2 },
  brandLine: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 15 },
  brandCamera: { width: 31, height: 28, borderRadius: 8, borderWidth: 2, borderColor: GOLD, backgroundColor: "rgba(8,15,41,0.7)", alignItems: "center", justifyContent: "center", shadowColor: GOLD, shadowOpacity: 0.55, shadowRadius: 9, elevation: 6 },
  brandLens: { width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: GOLD },
  logo: { color: CREAM, fontSize: 23, letterSpacing: 0.1, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 8 },
  logoPro: { overflow: "hidden", color: "#090E23", backgroundColor: GOLD, paddingHorizontal: 9, paddingVertical: 1, borderRadius: 14, fontSize: 18, fontWeight: "900" },
  headline: { color: "#FFE59A", fontSize: 28, lineHeight: 33, fontStyle: "italic", fontWeight: "900", textAlign: "center", marginTop: 9, textShadowColor: "rgba(255,185,59,0.8)", textShadowRadius: 14, elevation: 5 },
  headlineCompact: { fontSize: 23, lineHeight: 27, marginTop: 6 },
  titleSwoosh: { width: "65%", height: 4, borderRadius: 4, backgroundColor: GOLD, transform: [{ rotate: "-3deg" }], alignSelf: "flex-end", marginRight: 15, marginTop: -1, shadowColor: GOLD, shadowOpacity: 0.7, shadowRadius: 8 },
  eveningLead: { color: CREAM, fontSize: 14, lineHeight: 17, textAlign: "center", marginTop: 3, maxWidth: 350, textShadowColor: "#071020", textShadowRadius: 6 },
  stageFrame: { height: 190, marginHorizontal: -16, paddingVertical: 6, justifyContent: "center", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(111,48,197,0.9)", backgroundColor: "rgba(31,20,72,0.64)" },
  stageFrameCompact: { height: 160 },
  slideCard: { height: 166, borderRadius: 20, overflow: "hidden", borderWidth: 1.5, borderColor: "#FFD978", backgroundColor: "#101A3A", shadowColor: GOLD, shadowOpacity: 0.28, shadowRadius: 13, elevation: 7 },
  slideCardCompact: { height: 136 },
  slideCopy: { position: "absolute", left: 13, right: 12, bottom: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  slideText: { flex: 1, minWidth: 0, gap: 1 },
  slideTitle: { color: CREAM, fontSize: 18, lineHeight: 21, fontWeight: "900", textShadowColor: "#030916", textShadowRadius: 7 },
  slideBody: { color: CREAM, fontSize: 12, lineHeight: 14, textShadowColor: "#030916", textShadowRadius: 7 },
  dots: { position: "absolute", bottom: 3, left: 0, right: 0, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(246,244,241,0.35)" },
  dotOn: { width: 18, backgroundColor: GOLD },
  plansRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  eveningPlan: { flex: 1, minWidth: 0, height: 74, borderRadius: 15, borderWidth: 1.2, borderColor: "rgba(200,207,244,0.4)", backgroundColor: "rgba(19,28,62,0.82)", paddingHorizontal: 4, paddingVertical: 5, alignItems: "center", justifyContent: "center", gap: 1 },
  eveningPlanCompact: { height: 66, borderRadius: 12 },
  eveningPlanOn: { borderWidth: 2, borderColor: GOLD },
  yearPlan: { backgroundColor: "rgba(142,95,24,0.48)", borderColor: "#FFC629" },
  planCopy: { alignItems: "center", justifyContent: "center", minWidth: 0 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eveningPeriod: { color: CREAM, fontSize: 13, lineHeight: 16, fontWeight: "800", textAlign: "center" },
  eveningPrice: { color: CREAM, fontSize: 13, lineHeight: 16, fontWeight: "800", textAlign: "center", alignSelf: "stretch" },
  save: { color: "#201200", backgroundColor: GOLD, overflow: "hidden", borderRadius: 7, paddingHorizontal: 5, paddingVertical: 1, fontSize: 9, fontWeight: "900", marginBottom: 1 },
  trialLine: { color: GOLD, fontSize: 8.5, lineHeight: 10, fontWeight: "700", textAlign: "center" },
  eveningTerms: { color: CREAM, fontSize: 13, lineHeight: 16, fontWeight: "600", textAlign: "center", marginTop: 2 },
  eveningNote: { color: "#D5D9E8", fontSize: 11, lineHeight: 14, textAlign: "center" },
  utilityRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 32 },
  utilityLink: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, minHeight: 32 },
  utilityGlyph: { color: "#D6DCEF", fontSize: 20, fontWeight: "600" },
  utilityGlyphCompact: { fontSize: 16 },
  manageLink: { alignSelf: "center", paddingVertical: 1, minHeight: 20 },
  eveningLink: { color: CREAM, fontSize: 11.5, fontWeight: "600", flexShrink: 1 },
  eveningLinkCompact: { fontSize: 9.5 },
  eveningLegal: { color: "#D5D9E8", fontSize: 10.5, textDecorationLine: "underline" },
  legal: { flexDirection: "row", justifyContent: "center", gap: 14, paddingBottom: 8 },
  eveningPlanYear: { borderColor: GOLD },
  unlock: { backgroundColor: GOLD, minHeight: 50, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#FFE47D", shadowColor: GOLD, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4, marginTop: 1 },
  unlockCompact: { minHeight: 44 },
  unlockText: { color: "#11101A", fontSize: 18, fontWeight: "900" },
  charge: { color: "#C5CBDE", fontSize: 10.5, lineHeight: 13, textAlign: "center" },
});
