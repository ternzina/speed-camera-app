import React from "react";
import { Text, TurboModuleRegistry, View } from "react-native";

// The Navigation SDK is loaded only when this screen is shown. Production
// bundle id com.21wek.camera never mounts it, so it keeps MapKit.
export default function GoogleNavTestScreen(props) {
  if (!TurboModuleRegistry.get("NavModule")) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0B1829", padding: 24, justifyContent: "center" }}>
        <Text style={{ color: "#FFFFFF", fontSize: 16 }}>Navigation SDK не подключён к этой сборке.</Text>
      </View>
    );
  }
  const Screen = require("./google-nav-test-screen").default;
  return <Screen {...props} />;
}
