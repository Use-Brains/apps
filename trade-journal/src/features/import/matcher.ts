import {
  CANONICAL_FIELDS,
  FIELD_ALIASES,
  HEADER_AUTO_ASSIGN_THRESHOLD,
} from './constants';
import type { CanonicalTradeField, ImportColumnBinding } from './types';

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeHeader(value).split(' ').filter(Boolean);
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  return intersection / Math.max(aTokens.size, bTokens.size);
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a: string, b: string): number {
  const na = normalizeHeader(a);
  const nb = normalizeHeader(b);
  if (!na || !nb) return 0;
  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - distance / maxLen;
}

function scoreField(header: string, field: CanonicalTradeField): number {
  const normalizedHeader = normalizeHeader(header);
  const aliases = FIELD_ALIASES[field];

  for (const alias of aliases) {
    if (normalizeHeader(alias) === normalizedHeader) {
      return 1.0;
    }
  }

  let tokenBest = 0;
  let fuzzyBest = 0;

  for (const alias of aliases) {
    const overlap = tokenOverlapScore(normalizedHeader, alias);
    if (overlap > tokenBest) tokenBest = overlap;

    const fuzzy = similarity(normalizedHeader, alias);
    if (fuzzy > fuzzyBest) fuzzyBest = fuzzy;
  }

  if (tokenBest >= 0.6) return 0.85;
  if (fuzzyBest >= 0.82) return 0.7;

  return 0;
}

export function autoMatchColumns(columns: string[]): ImportColumnBinding[] {
  const usedFields = new Set<CanonicalTradeField>();

  return columns.map((column) => {
    let bestField: CanonicalTradeField | null = null;
    let bestScore = 0;

    for (const field of CANONICAL_FIELDS) {
      if (usedFields.has(field)) continue;
      const score = scoreField(column, field);
      if (score > bestScore) {
        bestField = field;
        bestScore = score;
      }
    }

    if (bestField && bestScore >= HEADER_AUTO_ASSIGN_THRESHOLD) {
      usedFields.add(bestField);
      return {
        sourceColumn: column,
        targetField: bestField,
        confidence: bestScore,
        isManual: false,
      };
    }

    return {
      sourceColumn: column,
      targetField: null,
      confidence: bestScore,
      isManual: false,
    };
  });
}
