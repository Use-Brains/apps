import { storage } from './mmkv';
import { composeTheme, parseThemeSelection, THEME_STORAGE_KEY } from './theme-system';
import type { ThemeMode, ThemePalette, ThemeStyle } from './theme-system';

export {
  withAlpha,
  ThemeProvider,
  useTheme,
  useThemedStyles,
  composeTheme,
  getContrastRatio,
  defaultThemeSelection,
  normalizeThemeSelection,
  parseThemeSelection,
  serializeThemeSelection,
  THEME_STORAGE_KEY,
  THEME_MODES,
  THEME_STYLES,
  THEME_PALETTES,
} from './theme-system';

export type {
  AppTheme,
  ThemeColors,
  ThemeMode,
  ThemePalette,
  ThemeSelection,
  ThemeStyle,
} from './theme-system';

// Compatibility export for static style consumers.
const staticSelection = parseThemeSelection(storage.getString(THEME_STORAGE_KEY));
export const colors = composeTheme(staticSelection).colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const borderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const themeModeLabels: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
};

export const themeStyleLabels: Record<ThemeStyle, string> = {
  classic: 'Classic',
  modern: 'Modern',
  ios_glass: 'iOS Theme',
  android_material: 'Android Theme',
  high_contrast: 'High Contrast',
};

export const themePaletteLabels: Record<ThemePalette, string> = {
  ocean: 'Ocean',
  emerald: 'Emerald',
  amber: 'Amber',
  ruby: 'Ruby',
  slate: 'Slate',
};
