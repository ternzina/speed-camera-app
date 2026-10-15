import React, { useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View, SafeAreaView, StatusBar, Keyboard, AppState } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { NavigationProvider, NavigationView, useNavigation, TaskRemovedBehavior, NavigationNightMode, NavigationSessionStatus, RouteStatus, TravelMode, AudioGuidance, CameraPerspective } from '@googlemaps/react-native-navigation-sdk';
import { subscribeCameraSpeech } from './camera-speech';
import { navigationCopy } from './google-navigation-copy';
import { withNavigationWindow } from './navigation-readiness';
import { parseDestination } from './navigator-links';

// The SDK has one native navigator. Drain a closing screen's operations before
// another screen initializes it, including when a route request finishes late.
let sdkQueue = Promise.resolve();
function serial(operation) {
  const result = sdkQueue.then(operation);
  sdkQueue = result.catch(() => {});
  return result;
}
const terms = { title: 'Google Navigation', companyName: 'CamAlert', showOnlyDisclaimer: false };
export default function GoogleNavigationScreen(props) {
  return <NavigationProvider termsAndConditionsDialogOptions={terms} taskRemovedBehavior={TaskRemovedBehavior.QUIT_SERVICE}><RouteScreen {...props} /></NavigationProvider>;
}

function RouteScreen({ language, initialDestination, coords, night, mapStyle, voiceEnabled, camera, gpsFixReceived, speedKmh, speedAvailable, averageSection, onStartTrip, onClose }) {
  const c = navigationCopy(language);
  const { navigationController: controller, setOnArrival } = useNavigation();
  const controllerRef = useRef(controller);
  controllerRef.current = controller;
  const alive = useRef(true);
  const initialized = useRef(false);
  const busyRef = useRef(false);
  const mapRef = useRef(null);
  const navView = useRef(null);
  const mapReady = useRef(false);
  const [query, setQuery] = useState(initialDestination || '');
  const [point, setPoint] = useState(null);
  const [results, setResults] = useState([]);
  const [stage, setStage] = useState('choose');
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const [viewGeneration, setViewGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [arrived, setArrived] = useState(false);
  const bg = night ? '#0B1829' : '#F5F8FD';
  const fg = night ? '#FFFFFF' : '#102A4D';
  const muted = night ? '#CAD7E7' : '#526A80';

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      serial(async () => {
        if (!initialized.current) return;
        try { await controllerRef.current.stopGuidance(); }
        finally {
          try { await controllerRef.current.clearDestinations(); }
          finally { await controllerRef.current.cleanup(); initialized.current = false; }
        }
      }).catch(() => {});
    };
  }, []);
  useEffect(() => {
    setOnArrival(event => {
      if (event.isFinalDestination && alive.current) {
        setArrived(true);
        serial(() => controllerRef.current.stopGuidance()).catch(() => {});
        setStage('preview');
      }
    });
    return () => setOnArrival(null);
  }, [setOnArrival]);
  useEffect(() => {
    if (stage === 'choose') return;
    return subscribeCameraSpeech(cameraSpeaking => {
      const mode = voiceEnabled && !cameraSpeaking
        ? AudioGuidance.VOICE_ALERTS_AND_GUIDANCE | AudioGuidance.BLUETOOTH_AUDIO
        : AudioGuidance.SILENT;
      Promise.resolve(controller.setAudioGuidanceType(mode)).catch(() => {});
    });
  }, [controller, stage, voiceEnabled]);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active' && initialized.current && stageRef.current !== 'choose') {
        // Recreate only the native map fragment after sleep. The provider and
        // navigator retain the route, guidance and camera warning session.
        mapReady.current = false;
        navView.current = null;
        setViewGeneration(value => value + 1);
      }
      previous = next;
    });
    return () => subscription.remove();
  }, []);
  function restoreMapCamera() {
    if (!mapReady.current || !navView.current) return;
    const operation = stageRef.current === 'guiding'
      ? navView.current.setFollowingPerspective(CameraPerspective.TILTED)
      : navView.current.showRouteOverview();
    Promise.resolve(operation).catch(() => {});
  }

  async function finishRoute() {
    await run(() => serial(async () => {
      if (initialized.current) {
        await controllerRef.current.stopGuidance();
        await controllerRef.current.clearDestinations();
        await controllerRef.current.cleanup();
        initialized.current = false;
      }
      if (alive.current) onClose();
    }));
  }
  function close() {
    // Do not leave between starting the CamAlert trip and starting guidance.
    if (busyRef.current) return;
    if (stage === 'guiding') Alert.alert(c.closeTitle, c.closeNote, [{ text: c.cancel, style: 'cancel' }, { text: c.stop, onPress: finishRoute }]);
    else finishRoute();
  }
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => { closeRef.current(); return true; });
    return () => handler.remove();
  }, []);

  async function permission() {
    if (!(await Location.hasServicesEnabledAsync())) throw new Error(c.services);
    const p = await Location.requestForegroundPermissionsAsync();
    if (!p.granted || p.android?.accuracy === 'coarse') throw new Error(c.permission);
  }
  function choose(value) {
    Keyboard.dismiss();
    setPoint(value);
    setResults([]);
    setError('');
    mapRef.current?.animateToRegion({ ...value, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 400);
  }
  async function run(action) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError('');
    try { await action(); }
    catch (e) { if (alive.current) setError(e?.message || c.failed); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  function search() {
    run(async () => {
      const parsed = parseDestination(query);
      if (!parsed) throw new Error(c.noResults);
      if (parsed.kind === 'coordinates') {
        const [latitude, longitude] = parsed.value.split(',').map(Number);
        choose({ latitude, longitude }); return;
      }
      await permission();
      const found = await Location.geocodeAsync(parsed.value);
      if (!alive.current) return;
      if (!found.length) throw new Error(c.noResults);
      setResults(found.slice(0, 5));
    });
  }
  function build() {
    if (!point) return;
    run(() => serial(async () => {
      await permission();
      if (!alive.current) return;
      const inForeground = () => alive.current && AppState.currentState === 'active';
      if (!(await withNavigationWindow(() => controller.showTermsAndConditionsDialog(), inForeground))) throw new Error(c.terms);
      if (!alive.current) return;
      if (!initialized.current) {
        const status = await controller.init();
        if (status !== NavigationSessionStatus.OK) {
          throw new Error(status === NavigationSessionStatus.NOT_AUTHORIZED ? c.auth : status === NavigationSessionStatus.TERMS_NOT_ACCEPTED ? c.terms : status === NavigationSessionStatus.LOCATION_PERMISSION_MISSING ? c.permission : c.failed);
        }
        initialized.current = true;
      }
      if (!alive.current) return;
      const status = await controller.setDestination({ title: c.destination, position: { lat: point.latitude, lng: point.longitude } }, { routingOptions: { travelMode: TravelMode.DRIVING } });
      if (!alive.current) return;
      if (status !== RouteStatus.OK) throw new Error(status === RouteStatus.NO_ROUTE_FOUND ? c.noRoute : status === RouteStatus.QUOTA_CHECK_FAILED ? c.quota : [RouteStatus.LOCATION_DISABLED, RouteStatus.LOCATION_UNKNOWN].includes(status) ? c.gps : c.failed);
      Keyboard.dismiss();
      setArrived(false); setStage('preview');
    }));
  }
  function start() {
    run(() => serial(async () => {
      if (!alive.current) return;
      if (!(await onStartTrip())) return;
      await controller.startGuidance();
      if (alive.current) {
        setStage('guiding');
        await navView.current?.setFollowingPerspective(CameraPerspective.TILTED);
      }
    }));
  }
  const button = (label, action, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={action} style={[s.button, disabled && { opacity: 0.45 }]}><Text style={s.buttonText}>{label}</Text></Pressable>;
  return <SafeAreaView style={[s.root, { backgroundColor: bg }]}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel={c.back} onPress={close} disabled={busy} accessibilityState={{ disabled: busy }} style={[s.back, busy && { opacity: 0.45 }]}><Text style={{ color: fg, fontSize: 32 }}>‹</Text></Pressable><Text numberOfLines={1} style={[s.title, { color: fg }]}>{c.title}</Text></View>
    {stage === 'choose' ? <>
      <View style={s.inputRow}><TextInput accessibilityLabel={c.destination} placeholder={c.placeholder} placeholderTextColor={muted} value={query} onChangeText={setQuery} onSubmitEditing={search} style={[s.input, { color: fg, borderColor: muted }]} />{button(c.search, search, busy)}</View>
      <Text style={[s.note, { color: muted }]}>{c.choose}</Text>
      {!!results.length && <ScrollView style={{ maxHeight: 130 }}>{results.map((p, i) => <Pressable accessibilityRole="button" key={i} onPress={() => choose(p)} style={s.result}><Text style={{ color: fg }}>{query} · {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</Text></Pressable>)}</ScrollView>}
      <MapView ref={mapRef} style={s.map} customMapStyle={night ? mapStyle : []} userInterfaceStyle={night ? 'dark' : 'light'} initialRegion={{ latitude: coords?.latitude ?? 50.45, longitude: coords?.longitude ?? 30.52, latitudeDelta: 0.2, longitudeDelta: 0.2 }} onPress={event => !busy && choose(event.nativeEvent.coordinate)} toolbarEnabled={false}>
        {point && <Marker coordinate={point} title={c.destination} />}
      </MapView>
      {point && <Text style={[s.note, { color: muted }]}>{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</Text>}
      <Text style={[s.note, { color: muted }]}>{c.internet}</Text>
    </> : <>
      <NavigationView key={viewGeneration} style={s.map} navigationNightMode={night ? NavigationNightMode.FORCE_NIGHT : NavigationNightMode.FORCE_DAY} myLocationEnabled speedometerEnabled={false} speedLimitIconEnabled headerEnabled footerEnabled onNavigationViewControllerCreated={value => { navView.current = value; restoreMapCamera(); }} onMapReady={() => { mapReady.current = true; restoreMapCamera(); }} />
      <View style={s.alert}><Text style={{ color: fg, fontWeight: '700' }}>{c.alerts} · {speedAvailable ? Math.round(speedKmh) : '—'} {c.unit}</Text><Text style={{ color: camera ? '#F5B64C' : muted }}>{!gpsFixReceived ? c.waiting : camera ? `${c.camera} · ${Math.round(camera.distance)} ${c.meters}${camera.speed_limit ? ` · ${camera.speed_limit} ${c.unit}` : ''}` : c.looking}</Text>{averageSection && <Text style={{ color: '#F5B64C' }}>{c.section}{averageSection.speedLimit != null ? ` · ${averageSection.speedLimit} ${c.unit}` : ''}</Text>}</View>
      {arrived && <Text style={[s.note, { color: '#23D3EF' }]}>{c.arrived}</Text>}
    </>}
    {!!error && <Text accessibilityRole="alert" style={[s.note, { color: night ? '#FFBD85' : '#9A3700' }]}>{error}</Text>}
    <View style={s.actions}>{button(busy ? c.working : stage === 'choose' ? c.build : stage === 'preview' && !arrived ? c.start : c.stop, stage === 'choose' ? build : stage === 'preview' && !arrived ? start : close, busy || (stage === 'choose' && !point))}</View>
  </SafeAreaView>;
}
const s = StyleSheet.create({ root: { flex: 1, paddingTop: StatusBar.currentHeight || 0, paddingBottom: 24 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }, back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 19, fontWeight: '700', flex: 1 }, inputRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 }, input: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 12, padding: 12 }, button: { backgroundColor: '#1260E8', padding: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48 }, buttonText: { color: 'white', fontWeight: '700', fontSize: 16 }, note: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 7 }, map: { flex: 1, minHeight: 120 }, actions: { padding: 12 }, result: { padding: 14 }, alert: { padding: 14, gap: 6 } });
