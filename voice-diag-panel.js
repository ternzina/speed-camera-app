import React, { useEffect, useState } from "react";
import { NativeModules, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { applicationId } from "expo-application";
import { playClipPlan } from "./uk-voice-player";
import { subscribeNavVoice, traceNavVoice } from "./nav-voice-trace";
import { googleOnlyRequest, restoreRequest, routeSimulationRequest, yevheniiaOnlyPlan } from "./voice-diag-checks";
import "./voice-diag-log";

const LOCATION = {
  notDetermined: "не запрошена",
  restricted: "ограничена",
  denied: "запрещена",
  authorizedWhenInUse: "при использовании",
  authorizedAlways: "всегда",
};

function portsOf(route) {
  if (!Array.isArray(route) || route.length === 0) return "нет";
  return route.filter(port => typeof port === "string").join(", ");
}

export function VoiceDiagPanel({ controllerRef, guiding, voiceEnabled, requestVoice }) {
  const [mode, setMode] = useState("—");
  const [sdk, setSdk] = useState("нет команды");
  const [status, setStatus] = useState(null);
  const [lines, setLines] = useState([]);

  useEffect(() => {
    traceNavVoice("screen.open", { test: true });
    const stop = subscribeNavVoice((event, fields) => {
      if (event === "voice.request") setMode(String(fields.guidance || "—"));
      if (event === "voice.accepted") setSdk("принял");
      if (event === "voice.rejected" || event === "voice.missing") setSdk("не принял");
      setLines(current => [`${event}`, ...current].slice(0, 4));
    });
    let alive = true;
    const refresh = () => {
      const snapshot = NativeModules.CamAlertVoiceDiag?.snapshot;
      if (typeof snapshot !== "function") return;
      Promise.resolve(snapshot()).then(next => {
        if (alive && next && typeof next === "object") setStatus(next);
      }, () => {});
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => {
      alive = false;
      stop();
      clearInterval(timer);
    };
  }, []);

  async function onSimulate() {
    const decision = routeSimulationRequest(guiding);
    if (!decision.start) {
      traceNavVoice("simulation.waiting", { guiding: false });
      return;
    }
    const send = controllerRef.current?.simulateLocationsAlongExistingRoute;
    if (typeof send !== "function") {
      traceNavVoice("simulation.missing", {});
      return;
    }
    try {
      await Promise.resolve(send.call(controllerRef.current, { speedMultiplier: decision.speedMultiplier }));
      traceNavVoice("simulation.started", { test: true, speedMultiplier: decision.speedMultiplier });
    } catch {
      traceNavVoice("simulation.rejected", { code: "failed" });
    }
  }

  async function onGoogleOnly() {
    const request = googleOnlyRequest();
    traceNavVoice("check.google-only", { playClip: request.playClip, voiceEnabled: !!voiceEnabled });
    await requestVoice(request.index, request.reason);
  }

  async function onYevheniia() {
    const plan = yevheniiaOnlyPlan();
    traceNavVoice("check.yevheniia", { clip: "close", changeVoice: plan.changeVoice });
    try {
      await playClipPlan(plan, () => true);
      traceNavVoice("check.yevheniia.done", { clip: "close" });
    } catch {
      traceNavVoice("check.failed", { check: "yevheniia" });
    }
  }

  async function onRestore() {
    const request = restoreRequest();
    traceNavVoice("check.restore", { clip: request.clip });
    try {
      await requestVoice(request.silentIndex, "restore-silent");
      await playClipPlan(yevheniiaOnlyPlan(), () => true);
      await requestVoice(request.voiceIndex, "restore");
      traceNavVoice("check.restore.done", { clip: request.clip });
    } catch {
      traceNavVoice("check.failed", { check: "restore" });
    }
  }

  const location = status ? (LOCATION[status.location] || String(status.location || "нет")) : "нет";
  const interruption = status?.interrupted ? String(status.interruption || "да") : "нет";

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.test}>TEST</Text>
        <Text style={styles.line}>{applicationId || "bundle неизвестен"}</Text>
        <Text style={styles.line}>Ведение: {guiding ? "да" : "нет"}</Text>
        <Text style={styles.line}>Голос запрошен: {mode}</Text>
        <Text style={styles.line}>SDK: {sdk}</Text>
        <Text style={styles.line}>Аудиовыход: {portsOf(status?.route)}</Text>
        <Text style={styles.line}>Прерывание: {interruption}</Text>
        <Text style={styles.line}>Геолокация: {location}</Text>
        <View style={styles.row}>
          <Pressable accessibilityRole="button" onPress={onSimulate} style={styles.button}>
            <Text style={styles.buttonText}>Симуляция по маршруту</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onGoogleOnly} style={styles.button}>
            <Text style={styles.buttonText}>Google без камер</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onYevheniia} style={styles.button}>
            <Text style={styles.buttonText}>Yevheniia</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onRestore} style={styles.button}>
            <Text style={styles.buttonText}>Google после Yevheniia</Text>
          </Pressable>
        </View>
        {lines.map((line, index) => <Text key={`${line}-${index}`} style={styles.journal}>{line}</Text>)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 8, right: 8, bottom: 8, zIndex: 20 },
  card: { backgroundColor: "#10243A", borderRadius: 14, padding: 10, gap: 2 },
  test: { color: "#F5C16C", fontSize: 13, fontWeight: "700" },
  line: { color: "#F4F7FB", fontSize: 13 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  button: { backgroundColor: "#1C4E89", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  buttonText: { color: "#FFFFFF", fontSize: 12 },
  journal: { color: "#9BB0C7", fontSize: 11 },
});
