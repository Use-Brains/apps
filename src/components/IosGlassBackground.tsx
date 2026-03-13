/**
 * IosGlassBackground — deep space gradient with ambient light orbs
 *
 * All colors come from theme tokens — no hardcoded hex/rgba values.
 * Glass cards sit ON TOP of this, blurring and sampling these colors.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, withAlpha } from '@/lib/theme';

type Props = {
  children: React.ReactNode;
  /** Accent color from current palette (e.g. primary) used to tint mid orb */
  accentColor?: string;
};

export function IosGlassBackground({ children, accentColor }: Props) {
  const { selection, theme: { colors } } = useTheme();
  const isLight = selection.mode === 'light';
  const accent = accentColor ?? colors.primary;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Base gradient: deep space (dark) or pearl sky (light) */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd] as const}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Ambient orb 1: purple-violet, top-left */}
      <View style={[styles.orb, styles.orbTopLeft, { backgroundColor: colors.orbPurple }]} />

      {/* Ambient orb 2: blue, top-right */}
      <View style={[styles.orb, styles.orbTopRight, { backgroundColor: colors.orbBlue }]} />

      {/* Ambient orb 3: accent-tinted, mid-center — shifts with palette */}
      <View
        style={[
          styles.orb,
          styles.orbMidCenter,
          { backgroundColor: withAlpha(accent, isLight ? 0.08 : 0.10) },
        ]}
      />

      {/* Ambient orb 4: subtle green bottom — references profit color */}
      <View style={[styles.orb, styles.orbBottomLeft, { backgroundColor: colors.orbGreen }]} />

      {/* Screen content sits on top of all this */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTopLeft: {
    width: 320,
    height: 280,
    top: -80,
    left: -80,
    transform: [{ scaleX: 1.2 }],
  },
  orbTopRight: {
    width: 260,
    height: 240,
    top: 40,
    right: -60,
    transform: [{ scaleX: 1.1 }],
  },
  orbMidCenter: {
    width: 280,
    height: 200,
    top: '35%',
    left: '10%',
  },
  orbBottomLeft: {
    width: 220,
    height: 180,
    bottom: '8%',
    left: '15%',
  },
});
