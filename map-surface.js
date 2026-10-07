import React from "react";
import NativeMap, { Marker as NativeMarker } from "react-native-maps";
export default React.forwardRef(function MapSurface(
  { userCoordinate, ...props },
  ref,
) {
  return <NativeMap ref={ref} {...props} />;
});
export function Marker({ mapIcon, clusterCount, ...props }) {
  return <NativeMarker {...props} />;
}
