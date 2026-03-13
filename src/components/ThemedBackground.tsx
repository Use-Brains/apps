/**
 * ThemedBackground — screen-level background wrapper
 *
 * In ios_glass mode: renders IosGlassBackground with gradient + ambient orbs
 * so every screen gets the same glass backdrop that BlurView cards sample.
 *
 * In all other modes: renders a plain View with colors.background, matching
 * the current theme (light/dark/palette).
 */
import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { useTheme } from '@/lib/theme';
import { IosGlassBackground } from './IosGlassBackground';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function ThemedBackground({ children, style }: Props) {
  const {
    selection,
    theme: { colors },
  } = useTheme();

  if (selection.style === 'ios_glass') {
    return (
      <View style={[{ flex: 1 }, style]}>
        <IosGlassBackground accentColor={colors.primary}>{children}</IosGlassBackground>
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
}
