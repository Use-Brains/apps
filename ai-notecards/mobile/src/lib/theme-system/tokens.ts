import type { ThemeColors, ThemeMode, ThemePalette, ThemeStyle } from './types';

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'] as const;

export const THEME_STYLES: readonly ThemeStyle[] = [
  'parchment',
  'modern',
  'ios_glass',
  'high_contrast',
] as const;

export const THEME_PALETTES: readonly ThemePalette[] = [
  'sage',
  'gold',
  'ocean',
  'ruby',
  'slate',
] as const;

export const modeColors: Record<ThemeMode, ThemeColors> = {
  light: {
    // Warm parchment palette
    primary: '#1B6B5A',
    primaryLight: '#E8F5F0',
    success: '#2D8A5E',
    successLight: '#E8F5F0',
    danger: '#DC2626',
    dangerLight: '#FEE2E2',
    warning: '#C8A84E',
    warningLight: '#FEF3C7',

    background: '#FAF7F2',
    surface: '#FFFFFF',
    border: '#E6DFD5',
    borderLight: '#F0EBE3',

    text: '#1A1614',
    textSecondary: '#6B635A',
    textTertiary: '#9B9389',
    textInverse: '#FFFFFF',

    studyBackground: '#0d4a3d',
    studyText: '#FFFFFF',

    overlay: 'rgba(0,0,0,0.4)',
    overlayHeavy: 'rgba(0,0,0,0.6)',
    shadow: '#000000',
    destructive: '#FF3B30',

    glassTint: 'transparent',
    glassHighlight: 'transparent',
    glassShadow: '#000000',

    gradientStart: '#FAF7F2',
    gradientMid: '#FAF7F2',
    gradientEnd: '#FAF7F2',

    orbPurple: 'transparent',
    orbBlue: 'transparent',
    orbGreen: 'transparent',

    tabBarEdge: 'transparent',
  },
  dark: {
    primary: '#4ADE80',
    primaryLight: '#14532D',
    success: '#4ADE80',
    successLight: '#14532D',
    danger: '#F87171',
    dangerLight: '#7F1D1D',
    warning: '#FBBF24',
    warningLight: '#78350F',

    background: '#0F0E0C',
    surface: '#1C1A17',
    border: '#2E2A25',
    borderLight: '#3D3832',

    text: '#F5F0E8',
    textSecondary: '#B8AFA3',
    textTertiary: '#857B6F',
    textInverse: '#0F0E0C',

    studyBackground: '#0a3830',
    studyText: '#F5F0E8',

    overlay: 'rgba(0,0,0,0.5)',
    overlayHeavy: 'rgba(0,0,0,0.7)',
    shadow: '#000000',
    destructive: '#FF453A',

    glassTint: 'transparent',
    glassHighlight: 'transparent',
    glassShadow: '#000000',

    gradientStart: '#0F0E0C',
    gradientMid: '#0F0E0C',
    gradientEnd: '#0F0E0C',

    orbPurple: 'transparent',
    orbBlue: 'transparent',
    orbGreen: 'transparent',

    tabBarEdge: 'transparent',
  },
};

type ModeOverride = Partial<Record<ThemeMode, Partial<ThemeColors>>>;

export const styleOverrides: Record<ThemeStyle, ModeOverride> = {
  parchment: {},
  modern: {
    light: {
      background: '#F5F3EF',
      surface: '#FFFFFF',
      border: '#D9D2C7',
      borderLight: '#E8E3DA',
      text: '#12100E',
      textSecondary: '#4A443C',
      textTertiary: '#7A7268',
    },
    dark: {
      background: '#0A0908',
      surface: '#181614',
      border: '#302C27',
      borderLight: '#433D36',
      text: '#F0EAE0',
      textSecondary: '#C4BAA9',
      textTertiary: '#8A7F72',
    },
  },
  ios_glass: {
    light: {
      background: '#F0EDE6',
      surface: '#FFFFFFC4',
      border: '#FFFFFF70',
      borderLight: '#FFFFFFA8',
      text: '#1A1614',
      textSecondary: '#4A443C',
      textTertiary: '#7A7268',
      glassTint: '#FFFFFF',
      glassHighlight: 'rgba(255,255,255,0.40)',
      glassShadow: '#8A7F6F',
      gradientStart: '#F5F0E8',
      gradientMid: '#EFE9DE',
      gradientEnd: '#F2EDE5',
      orbPurple: 'rgba(27,107,90,0.08)',
      orbBlue: 'rgba(200,168,78,0.06)',
      orbGreen: 'rgba(45,138,94,0.04)',
      tabBarEdge: 'rgba(0,0,0,0.08)',
    },
    dark: {
      background: '#0A0908',
      surface: '#1C1A17CC',
      border: '#B8AFA340',
      borderLight: '#D4CABF66',
      text: '#F5F0E8',
      textSecondary: '#C4BAA9',
      textTertiary: '#8A7F72',
      glassTint: '#FFFFFF',
      glassHighlight: 'rgba(255,255,255,0.40)',
      glassShadow: '#000000',
      gradientStart: '#0C0B09',
      gradientMid: '#0F0E0C',
      gradientEnd: '#0A0908',
      orbPurple: 'rgba(27,107,90,0.15)',
      orbBlue: 'rgba(200,168,78,0.10)',
      orbGreen: 'rgba(45,138,94,0.06)',
      tabBarEdge: 'rgba(255,255,255,0.12)',
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
  sage: {
    primary: '#1B6B5A',
    primaryLight: '#E8F5F0',
  },
  gold: {
    primary: '#B8941F',
    primaryLight: '#FEF3C7',
    warning: '#B8941F',
    warningLight: '#FEF3C7',
  },
  ocean: {
    primary: '#2563EB',
    primaryLight: '#DBEAFE',
  },
  ruby: {
    primary: '#BE123C',
    primaryLight: '#FFE4E6',
    danger: '#BE123C',
    dangerLight: '#FFE4E6',
  },
  slate: {
    primary: '#64748B',
    primaryLight: '#F1F5F9',
  },
};
