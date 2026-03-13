import { describe, it, expect } from 'vitest';
import { composeTheme } from '../../src/lib/theme-system/compose';
import { getContrastRatio } from '../../src/lib/theme-system/contrast';
import { THEME_MODES, THEME_PALETTES, THEME_STYLES } from '../../src/lib/theme-system/tokens';

describe('theme composer', () => {
  it('composes dark + modern + ruby selection deterministically', () => {
    const theme = composeTheme({ mode: 'dark', style: 'modern', palette: 'ruby' });

    expect(theme.selection).toEqual({ mode: 'dark', style: 'modern', palette: 'ruby' });
    expect(theme.colors.primary).toBe('#BE123C');
    expect(theme.colors.primaryLight).toBe('#FFE4E6');
    expect(theme.colors.surface).toBe('#101A2B');
    expect(theme.colors.border).toBe('#22324A');
  });

  it('keeps high contrast style readable and explicit', () => {
    const light = composeTheme({ mode: 'light', style: 'high_contrast', palette: 'ocean' });
    const dark = composeTheme({ mode: 'dark', style: 'high_contrast', palette: 'emerald' });

    expect(light.colors.background).toBe('#FFFFFF');
    expect(light.colors.text).toBe('#000000');
    expect(dark.colors.background).toBe('#000000');
    expect(dark.colors.text).toBe('#FFFFFF');
  });

  it('maintains minimum text/background contrast for shipped combinations', () => {
    for (const mode of THEME_MODES) {
      for (const style of THEME_STYLES) {
        for (const palette of THEME_PALETTES) {
          const theme = composeTheme({ mode, style, palette });
          const ratio = getContrastRatio(theme.colors.text, theme.colors.background);

          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
