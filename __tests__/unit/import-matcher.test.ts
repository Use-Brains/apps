import { describe, expect, it } from 'vitest';
import { autoMatchColumns, normalizeHeader } from '../../src/features/import/matcher';

describe('import matcher', () => {
  it('normalizes headers consistently', () => {
    expect(normalizeHeader('Entry-Price ($)')).toBe('entry price');
  });

  it('auto-maps common broker-style headers', () => {
    const bindings = autoMatchColumns([
      'Ticker',
      'Direction',
      'Quantity',
      'Entry Price',
      'Entry Time',
      'Exit Price',
    ]);

    expect(bindings.find((b) => b.sourceColumn === 'Ticker')?.targetField).toBe('symbol');
    expect(bindings.find((b) => b.sourceColumn === 'Direction')?.targetField).toBe('side');
    expect(bindings.find((b) => b.sourceColumn === 'Entry Price')?.targetField).toBe('entry_price');
  });

  it('leaves unknown headers unmapped', () => {
    const bindings = autoMatchColumns(['abc123']);
    expect(bindings[0].targetField).toBeNull();
  });
});
