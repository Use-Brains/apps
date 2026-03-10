import { describe, it, expect } from 'vitest';
import { tradeFormSchema } from '../../src/types/trades';

const validClosedTrade = {
  symbol: 'btc/usd',
  asset_class: 'crypto' as const,
  side: 'long' as const,
  status: 'closed' as const,
  entry_price: 42000,
  exit_price: 43000,
  size: 0.25,
  fees: 12.5,
  entry_date: '2026-03-01T00:00:00.000Z',
  exit_date: '2026-03-01T03:00:00.000Z',
  confidence: 4,
  thesis: 'Momentum continuation',
  notes: 'Took partials near resistance',
  setup_tags: ['breakout'],
  mistake_tags: [],
};

describe('tradeFormSchema', () => {
  it('normalizes symbol by trimming and uppercasing', () => {
    const parsed = tradeFormSchema.parse(validClosedTrade);
    expect(parsed.symbol).toBe('BTC/USD');
  });

  it('rejects closed trade without exit data', () => {
    const result = tradeFormSchema.safeParse({
      ...validClosedTrade,
      exit_price: null,
      exit_date: null,
    });

    expect(result.success).toBe(false);
  });

  it('allows open trade without exit data', () => {
    const result = tradeFormSchema.safeParse({
      ...validClosedTrade,
      status: 'open',
      exit_price: null,
      exit_date: null,
    });

    expect(result.success).toBe(true);
  });

  it('rejects exit date before entry date', () => {
    const result = tradeFormSchema.safeParse({
      ...validClosedTrade,
      exit_date: '2026-02-28T23:59:59.000Z',
    });

    expect(result.success).toBe(false);
  });
});
