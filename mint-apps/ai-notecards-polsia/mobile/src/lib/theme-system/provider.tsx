import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { storage } from '@/lib/mmkv';
import { composeTheme } from './compose';
import {
  defaultThemeSelection,
  parseThemeSelection,
  serializeThemeSelection,
  THEME_STORAGE_KEY,
} from './selection';
import type { AppTheme, ThemeMode, ThemePalette, ThemeSelection, ThemeStyle } from './types';

type ThemeContextValue = {
  theme: AppTheme;
  selection: ThemeSelection;
  setSelection: (next: ThemeSelection) => void;
  setMode: (mode: ThemeMode) => void;
  setStyle: (style: ThemeStyle) => void;
  setPalette: (palette: ThemePalette) => void;
};

const initialSelection = parseThemeSelection(storage.getString(THEME_STORAGE_KEY));

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persistSelection(selection: ThemeSelection): void {
  storage.set(THEME_STORAGE_KEY, serializeThemeSelection(selection));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelectionState] = useState<ThemeSelection>(initialSelection);

  const setSelection = useCallback((next: ThemeSelection) => {
    setSelectionState(next);
    persistSelection(next);
  }, []);

  const setMode = useCallback(
    (mode: ThemeMode) => {
      setSelection({ ...selection, mode });
    },
    [selection, setSelection]
  );

  const setStyle = useCallback(
    (style: ThemeStyle) => {
      setSelection({ ...selection, style });
    },
    [selection, setSelection]
  );

  const setPalette = useCallback(
    (palette: ThemePalette) => {
      setSelection({ ...selection, palette });
    },
    [selection, setSelection]
  );

  const value = useMemo<ThemeContextValue>(() => {
    return {
      theme: composeTheme(selection),
      selection,
      setSelection,
      setMode,
      setStyle,
      setPalette,
    };
  }, [selection, setMode, setPalette, setSelection, setStyle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

export function useThemedStyles<T>(factory: (theme: AppTheme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}

export function resetThemePreferenceForTests(): void {
  storage.set(THEME_STORAGE_KEY, serializeThemeSelection(defaultThemeSelection));
}
