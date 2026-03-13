import { describe, expect, it } from 'vitest';
import { buildIdentityKey, detectImportConflicts, indexExistingTrades } from '../../src/features/import/dedupe';
import type { ImportRowResult } from '../../src/features/import/types';

describe('import dedupe', () => {
  it('builds stable identity key', () => {
    const key = buildIdentityKey({
      symbol: 'AAPL',
      side: 'long',
      size: 10,
      entry_date: '2026-03-01T10:00:00.000Z',
    });

    expect(key).toContain('AAPL|long|2026-03-01T10:00:00.000Z');
  });

  it('detects conflicts with existing index', () => {
    const index = indexExistingTrades([
      {
        id: 'trade-1',
        symbol: 'AAPL',
        side: 'long',
        size: 10,
        entry_date: '2026-03-01T10:00:00.000Z',
      },
    ]);

    const rowResults: ImportRowResult[] = [
      {
        rowIndex: 0,
        raw: {},
        errors: [],
        normalized: {
          symbol: 'AAPL',
          side: 'long',
          size: 10,
          entry_price: 100,
          entry_date: '2026-03-01T10:00:00.000Z',
          status: 'open',
          exit_price: null,
          exit_date: null,
          asset_class: 'stocks',
          fees: 0,
          confidence: null,
          thesis: null,
          notes: null,
          setup_tags: [],
          mistake_tags: [],
        },
      },
    ];

    const conflicts = detectImportConflicts(rowResults, index);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].existingTradeId).toBe('trade-1');
  });
});
