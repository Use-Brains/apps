import { describe, expect, it } from 'vitest';
import { executeImport, type SupabaseLike } from '../../src/features/import/executor';
import type { ImportConflict, ImportRowResult } from '../../src/features/import/types';

function createMockSupabase() {
  const inserts: unknown[] = [];
  const updates: Array<{ id: string; values: unknown }> = [];

  const supabase = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'user-1' } } }),
    },
    from: (table: string) => ({
      insert: async (values: unknown) => {
        inserts.push({ table, values });
        return { error: null };
      },
      update: (values: unknown) => ({
        eq: async (_column: string, value: string) => {
          updates.push({ id: value, values });
          return { error: null };
        },
      }),
    }),
  };

  return { supabase, inserts, updates };
}

const baseRow = {
  symbol: 'AAPL',
  side: 'long' as const,
  size: 10,
  entry_price: 100,
  entry_date: '2026-03-01T10:00:00.000Z',
  status: 'open' as const,
  exit_price: null,
  exit_date: null,
  asset_class: 'stocks' as const,
  fees: 0,
  confidence: null,
  thesis: null,
  notes: null,
  setup_tags: [],
  mistake_tags: [],
};

describe('import executor integration', () => {
  it('applies replace and import actions with report counts', async () => {
    const { supabase, inserts, updates } = createMockSupabase();

    const rowResults: ImportRowResult[] = [
      { rowIndex: 0, raw: {}, errors: [], normalized: baseRow },
      {
        rowIndex: 1,
        raw: {},
        errors: [],
        normalized: { ...baseRow, symbol: 'TSLA', entry_date: '2026-03-02T10:00:00.000Z' },
      },
    ];

    const conflicts: ImportConflict[] = [
      { importRowIndex: 0, existingTradeId: 'trade-1', diff: [] },
    ];

    const report = await executeImport({
      supabase: supabase as unknown as SupabaseLike,
      rowResults,
      conflicts,
      resolutions: { 0: 'replace', 1: 'import' },
      skippedInvalid: 0,
    });

    expect(report.replaced).toBe(1);
    expect(report.imported).toBe(1);
    expect(report.failed).toEqual([]);
    expect(inserts.length).toBe(1);
    expect(updates.length).toBe(1);
  });
});
