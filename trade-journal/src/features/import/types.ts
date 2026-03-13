export type CanonicalTradeField =
  | 'symbol'
  | 'side'
  | 'size'
  | 'entry_price'
  | 'entry_date'
  | 'status'
  | 'exit_price'
  | 'exit_date'
  | 'asset_class'
  | 'fees'
  | 'confidence'
  | 'thesis'
  | 'notes'
  | 'setup_tags'
  | 'mistake_tags';

export interface ImportColumnBinding {
  sourceColumn: string;
  targetField: CanonicalTradeField | null;
  confidence: number;
  isManual: boolean;
}

export interface NormalizedTradeInput {
  symbol: string;
  asset_class: 'crypto' | 'stocks' | 'options' | 'futures' | 'forex';
  side: 'long' | 'short';
  status: 'open' | 'closed';
  entry_price: number;
  exit_price: number | null;
  size: number;
  fees: number;
  entry_date: string;
  exit_date: string | null;
  confidence: number | null;
  thesis: string | null;
  notes: string | null;
  setup_tags: string[];
  mistake_tags: string[];
}

export interface ImportRowResult {
  rowIndex: number;
  normalized: NormalizedTradeInput | null;
  errors: string[];
  raw: Record<string, string>;
}

export interface ImportDiff {
  field: CanonicalTradeField;
  existingValue: string;
  incomingValue: string;
}

export interface ImportConflict {
  importRowIndex: number;
  existingTradeId: string;
  diff: ImportDiff[];
}

export type ImportResolution = 'import' | 'skip' | 'replace';

export interface ImportExecutionFailure {
  rowIndex: number;
  reason: string;
  action: ImportResolution;
}

export interface ImportExecutionReport {
  imported: number;
  replaced: number;
  skippedInvalid: number;
  skippedDuplicate: number;
  failed: ImportExecutionFailure[];
}

export interface ImporterExtension {
  key: string;
  name: string;
  canHandle: (headers: string[], sampleRows: string[][]) => boolean;
}

export interface ParsedCsv {
  delimiter: string;
  rows: string[][];
}

export interface HeaderDetectionResult {
  hasHeader: boolean;
  columns: string[];
  dataRows: string[][];
}

export interface ExistingTradeForDedupe {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entry_date: string;
  entry_price?: number;
  exit_price?: number | null;
  status?: 'open' | 'closed';
}
