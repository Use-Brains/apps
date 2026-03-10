import { File } from 'expo-file-system';
import type { ParsedCsv } from './types';

const DELIMITERS = [',', ';', '\t', '|'];

export function detectDelimiter(line: string): string {
  const scores = DELIMITERS.map((delimiter) => ({
    delimiter,
    count: line.split(delimiter).length - 1,
  }));

  scores.sort((a, b) => b.count - a.count);
  return scores[0]?.count > 0 ? scores[0].delimiter : ',';
}

export function parseCsvText(text: string): ParsedCsv {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const firstLine = normalized.split('\n')[0] ?? '';
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(field.trim());
      field = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  const maxCols = rows.reduce((max, current) => Math.max(max, current.length), 0);
  const paddedRows = rows
    .filter((r) => r.some((c) => c.length > 0))
    .map((r) => [...r, ...Array.from({ length: Math.max(0, maxCols - r.length) }, () => '')]);

  return { delimiter, rows: paddedRows };
}

export async function parseCsvFile(uri: string): Promise<ParsedCsv> {
  const file = new File(uri);
  const content = await file.text();
  return parseCsvText(content);
}
