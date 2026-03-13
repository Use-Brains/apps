import type { ThemeColors, ThemeMode, ThemePalette, ThemeStyle } from './types';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'] as const;

export const THEME_STYLES: readonly ThemeStyle[] = [
  'classic',
  'modern',
  'ios_glass',
  'android_material',
  'high_contrast',
] as const;

export const THEME_PALETTES: readonly ThemePalette[] = [
  'ocean',
  'emerald',
  'amber',
  'ruby',
  'slate',
] as const;

export const modeColors: Record<ThemeMode, ThemeColors> = {
  light: {
    primary: '#2563EB',
    primaryLight: '#DBEAFE',
    success: '#16A34A',
    successLight: '#DCFCE7',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    textInverse: '#FFFFFF',
    profit: '#16A34A',
    loss: '#DC2626',
    // Overlays & shadows
    overlay: 'rgba(0,0,0,0.4)',
    overlayHeavy: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
    destructive: '#FF3B30',
    // Glass card (no-op defaults for non-glass themes)
    glassTint: 'transparent',
    glassHighlight: 'transparent',
    glassShadow: '#000000',
    // Background gradient (flat — just background color)
    gradientStart: '#FFFFFF',
    gradientMid: '#FFFFFF',
    gradientEnd: '#FFFFFF',
    // Ambient orbs (transparent for non-glass)
    orbPurple: 'transparent',
    orbBlue: 'transparent',
    orbGreen: 'transparent',
    // Tab bar
    tabBarEdge: 'transparent',
  },
  dark: {
    primary: '#60A5FA',
    primaryLight: '#1E3A8A',
    success: '#22C55E',
    successLight: '#14532D',
    danger: '#F87171',
    dangerLight: '#7F1D1D',
    warning: '#FBBF24',
    warningLight: '#78350F',
    background: '#020617',
    surface: '#0F172A',
    border: '#1E293B',
    borderLight: '#334155',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    textInverse: '#020617',
    profit: '#4ADE80',
    loss: '#FB7185',
    // Overlays & shadows
    overlay: 'rgba(0,0,0,0.5)',
    overlayHeavy: 'rgba(0,0,0,0.7)',
    shadow: '#000000',
    destructive: '#FF453A',
    // Glass card (no-op defaults for non-glass themes)
    glassTint: 'transparent',
    glassHighlight: 'transparent',
    glassShadow: '#000000',
    // Background gradient (flat)
    gradientStart: '#020617',
    gradientMid: '#020617',
    gradientEnd: '#020617',
    // Ambient orbs (transparent for non-glass)
    orbPurple: 'transparent',
    orbBlue: 'transparent',
    orbGreen: 'transparent',
    // Tab bar
    tabBarEdge: 'transparent',
  },
};

type ModeOverride = Partial<Record<ThemeMode, Partial<ThemeColors>>>;

