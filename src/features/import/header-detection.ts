import { FIELD_ALIASES } from './constants';
import { normalizeHeader } from './matcher';
import type { HeaderDetectionResult } from './types';

function isLikelyText(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[\d$,.:%+-]+$/.test(trimmed)) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return false;
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(trimmed)) return false;
  return true;
}

function mappedFieldCount(cells: string[]): number {
  const normalized = cells.map(normalizeHeader);
  return normalized.filter((cell) => {
    if (!cell) return false;
    return Object.values(FIELD_ALIASES).some((aliases) =>
      aliases.some((alias) => normalizeHeader(alias) === cell)
    );
  }).length;
}

export function detectHeader(rows: string[][]): HeaderDetectionResult {
  if (rows.length === 0) {
    return { hasHeader: false, columns: [], dataRows: [] };
  }

  const firstRow = rows[0] ?? [];
  const secondRow = rows[1] ?? [];

  const nonEmptyCells = firstRow.filter((cell) => cell.trim().length > 0);
  const uniqueRatio =
    nonEmptyCells.length === 0
      ? 0
      : new Set(nonEmptyCells.map((cell) => normalizeHeader(cell))).size / nonEmptyCells.length;

  const textRatio =
    nonEmptyCells.length === 0
      ? 0
      : nonEmptyCells.filter((cell) => isLikelyText(cell)).length / nonEmptyCells.length;

  const secondRowLooksData = secondRow.some((cell) => !isLikelyText(cell));
  const aliasMatches = mappedFieldCount(firstRow);

  const hasHeader = uniqueRatio >= 0.8 && textRatio >= 0.6 && secondRowLooksData && aliasMatches >= 2;

  if (hasHeader) {
    return {
      hasHeader: true,
      columns: firstRow.map((c, index) => c.trim() || `column_${index + 1}`),
      dataRows: rows.slice(1),
    };
  }

  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const columns = Array.from({ length: maxColumns }, (_, idx) => `Column ${String.fromCharCode(65 + idx)}`);

  return {
    hasHeader: false,
    columns,
    dataRows: rows,
  };
}
