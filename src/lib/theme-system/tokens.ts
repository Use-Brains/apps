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
  },
};

type ModeOverride = Partial<Record<ThemeMode, Partial<ThemeColors>>>;

export const styleOverrides: Record<ThemeStyle, ModeOverride> = {
  classic: {},
  modern: {
    light: {
      surface: '#F3F7FF',
      border: '#D1DBF0',
      borderLight: '#E4ECFA',
    },
    dark: {
      surface: '#0B1329',
      border: '#24314C',
      borderLight: '#33476B',
    },
  },
  ios_glass: {
    light: {
      surface: '#FFFFFFD9',
      border: '#FFFFFFAA',
      borderLight: '#FFFFFFCC',
      textSecondary: '#475569',
    },
    dark: {
      surface: '#0F172ACC',
      border: '#475569AA',
      borderLight: '#64748BAA',
      textSecondary: '#D1D5DB',
    },
  },
  android_material: {
    light: {
      background: '#FCFCFF',
      surface: '#F4F3FF',
      border: '#D8D7E5',
      borderLight: '#E6E6F0',
    },
    dark: {
      background: '#10131A',
      surface: '#1A1E29',
      border: '#2D3443',
      borderLight: '#3A4356',
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
    primary: '#475569',
    primaryLight: '#E2E8F0',
  },
};
