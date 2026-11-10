import React from "react";
import { Text, TurboModuleRegistry, View } from "react-native";

// The Navigation SDK is loaded only when this screen is shown. The store
// bundle and the navtest bundle both mount it during a route or an active trip.
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
