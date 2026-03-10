import { tradeFormSchema } from '@/types/trades';
import {
  REQUIRED_FIELDS,
  SIDE_ALIASES,
  STATUS_ALIASES,
  SUPPORTED_ASSET_CLASSES,
} from './constants';
import { parseDateToIso } from './date-parse';
import type {
  CanonicalTradeField,
  ImportColumnBinding,
  ImportRowResult,
  NormalizedTradeInput,
} from './types';

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const negativeWrapped = /^\(.+\)$/.test(trimmed);
  const cleaned = trimmed
    .replace(/[,$%\s]/g, '')
    .replace(/[()]/g, '');

  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;
  return negativeWrapped ? -parsed : parsed;
}

function parseSide(raw: string): 'long' | 'short' | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  return SIDE_ALIASES[normalized] ?? null;
}

function parseStatus(raw: string): 'open' | 'closed' | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return null;
  return STATUS_ALIASES[normalized] ?? null;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[;,|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getMappedValue(
  field: CanonicalTradeField,
  row: Record<string, string>,
  bindings: ImportColumnBinding[]
): string {
  const binding = bindings.find((b) => b.targetField === field);
  if (!binding) return '';
  return row[binding.sourceColumn] ?? '';
}

export function normalizeRow(params: {
  rowIndex: number;
  raw: Record<string, string>;
  bindings: ImportColumnBinding[];
  timeZone: string;
}): ImportRowResult {
  const errors: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    const bindingExists = params.bindings.some((binding) => binding.targetField === field);
    if (!bindingExists) {
      errors.push(`Missing mapping for required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return {
      rowIndex: params.rowIndex,
      normalized: null,
      errors,
      raw: params.raw,
    };
  }

  const symbol = getMappedValue('symbol', params.raw, params.bindings).trim().toUpperCase();
  const side = parseSide(getMappedValue('side', params.raw, params.bindings));
  const size = parseNumber(getMappedValue('size', params.raw, params.bindings));
  const entryPrice = parseNumber(getMappedValue('entry_price', params.raw, params.bindings));
  const entryDate = parseDateToIso(
    getMappedValue('entry_date', params.raw, params.bindings),
    params.timeZone
  );

  const statusMapped = parseStatus(getMappedValue('status', params.raw, params.bindings));

  const exitPriceRaw = parseNumber(getMappedValue('exit_price', params.raw, params.bindings));
  const exitDateRaw = parseDateToIso(
    getMappedValue('exit_date', params.raw, params.bindings),
    params.timeZone
  );

  const inferredStatus: 'open' | 'closed' =
    statusMapped ?? (exitPriceRaw != null && exitDateRaw != null ? 'closed' : 'open');

  const fees = parseNumber(getMappedValue('fees', params.raw, params.bindings)) ?? 0;
  const confidenceRaw = parseNumber(getMappedValue('confidence', params.raw, params.bindings));
  const confidence = confidenceRaw != null ? Math.round(confidenceRaw) : null;

  const assetClassRaw = getMappedValue('asset_class', params.raw, params.bindings).trim().toLowerCase();
  const assetClass = SUPPORTED_ASSET_CLASSES.has(assetClassRaw) ? assetClassRaw : 'crypto';

  const draft: NormalizedTradeInput = {
    symbol,
    side: side ?? 'long',
    size: size ?? 0,
    entry_price: entryPrice ?? 0,
    entry_date: entryDate ?? '',
    status: inferredStatus,
    exit_price: inferredStatus === 'closed' ? exitPriceRaw : null,
    exit_date: inferredStatus === 'closed' ? exitDateRaw : null,
    asset_class: assetClass as NormalizedTradeInput['asset_class'],
    fees,
    confidence,
    thesis: getMappedValue('thesis', params.raw, params.bindings).trim() || null,
    notes: getMappedValue('notes', params.raw, params.bindings).trim() || null,
    setup_tags: parseTags(getMappedValue('setup_tags', params.raw, params.bindings)),
    mistake_tags: parseTags(getMappedValue('mistake_tags', params.raw, params.bindings)),
  };

  if (!side) errors.push('Invalid or missing side');
  if (size == null) errors.push('Invalid or missing size');
  if (entryPrice == null) errors.push('Invalid or missing entry_price');
  if (!entryDate) errors.push('Invalid or missing entry_date');
  if (!symbol) errors.push('Invalid or missing symbol');

  if (errors.length > 0) {
    return {
      rowIndex: params.rowIndex,
      normalized: null,
      errors,
      raw: params.raw,
    };
  }

  const validated = tradeFormSchema.safeParse({
    symbol: draft.symbol,
    asset_class: draft.asset_class,
    side: draft.side,
    status: draft.status,
    entry_price: draft.entry_price,
    exit_price: draft.exit_price,
    size: draft.size,
    fees: draft.fees,
    entry_date: draft.entry_date,
    exit_date: draft.exit_date,
    confidence: draft.confidence,
    thesis: draft.thesis,
    notes: draft.notes,
    setup_tags: draft.setup_tags,
    mistake_tags: draft.mistake_tags,
  });

  if (!validated.success) {
    return {
      rowIndex: params.rowIndex,
      normalized: null,
      errors: validated.error.issues.map((issue) => issue.message),
      raw: params.raw,
    };
  }

  return {
    rowIndex: params.rowIndex,
    normalized: draft,
    errors: [],
    raw: params.raw,
  };
}

export function toRowRecord(columns: string[], row: string[]): Record<string, string> {
  return columns.reduce<Record<string, string>>((acc, column, index) => {
    acc[column] = row[index] ?? '';
    return acc;
  }, {});
}
