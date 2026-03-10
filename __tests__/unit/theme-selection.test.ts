import { describe, it, expect } from 'vitest';
import {
  defaultThemeSelection,
  normalizeThemeSelection,
  parseThemeSelection,
  serializeThemeSelection,
} from '../../src/lib/theme-system/selection';

describe('theme selection serialization', () => {
  it('round-trips valid selection payload', () => {
    const input = { mode: 'dark', style: 'ios_glass', palette: 'slate' } as const;
    const serialized = serializeThemeSelection(input);
    const parsed = parseThemeSelection(serialized);

    expect(parsed).toEqual(input);
  });

  it('falls back to defaults when payload is invalid', () => {
    const parsed = parseThemeSelection('{"mode":"invalid"}');

    expect(parsed).toEqual(defaultThemeSelection);
  });

  it('normalizes partial object fields', () => {
    const normalized = normalizeThemeSelection({
      mode: 'dark',
      style: 'not_real',
      palette: 'emerald',
    });

    expect(normalized).toEqual({
      mode: 'dark',
      style: defaultThemeSelection.style,
      palette: 'emerald',
    });
  });
});
