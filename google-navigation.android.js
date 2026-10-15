import React from 'react';
import {TurboModuleRegistry, SafeAreaView, Text, Pressable, StyleSheet} from 'react-native';
import {navigationCopy} from './google-navigation-copy';

// Guard old binaries / Expo Go before evaluating the package's getEnforcing().
export const supportsEmbeddedNavigation = !!TurboModuleRegistry.get('NavModule');
export default function GoogleNavigationScreen(props) {
  if (supportsEmbeddedNavigation) {
    const Screen = require('./google-navigation-screen').default;
    return <Screen {...props} />;
  }
  const copy = navigationCopy(props.language);
  return <SafeAreaView style={styles.screen}>
    <Pressable accessibilityRole="button" accessibilityLabel={copy.back} onPress={props.onClose} style={styles.back}><Text style={styles.text}>‹ {copy.back}</Text></Pressable>
    <Text style={styles.text}>{copy.unavailable}</Text>
  </SafeAreaView>;
}
const styles = StyleSheet.create({screen:{flex:1,backgroundColor:'#0B1829',padding:20},back:{minHeight:48,justifyContent:'center'},text:{color:'#FFFFFF',fontSize:16}});
