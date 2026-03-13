/**
 * GlassCard — iOS glass panel
 *
 * All colors come from theme tokens via `colors.glassTint`, `colors.glassShadow`,
 * `colors.glassHighlight`. No hardcoded hex/rgba values.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme, withAlpha } from '@/lib/theme';

type Intensity = 'light' | 'medium' | 'heavy';

const BLUR: Record<Intensity, number> = { light: 25, medium: 45, heavy: 65 };
const OVERLAY_ALPHA_DARK: Record<Intensity, number> = { light: 0.06, medium: 0.10, heavy: 0.16 };
const OVERLAY_ALPHA_LIGHT: Record<Intensity, number> = { light: 0.30, medium: 0.45, heavy: 0.60 };
const BORDER_ALPHA: Record<Intensity, number> = { light: 0.12, medium: 0.18, heavy: 0.26 };
const SHADOW_OPACITY: Record<Intensity, number> = { light: 0.06, medium: 0.12, heavy: 0.20 };

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: Intensity;
};

export function GlassCard({ children, style, intensity = 'medium' }: Props) {
  const { selection, theme: { colors } } = useTheme();
  const isLight = selection.mode === 'light';
  const overlayAlpha = isLight ? OVERLAY_ALPHA_LIGHT[intensity] : OVERLAY_ALPHA_DARK[intensity];
  const borderAlpha = isLight ? BORDER_ALPHA[intensity] * 2 : BORDER_ALPHA[intensity];

  return (
    <View
      style={[
        styles.wrapper,
        {
          borderColor: withAlpha(colors.glassTint, borderAlpha),
          shadowOpacity: SHADOW_OPACITY[intensity],
          shadowColor: colors.glassShadow,
        },
        style,
      ]}
    >
      {/* Layer 1: Real backdrop blur via expo-blur */}
      <BlurView
        intensity={BLUR[intensity]}
        tint={isLight ? 'light' : 'dark'}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Layer 2: Semi-transparent tint — frosted milk-glass look */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: withAlpha(colors.glassTint, overlayAlpha) },
        ]}
      />

      {/* Layer 3: Vertical gradient sheen placeholder */}
      <View style={styles.sheen} />

      {/* Layer 4: Top-edge refraction line */}
      <View style={[styles.topHighlight, { backgroundColor: colors.glassHighlight }]} />

      {/* Layer 5: Content */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 24,
    elevation: 3,
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderRadius: 20,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 40,
    right: 40,
    height: 1,
  },
});
