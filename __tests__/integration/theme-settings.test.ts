import { describe, it, expect } from 'vitest';
import { composeTheme } from '../../src/lib/theme-system/compose';
import { parseThemeSelection, serializeThemeSelection } from '../../src/lib/theme-system/selection';

describe('theme settings integration', () => {
  it('round-trips persisted payload and composes expected color output', () => {
    const selection = { mode: 'dark', style: 'android_material', palette: 'amber' } as const;
    const persistedValue = serializeThemeSelection(selection);
    const restored = parseThemeSelection(persistedValue);
    const theme = composeTheme(restored);

    expect(restored).toEqual(selection);
    expect(theme.colors.primary).toBe('#D97706');
    expect(theme.colors.background).toBe('#10131A');
  });
});
