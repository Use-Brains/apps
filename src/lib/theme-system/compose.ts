import { ensureAccessibleText } from './contrast';
import { defaultThemeSelection } from './selection';
import { modeColors, paletteOverrides, styleOverrides } from './tokens';
import type { AppTheme, ThemeColors, ThemeSelection } from './types';

function mergeColors(base: ThemeColors, override: Partial<ThemeColors> | undefined): ThemeColors {
  if (!override) return base;
  return { ...base, ...override };
}

export function composeTheme(selection: ThemeSelection): AppTheme {
  const mode = selection.mode;

  const modeBase = modeColors[mode];
  const styleByMode = styleOverrides[selection.style]?.[mode];
  const palette = paletteOverrides[selection.palette];

  const merged = mergeColors(mergeColors(mergeColors(modeBase, styleByMode), palette), {
    profit: palette?.success ?? modeBase.profit,
    loss: palette?.danger ?? modeBase.loss,
  });

  const colors = ensureAccessibleText(merged, mode);

  return {
    selection,
    colors,
  };
}

export const defaultTheme = composeTheme(defaultThemeSelection);
