import { describe, it, expect } from 'vitest';
import {
  applyTradeFilterOperations,
  buildTradeFilterOperations,
} from '../../src/utils/trade-query';

describe('trade query integration', () => {
  it('builds combined filter operations in a stable order', () => {
    const operations = buildTradeFilterOperations({
      search: 'btc',
      side: 'long',
      status: 'closed',
      tag: 'breakout',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    });

    expect(operations).toEqual([
      { op: 'ilike', column: 'symbol', value: '%btc%' },
      { op: 'eq', column: 'side', value: 'long' },
      { op: 'eq', column: 'status', value: 'closed' },
      { op: 'or', value: 'setup_tags.cs.{breakout},mistake_tags.cs.{breakout}' },
      { op: 'gte', column: 'entry_date', value: '2026-03-01' },
      { op: 'lte', column: 'entry_date', value: '2026-03-07' },
    ]);
  });

  it('applies operations to query builder methods', () => {
    const calls: string[] = [];
    const fakeQuery = {
      ilike(column: string, value: string) {
        calls.push(`ilike:${column}:${value}`);
        return this;
      },
      eq(column: string, value: string) {
        calls.push(`eq:${column}:${value}`);
        return this;
      },
      or(value: string) {
        calls.push(`or:${value}`);
        return this;
      },
      gte(column: string, value: string) {
        calls.push(`gte:${column}:${value}`);
        return this;
      },
      lte(column: string, value: string) {
        calls.push(`lte:${column}:${value}`);
        return this;
      },
    };

    const operations = buildTradeFilterOperations({
      search: 'eth',
      side: 'short',
      tag: 'fomo',
      dateFrom: '2026-03-05',
      dateTo: '2026-03-06',
    });

    applyTradeFilterOperations(fakeQuery, operations);

    expect(calls).toEqual([
      'ilike:symbol:%eth%',
      'eq:side:short',
      'or:setup_tags.cs.{fomo},mistake_tags.cs.{fomo}',
      'gte:entry_date:2026-03-05',
      'lte:entry_date:2026-03-06',
    ]);
  });
});
