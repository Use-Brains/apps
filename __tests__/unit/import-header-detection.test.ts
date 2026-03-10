import { describe, expect, it } from 'vitest';
import { detectHeader } from '../../src/features/import/header-detection';

describe('import header detection', () => {
  it('detects headered csv when aliases are present', () => {
    const result = detectHeader([
      ['Ticker', 'Direction', 'Quantity', 'Entry Price', 'Entry Date'],
      ['AAPL', 'Long', '10', '100', '2026-03-01'],
    ]);

    expect(result.hasHeader).toBe(true);
    expect(result.columns[0]).toBe('Ticker');
    expect(result.dataRows).toHaveLength(1);
  });

  it('treats data-only rows as headerless', () => {
    const result = detectHeader([
      ['AAPL', 'Long', '10', '100', '2026-03-01'],
      ['TSLA', 'Short', '3', '220', '2026-03-02'],
    ]);

    expect(result.hasHeader).toBe(false);
    expect(result.columns[0]).toBe('Column A');
    expect(result.dataRows).toHaveLength(2);
  });
});
