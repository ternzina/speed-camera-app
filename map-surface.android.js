import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Linking } from "react-native";
import { WebView } from "react-native-webview";
import { androidMapHTML } from "./android-map-html";
export function Marker() {
  return null;
}
export default React.forwardRef(function MapSurface(
  { initialRegion, onRegionChangeComplete, userCoordinate, children, style },
  ref,
) {
  const web = useRef(null),
    html = useRef(null);
  if (html.current === null) html.current = androidMapHTML(initialRegion);
  const [ready, setReady] = useState(false);
  const markers = React.Children.toArray(children);
  function invoke(method, ...args) {
    const data = JSON.stringify(args).replace(/</g, "\u003c");
    web.current?.injectJavaScript(
      `window.camMap && window.camMap.${method}(...${data});true;`,
    );
  }
  useImperativeHandle(ref, () => ({
    animateToRegion: (region) => invoke("region", region),
    fitToCoordinates: (points, options) =>
      invoke("fit", points, options.edgePadding),
  }));
  useEffect(() => {
    if (ready)
      invoke("update", {
        coords: userCoordinate,
        markers: markers.map((m) => ({
          id: String(m.key),
          ...m.props.coordinate,
          title: m.props.title,
          count: m.props.clusterCount,
          icon: m.props.mapIcon,
        })),
      });
  }, [ready, children, userCoordinate]);
  function message(event) {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (data.type === "ready") setReady(true);
    if (
      data.type === "region" &&
      data.region &&
      [
        data.region.latitude,
        data.region.longitude,
        data.region.latitudeDelta,
        data.region.longitudeDelta,
      ].every(Number.isFinite)
    )
      onRegionChangeComplete(data.region);
    if (data.type === "marker")
      markers.find((m) => String(m.key) === data.id)?.props.onPress?.();
  }
  return (
    <WebView
      ref={web}
      style={style}
      source={{ html: html.current, baseUrl: "https://camalert.local/" }}
      originWhitelist={["*"]}
      javaScriptEnabled
      onMessage={message}
      userAgent="CamAlert/1.0.0 (com.camera21wek; Android)"
      scrollEnabled={false}
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(request) => {
        if (
          request.url === "about:blank" ||
          request.url.startsWith("https://camalert.local/")
        )
          return true;
        if (request.url === "https://www.openstreetmap.org/copyright")
          Linking.openURL(request.url);
        return false;
      }}
    />
  );
});
