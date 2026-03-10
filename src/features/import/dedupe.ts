import type {
  ExistingTradeForDedupe,
  ImportConflict,
  ImportDiff,
  ImportRowResult,
  NormalizedTradeInput,
} from './types';

function to8(value: number): string {
  return (Math.round(value * 1e8) / 1e8).toFixed(8);
}

export function buildIdentityKey(input: {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entry_date: string;
}): string {
  return `${input.symbol.toUpperCase()}|${input.side}|${input.entry_date}|${to8(input.size)}`;
}

export function indexExistingTrades(trades: ExistingTradeForDedupe[]): Map<string, ExistingTradeForDedupe> {
  const index = new Map<string, ExistingTradeForDedupe>();
  for (const trade of trades) {
    const key = buildIdentityKey({
      symbol: trade.symbol,
      side: trade.side,
      size: trade.size,
      entry_date: trade.entry_date,
    });
    index.set(key, trade);
  }
  return index;
}

function buildDiff(existing: ExistingTradeForDedupe, incoming: NormalizedTradeInput): ImportDiff[] {
  const diffs: ImportDiff[] = [];

  if (existing.entry_price != null && Math.abs(existing.entry_price - incoming.entry_price) > 1e-8) {
    diffs.push({
      field: 'entry_price',
      existingValue: String(existing.entry_price),
      incomingValue: String(incoming.entry_price),
    });
  }

  if (
    existing.exit_price != null &&
    incoming.exit_price != null &&
    Math.abs(existing.exit_price - incoming.exit_price) > 1e-8
  ) {
    diffs.push({
      field: 'exit_price',
      existingValue: String(existing.exit_price),
      incomingValue: String(incoming.exit_price),
    });
  }

  if (existing.status && existing.status !== incoming.status) {
    diffs.push({
      field: 'status',
      existingValue: existing.status,
      incomingValue: incoming.status,
    });
  }

  return diffs;
}

export function detectImportConflicts(
  rowResults: ImportRowResult[],
  existingIndex: Map<string, ExistingTradeForDedupe>
): ImportConflict[] {
  const conflicts: ImportConflict[] = [];

  for (const row of rowResults) {
    if (!row.normalized) continue;

    const key = buildIdentityKey({
      symbol: row.normalized.symbol,
      side: row.normalized.side,
      size: row.normalized.size,
      entry_date: row.normalized.entry_date,
    });

    const existing = existingIndex.get(key);
    if (!existing) continue;

    conflicts.push({
      importRowIndex: row.rowIndex,
      existingTradeId: existing.id,
      diff: buildDiff(existing, row.normalized),
    });
  }

  return conflicts;
}
