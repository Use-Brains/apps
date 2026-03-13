import type { TradeFormData, TradeInsert, TradeUpdate } from '@/types/trades';
import { calculatePnl } from '@/utils/pnl';

export function mapTradeFormToInsert(
  data: TradeFormData
): Omit<TradeInsert, 'user_id' | 'pnl' | 'pnl_percent'> {
  return {
    symbol: data.symbol,
    asset_class: data.asset_class,
    side: data.side,
    status: data.status,
    entry_price: data.entry_price,
    exit_price: data.exit_price ?? null,
    size: data.size,
    fees: data.fees,
    entry_date: data.entry_date,
    exit_date: data.exit_date ?? null,
    confidence: data.confidence ?? null,
    thesis: data.thesis ?? null,
    notes: data.notes ?? null,
    setup_tags: data.setup_tags,
    mistake_tags: data.mistake_tags,
  };
}

export function mapTradeFormToUpdate(data: TradeFormData): Omit<TradeUpdate, 'id'> {
  return {
    symbol: data.symbol,
    asset_class: data.asset_class,
    side: data.side,
    status: data.status,
    entry_price: data.entry_price,
    exit_price: data.exit_price ?? null,
    size: data.size,
    fees: data.fees,
    entry_date: data.entry_date,
    exit_date: data.exit_date ?? null,
    confidence: data.confidence ?? null,
    thesis: data.thesis ?? null,
    notes: data.notes ?? null,
    setup_tags: data.setup_tags,
    mistake_tags: data.mistake_tags,
  };
}

export function applyDerivedMetricsToTradeUpdate(input: TradeUpdate): TradeUpdate {
  const updates: TradeUpdate = { ...input };

  const hasClosedTradeInputs =
    input.status === 'closed' &&
    input.exit_price != null &&
    input.entry_price != null &&
    input.size != null &&
    input.side != null;

  if (hasClosedTradeInputs) {
    const result = calculatePnl({
      side: input.side,
      entry_price: input.entry_price,
      exit_price: input.exit_price,
      size: input.size,
      fees: input.fees ?? 0,
    });

    updates.pnl = result.pnl;
    updates.pnl_percent = result.pnl_percent;
  }

  return updates;
}

export function deriveTradeMetricsForCreate(
  input: Omit<TradeInsert, 'user_id' | 'pnl' | 'pnl_percent'>
): { pnl: number | null; pnl_percent: number | null } {
  if (input.status !== 'closed' || input.exit_price == null) {
    return { pnl: null, pnl_percent: null };
  }

  const result = calculatePnl({
    side: input.side,
    entry_price: input.entry_price,
    exit_price: input.exit_price,
    size: input.size,
    fees: input.fees ?? 0,
  });

  return { pnl: result.pnl, pnl_percent: result.pnl_percent };
}

export function buildTradeImageInserts(params: {
  tradeId: string;
  userId: string;
  imagePaths: string[];
}) {
  return params.imagePaths.map((path, index) => ({
    trade_id: params.tradeId,
    user_id: params.userId,
    storage_path: path,
    sort_order: index,
  }));
}
