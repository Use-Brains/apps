import { THEME_MODES, THEME_PALETTES, THEME_STYLES } from './tokens';
import type { ThemeMode, ThemePalette, ThemeSelection, ThemeStyle } from './types';

export const THEME_STORAGE_KEY = 'theme-selection-v1';

export const defaultThemeSelection: ThemeSelection = {
  mode: 'light',
  style: 'classic',
  palette: 'ocean',
};

function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && THEME_MODES.includes(value as ThemeMode);
}

function isThemeStyle(value: unknown): value is ThemeStyle {
  return typeof value === 'string' && THEME_STYLES.includes(value as ThemeStyle);
}

function isThemePalette(value: unknown): value is ThemePalette {
  return typeof value === 'string' && THEME_PALETTES.includes(value as ThemePalette);
}

export function normalizeThemeSelection(raw: unknown): ThemeSelection {
  if (!raw || typeof raw !== 'object') {
    return defaultThemeSelection;
  }

  const candidate = raw as Record<string, unknown>;

  return {
    mode: isThemeMode(candidate.mode) ? candidate.mode : defaultThemeSelection.mode,
    style: isThemeStyle(candidate.style) ? candidate.style : defaultThemeSelection.style,
    palette: isThemePalette(candidate.palette) ? candidate.palette : defaultThemeSelection.palette,
  };
}

export function parseThemeSelection(value: string | undefined): ThemeSelection {
  if (!value) {
    return defaultThemeSelection;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return normalizeThemeSelection(parsed);
  } catch {
    return defaultThemeSelection;
  }
}

export function serializeThemeSelection(selection: ThemeSelection): string {
  return JSON.stringify(selection);
}
