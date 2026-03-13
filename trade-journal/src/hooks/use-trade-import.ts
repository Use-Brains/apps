import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { tradeKeys } from '@/types/trades';
import { parseCsvFile } from '@/features/import/csv';
import { detectHeader } from '@/features/import/header-detection';
import { autoMatchColumns } from '@/features/import/matcher';
import { detectImportConflicts, indexExistingTrades } from '@/features/import/dedupe';
import { normalizeRow, toRowRecord } from '@/features/import/normalize';
import { executeImport } from '@/features/import/executor';
import type {
  ExistingTradeForDedupe,
  ImportColumnBinding,
  ImportConflict,
  ImportExecutionReport,
  ImportResolution,
  ImportRowResult,
} from '@/features/import/types';

function minMaxEntryDates(rowResults: ImportRowResult[]): { min: string; max: string } | null {
  const dates = rowResults
    .filter((row) => row.normalized)
    .map((row) => row.normalized!.entry_date)
    .sort();

  if (dates.length === 0) return null;
  return { min: dates[0], max: dates[dates.length - 1] };
}

function expandDateRange(range: { min: string; max: string }): { min: string; max: string } {
  const min = new Date(range.min);
  const max = new Date(range.max);

  min.setUTCDate(min.getUTCDate() - 1);
  max.setUTCDate(max.getUTCDate() + 1);

  return { min: min.toISOString(), max: max.toISOString() };
}

export interface ParsedImportSession {
  hasHeader: boolean;
  columns: string[];
  dataRows: string[][];
  bindings: ImportColumnBinding[];
}

export interface PreviewImportSession {
  rowResults: ImportRowResult[];
  conflicts: ImportConflict[];
  skippedInvalid: number;
}

export function useTradeImport() {
  const queryClient = useQueryClient();

  const executeMutation = useMutation({
    mutationFn: async (params: {
      preview: PreviewImportSession;
      resolutions: Record<number, ImportResolution>;
    }): Promise<ImportExecutionReport> => {
      return executeImport({
        supabase,
        rowResults: params.preview.rowResults,
        conflicts: params.preview.conflicts,
        resolutions: params.resolutions,
        skippedInvalid: params.preview.skippedInvalid,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tradeKeys.all });
    },
  });

  const parseFile = async (uri: string): Promise<ParsedImportSession> => {
    const parsedCsv = await parseCsvFile(uri);
    const detected = detectHeader(parsedCsv.rows);

    return {
      hasHeader: detected.hasHeader,
      columns: detected.columns,
      dataRows: detected.dataRows,
      bindings: detected.hasHeader
        ? autoMatchColumns(detected.columns)
        : detected.columns.map((column) => ({
            sourceColumn: column,
            targetField: null,
            confidence: 0,
            isManual: false,
          })),
    };
  };

  const buildPreview = async (params: {
    dataRows: string[][];
    columns: string[];
    bindings: ImportColumnBinding[];
    timeZone: string;
  }): Promise<PreviewImportSession> => {
    const rowResults = params.dataRows.map((row, index) =>
      normalizeRow({
        rowIndex: index,
        raw: toRowRecord(params.columns, row),
        bindings: params.bindings,
        timeZone: params.timeZone,
      })
    );

    const validRows = rowResults.filter((row) => row.normalized);
    const skippedInvalid = rowResults.length - validRows.length;

    if (validRows.length === 0) {
      return { rowResults, skippedInvalid, conflicts: [] };
    }

    const symbols = Array.from(
      new Set(validRows.map((row) => row.normalized!.symbol).filter(Boolean))
    );

    const range = minMaxEntryDates(rowResults);
    if (!range || symbols.length === 0) {
      return { rowResults, skippedInvalid, conflicts: [] };
    }

    const expanded = expandDateRange(range);

    const { data, error } = await supabase
      .from('trades')
      .select('id, symbol, side, size, entry_date, entry_price, exit_price, status')
      .in('symbol', symbols)
      .gte('entry_date', expanded.min)
      .lte('entry_date', expanded.max);

    if (error) throw error;

    const existingTrades: ExistingTradeForDedupe[] = (data ?? []) as ExistingTradeForDedupe[];
    const existingIndex = indexExistingTrades(existingTrades);
    const conflicts = detectImportConflicts(rowResults, existingIndex);

    return {
      rowResults,
      conflicts,
      skippedInvalid,
    };
  };

  return {
    parseFile,
    buildPreview,
    execute: executeMutation.mutateAsync,
    executing: executeMutation.isPending,
  };
}
