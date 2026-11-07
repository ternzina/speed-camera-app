import React from "react";
import { Platform, SafeAreaView } from "react-native";
import NativeSafeAreaView from "react-native/Libraries/Components/SafeAreaView/RCTSafeAreaViewNativeComponent";

// React Native's SafeAreaView is a plain View on Android, so edge-to-edge
// screens draw under the status and navigation bars. The native view is
// already in the binary and applies those insets.
const Component = Platform.OS === "android" ? NativeSafeAreaView : SafeAreaView;

export default function SystemSafeArea(props) {
  return <Component {...props} />;
}
