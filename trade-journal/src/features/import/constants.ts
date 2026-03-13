import type { CanonicalTradeField } from './types';

export const REQUIRED_FIELDS: CanonicalTradeField[] = [
  'symbol',
  'side',
  'size',
  'entry_price',
  'entry_date',
];

export const HEADER_AUTO_ASSIGN_THRESHOLD = 0.78;
export const HEADER_CONFIRMATION_THRESHOLD = 0.55;

export const CREATE_BATCH_SIZE = 200;
export const REPLACE_BATCH_SIZE = 100;
export const MUTATION_CONCURRENCY = 5;

export const SUPPORTED_ASSET_CLASSES = new Set(['crypto', 'stocks', 'options', 'futures', 'forex']);

export const SIDE_ALIASES: Record<string, 'long' | 'short'> = {
  long: 'long',
  buy: 'long',
  bullish: 'long',
  short: 'short',
  sell: 'short',
  bearish: 'short',
};

export const STATUS_ALIASES: Record<string, 'open' | 'closed'> = {
  open: 'open',
  active: 'open',
  live: 'open',
  closed: 'closed',
  close: 'closed',
  exited: 'closed',
  complete: 'closed',
  completed: 'closed',
};

export const CANONICAL_FIELDS: CanonicalTradeField[] = [
  'symbol',
  'side',
  'size',
  'entry_price',
  'entry_date',
  'status',
  'exit_price',
  'exit_date',
  'asset_class',
  'fees',
  'confidence',
  'thesis',
  'notes',
  'setup_tags',
  'mistake_tags',
];

export const FIELD_ALIASES: Record<CanonicalTradeField, string[]> = {
  symbol: ['symbol', 'ticker', 'instrument', 'pair', 'market'],
  side: ['side', 'direction', 'position', 'buy sell', 'long short'],
  size: ['size', 'qty', 'quantity', 'position size', 'contracts'],
  entry_price: ['entry price', 'open price', 'buy price', 'avg entry', 'entry'],
  entry_date: ['entry date', 'open date', 'entry time', 'opened at', 'entry'],
  status: ['status', 'trade status', 'state'],
  exit_price: ['exit price', 'close price', 'sell price', 'avg exit', 'exit'],
  exit_date: ['exit date', 'close date', 'exit time', 'closed at', 'close time'],
  asset_class: ['asset class', 'asset', 'market type', 'instrument type'],
  fees: ['fees', 'commission', 'cost', 'charges'],
  confidence: ['confidence', 'rating', 'conviction'],
  thesis: ['thesis', 'setup', 'reason', 'trade thesis'],
  notes: ['notes', 'comment', 'journal notes', 'review'],
  setup_tags: ['setup tags', 'setup', 'entry tags'],
  mistake_tags: ['mistake tags', 'mistakes', 'error tags'],
};

export const COMMON_DATE_FORMAT_HINTS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYY-MM-DD HH:mm:ss',
  'MM/DD/YYYY',
  'MM/DD/YYYY HH:mm:ss',
  'DD/MM/YYYY',
  'DD/MM/YYYY HH:mm:ss',
] as const;
