// 공용 UI — Screen / BigButton / Chip
import React from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, Vibration, View } from 'react-native';
import { C } from '../theme';

export function Screen({ children, style }) {
  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

export function BigButton({ label, onPress, color = C.p1, disabled, style, small }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={onPress}
      style={[styles.big, { backgroundColor: color, opacity: disabled ? 0.4 : 1 }, small && styles.bigSmall, style]}
    >
      <Text style={[styles.bigText, small && { fontSize: 15 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Chip({ label, color = C.card, onPress, active, style }) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: color, borderColor: active ? C.gold : C.line }, style]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

// 진동 피드백 (실기기에서만 동작, 웹은 무시)
export function vib(ms = 25) {
  if (Platform.OS !== 'web') {
    try { Vibration.vibrate(ms); } catch (e) {}
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  big: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigSmall: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  bigText: { color: '#0b0e1a', fontSize: 18, fontWeight: '800' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipText: { color: C.text, fontSize: 14, fontWeight: '600' },
});
