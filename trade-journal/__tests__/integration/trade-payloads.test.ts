import { describe, it, expect } from 'vitest';
import {
  applyDerivedMetricsToTradeUpdate,
  buildTradeImageInserts,
  deriveTradeMetricsForCreate,
  mapTradeFormToInsert,
  mapTradeFormToUpdate,
} from '../../src/utils/trade-payloads';
import type { TradeFormData, TradeUpdate } from '../../src/types/trades';

const formData: TradeFormData = {
  symbol: 'AAPL',
  asset_class: 'stocks',
  side: 'long',
  status: 'closed',
  entry_price: 100,
  exit_price: 110,
  size: 10,
  fees: 5,
  entry_date: '2026-03-01T10:00:00.000Z',
  exit_date: '2026-03-01T12:00:00.000Z',
  confidence: 3,
  thesis: 'Breakout above consolidation',
  notes: 'Followed plan and took profit at target',
  setup_tags: ['breakout'],
  mistake_tags: ['late-entry'],
};

describe('trade payload integration', () => {
  it('maps form data to insert payload without user/derived fields', () => {
    const payload = mapTradeFormToInsert(formData);

    expect(payload).toEqual({
      symbol: 'AAPL',
      asset_class: 'stocks',
      side: 'long',
      status: 'closed',
      entry_price: 100,
      exit_price: 110,
      size: 10,
      fees: 5,
      entry_date: '2026-03-01T10:00:00.000Z',
      exit_date: '2026-03-01T12:00:00.000Z',
      confidence: 3,
      thesis: 'Breakout above consolidation',
      notes: 'Followed plan and took profit at target',
      setup_tags: ['breakout'],
      mistake_tags: ['late-entry'],
    });
  });

  it('maps form data to update payload with nullable fields preserved', () => {
    const payload = mapTradeFormToUpdate({
      ...formData,
      confidence: null,
      thesis: null,
      notes: null,
    });

    expect(payload.confidence).toBeNull();
    expect(payload.thesis).toBeNull();
    expect(payload.notes).toBeNull();
  });

  it('recalculates pnl metrics for valid closed-trade updates', () => {
    const updateInput: TradeUpdate = {
      status: 'closed',
      side: 'long',
      entry_price: 100,
      exit_price: 110,
      size: 10,
      fees: 5,
    };

    const withMetrics = applyDerivedMetricsToTradeUpdate(updateInput);
    expect(withMetrics.pnl).toBe(95);
    expect(withMetrics.pnl_percent).toBe(9.5);
  });

  it('does not recalculate metrics for incomplete updates', () => {
    const withMetrics = applyDerivedMetricsToTradeUpdate({
      status: 'closed',
      side: 'long',
      entry_price: 100,
      size: 10,
      fees: 5,
    });

    expect(withMetrics.pnl).toBeUndefined();
    expect(withMetrics.pnl_percent).toBeUndefined();
  });

  it('derives metrics for create flow and builds image inserts', () => {
    const metrics = deriveTradeMetricsForCreate(mapTradeFormToInsert(formData));
    const imageInserts = buildTradeImageInserts({
      tradeId: 'trade-1',
      userId: 'user-1',
      imagePaths: ['img/a.jpg', 'img/b.jpg'],
    });

    expect(metrics).toEqual({ pnl: 95, pnl_percent: 9.5 });
    expect(imageInserts).toEqual([
      {
        trade_id: 'trade-1',
        user_id: 'user-1',
        storage_path: 'img/a.jpg',
        sort_order: 0,
      },
      {
        trade_id: 'trade-1',
        user_id: 'user-1',
        storage_path: 'img/b.jpg',
        sort_order: 1,
      },
    ]);
  });

  it('returns no image inserts when no image paths are provided', () => {
    const imageInserts = buildTradeImageInserts({
      tradeId: 'trade-1',
      userId: 'user-1',
      imagePaths: [],
    });

    expect(imageInserts).toEqual([]);
  });
});