export const styleOverrides: Record<ThemeStyle, ModeOverride> = {
  classic: {},
  modern: {
    light: {
      background: '#F2F6FC',
      surface: '#FFFFFF',
      border: '#CBD6E6',
      borderLight: '#E3EBF5',
      text: '#0A1222',
      textSecondary: '#3A4B66',
      textTertiary: '#6B7D99',
      textInverse: '#F7FBFF',
      success: '#0E9F6E',
      successLight: '#D7F4EA',
      danger: '#DC3B52',
      dangerLight: '#FFE1E6',
      warning: '#C97A00',
      warningLight: '#FFF1D6',
    },
    dark: {
      background: '#070B14',
      surface: '#101A2B',
      border: '#22324A',
      borderLight: '#304664',
      text: '#EAF1FF',
      textSecondary: '#B4C4DE',
      textTertiary: '#7E93B6',
      textInverse: '#0A1222',
      success: '#3DD598',
      successLight: '#143D31',
      danger: '#FF6B81',
      dangerLight: '#4A1C29',
      warning: '#F6B545',
      warningLight: '#4A3512',
    },
  },
  ios_glass: {
    light: {
      background: '#DCE7FF',
      surface: '#FFFFFFC4',
      border: '#FFFFFF70',
      borderLight: '#FFFFFFA8',
      text: '#0A1733',
      textSecondary: '#314A7A',
      textTertiary: '#5B75A3',
      textInverse: '#F5F8FF',
      success: '#32D74B',
      successLight: '#DDF8E7',
      danger: '#FF453A',
      dangerLight: '#FFE0DE',
      warning: '#FF9F0A',
      warningLight: '#FFF0DB',
      // Glass card
      glassTint: '#FFFFFF',
      glassHighlight: 'rgba(255,255,255,0.40)',
      glassShadow: '#8090C0',
      // Background gradient
      gradientStart: '#EEF3FF',
      gradientMid: '#E8F0FE',
      gradientEnd: '#F0F5FF',
      // Ambient orbs
      orbPurple: 'rgba(140,100,255,0.10)',
      orbBlue: 'rgba(50,120,255,0.08)',
      orbGreen: 'rgba(50,215,75,0.04)',
      // Tab bar
      tabBarEdge: 'rgba(0,0,0,0.08)',
    },
    dark: {
      background: '#070B1A',
      surface: '#111B33CC',
      border: '#9BB6E640',
      borderLight: '#D2E1FF66',
      text: '#EDF3FF',
      textSecondary: '#BFD1F0',
      textTertiary: '#8FA5CC',
      textInverse: '#091227',
      success: '#32D74B',
      successLight: '#184A25',
      danger: '#FF6961',
      dangerLight: '#4B1E27',
      warning: '#FFB340',
      warningLight: '#4A3414',
      // Glass card
      glassTint: '#FFFFFF',
      glassHighlight: 'rgba(255,255,255,0.40)',
      glassShadow: '#000000',
      // Background gradient
      gradientStart: '#0a0a1a',
      gradientMid: '#0d1117',
      gradientEnd: '#080c14',
      // Ambient orbs
      orbPurple: 'rgba(120,80,220,0.18)',
      orbBlue: 'rgba(30,100,220,0.14)',
      orbGreen: 'rgba(50,215,75,0.06)',
      // Tab bar
      tabBarEdge: 'rgba(255,255,255,0.12)',
    },
  },
  android_material: {
    light: {
      background: '#FFFBFE',
      surface: '#F7F2FA',
      border: '#CAC4D0',
      borderLight: '#E7E0EC',
      text: '#1D1B20',
      textSecondary: '#49454F',
      textTertiary: '#7A7580',
      textInverse: '#F5EFF7',
      success: '#146C2E',
      successLight: '#CEEFD5',
      danger: '#B3261E',
      dangerLight: '#F9DEDC',
      warning: '#9A6700',
      warningLight: '#FFEAB5',
    },
    dark: {
      background: '#141218',
      surface: '#211F26',
      border: '#5C5666',
      borderLight: '#857E90',
      text: '#E6E0E9',
      textSecondary: '#CAC4D0',
      textTertiary: '#A8A2B0',
      textInverse: '#1D1B20',
      success: '#7BDB8F',
      successLight: '#1F3A26',
      danger: '#F2B8B5',
      dangerLight: '#5A1A18',
      warning: '#F3C56A',
      warningLight: '#47350D',
    },
  },
  high_contrast: {
    light: {
      background: '#FFFFFF',
      surface: '#FFFFFF',
      border: '#111827',
      borderLight: '#111827',
      text: '#000000',
      textSecondary: '#111827',
      textTertiary: '#1F2937',
      textInverse: '#FFFFFF',
    },
    dark: {
      background: '#000000',
      surface: '#000000',
      border: '#FFFFFF',
      borderLight: '#FFFFFF',
      text: '#FFFFFF',
      textSecondary: '#E5E7EB',
      textTertiary: '#D1D5DB',
      textInverse: '#000000',
    },
  },
};

export const paletteOverrides: Record<ThemePalette, Partial<ThemeColors>> = {
  ocean: {
    primary: '#2563EB',
    primaryLight: '#DBEAFE',
  },
  emerald: {
    primary: '#059669',
    primaryLight: '#D1FAE5',
    success: '#059669',
    successLight: '#D1FAE5',
  },
  amber: {
    primary: '#D97706',
    primaryLight: '#FEF3C7',
    warning: '#D97706',
    warningLight: '#FEF3C7',
  },
  ruby: {
    primary: '#BE123C',
    primaryLight: '#FFE4E6',
    danger: '#BE123C',
    dangerLight: '#FFE4E6',
  },
  slate: {
    primary: '#90A9D8',
    primaryLight: '#314A76',
  },
};
