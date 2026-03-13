import { describe, expect, it } from 'vitest';
import { normalizeRow } from '../../src/features/import/normalize';
import type { ImportColumnBinding } from '../../src/features/import/types';

const bindings: ImportColumnBinding[] = [
  { sourceColumn: 'Ticker', targetField: 'symbol', confidence: 1, isManual: false },
  { sourceColumn: 'Direction', targetField: 'side', confidence: 1, isManual: false },
  { sourceColumn: 'Qty', targetField: 'size', confidence: 1, isManual: false },
  { sourceColumn: 'Entry', targetField: 'entry_price', confidence: 1, isManual: false },
  { sourceColumn: 'Entry Date', targetField: 'entry_date', confidence: 1, isManual: false },
  { sourceColumn: 'Exit', targetField: 'exit_price', confidence: 1, isManual: false },
  { sourceColumn: 'Exit Date', targetField: 'exit_date', confidence: 1, isManual: false },
];

describe('import normalize', () => {
  it('normalizes a valid closed trade row', () => {
    const result = normalizeRow({
      rowIndex: 0,
      raw: {
        Ticker: 'aapl',
        Direction: 'buy',
        Qty: '10',
        Entry: '100',
        'Entry Date': '2026-03-01 10:00:00',
        Exit: '105',
        'Exit Date': '2026-03-01 11:00:00',
      },
      bindings,
      timeZone: 'UTC',
    });

    expect(result.errors).toEqual([]);
    expect(result.normalized?.symbol).toBe('AAPL');
    expect(result.normalized?.status).toBe('closed');
  });

  it('marks row invalid when required values are missing', () => {
    const result = normalizeRow({
      rowIndex: 1,
      raw: {
        Ticker: '',
        Direction: '',
        Qty: '',
        Entry: '',
        'Entry Date': '',
        Exit: '',
        'Exit Date': '',
      },
      bindings,
      timeZone: 'UTC',
    });

    expect(result.normalized).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
