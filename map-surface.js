import React from "react";
import NativeMap, { Marker as NativeMarker, Polyline } from "react-native-maps";
export default React.forwardRef(function MapSurface(
  { userCoordinate, trail, ...props },
  ref,
) {
  return (
    <NativeMap ref={ref} {...props}>
      {props.children}
      {trail?.length > 1 && (
        <Polyline coordinates={trail} strokeColor="#007aff" strokeWidth={5} />
      )}
    </NativeMap>
  );
});
export function Marker({ mapIcon, clusterCount, ...props }) {
  return <NativeMarker {...props} />;
}
