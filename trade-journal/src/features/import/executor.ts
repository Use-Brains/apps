import {
  CREATE_BATCH_SIZE,
  MUTATION_CONCURRENCY,
  REPLACE_BATCH_SIZE,
} from './constants';
import type {
  ImportConflict,
  ImportExecutionFailure,
  ImportExecutionReport,
  ImportResolution,
  ImportRowResult,
  NormalizedTradeInput,
} from './types';
import {
  applyDerivedMetricsToTradeUpdate,
  deriveTradeMetricsForCreate,
} from '@/utils/trade-payloads';
import type { TradeUpdate } from '@/types/trades';

export interface SupabaseLike {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>;
  };
  from: (table: string) => {
    insert: (values: unknown) => Promise<{ error: { message: string } | null }>;
    update: (values: unknown) => {
      eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>;
    };
  };
}

function chunk<T>(input: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) return;
      const result = await task();
      results.push(result);
    }
  });

  await Promise.all(workers);
  return results;
}

function buildConflictMap(conflicts: ImportConflict[]): Map<number, ImportConflict> {
  return conflicts.reduce<Map<number, ImportConflict>>((map, conflict) => {
    map.set(conflict.importRowIndex, conflict);
    return map;
  }, new Map());
}

function toTradeUpdate(input: NormalizedTradeInput): TradeUpdate {
  return {
    symbol: input.symbol,
    asset_class: input.asset_class,
    side: input.side,
    status: input.status,
    entry_price: input.entry_price,
    exit_price: input.exit_price ?? null,
    size: input.size,
    fees: input.fees,
    entry_date: input.entry_date,
    exit_date: input.exit_date ?? null,
    confidence: input.confidence ?? null,
    thesis: input.thesis ?? null,
    notes: input.notes ?? null,
    setup_tags: input.setup_tags,
    mistake_tags: input.mistake_tags,
  };
}

export async function executeImport(params: {
  supabase: SupabaseLike;
  rowResults: ImportRowResult[];
  conflicts: ImportConflict[];
  resolutions: Record<number, ImportResolution>;
  skippedInvalid: number;
}): Promise<ImportExecutionReport> {
  const { data: { user } } = await params.supabase.auth.getUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const failures: ImportExecutionFailure[] = [];
  const conflictMap = buildConflictMap(params.conflicts);

  const rowsToImport: Array<{ rowIndex: number; row: NormalizedTradeInput }> = [];
  const rowsToReplace: Array<{ rowIndex: number; row: NormalizedTradeInput; tradeId: string }> = [];
  let skippedDuplicate = 0;

  for (const rowResult of params.rowResults) {
    if (!rowResult.normalized) continue;

    const conflict = conflictMap.get(rowResult.rowIndex);
    if (!conflict) {
      rowsToImport.push({ rowIndex: rowResult.rowIndex, row: rowResult.normalized });
      continue;
    }

    const resolution = params.resolutions[rowResult.rowIndex] ?? 'skip';
    if (resolution === 'skip') {
      skippedDuplicate += 1;
      continue;
    }

    if (resolution === 'replace') {
      rowsToReplace.push({
        rowIndex: rowResult.rowIndex,
        row: rowResult.normalized,
        tradeId: conflict.existingTradeId,
      });
      continue;
    }

    rowsToImport.push({ rowIndex: rowResult.rowIndex, row: rowResult.normalized });
  }

  const replaceChunks = chunk(rowsToReplace, REPLACE_BATCH_SIZE);
  const replaceTasks = replaceChunks.map((replaceChunk) => async () => {
    await Promise.all(
      replaceChunk.map(async (entry) => {
        const update = applyDerivedMetricsToTradeUpdate(toTradeUpdate(entry.row));
        const { error } = await params.supabase
          .from('trades')
          .update(update)
          .eq('id', entry.tradeId);

        if (error) {
          failures.push({
            rowIndex: entry.rowIndex,
            reason: error.message,
            action: 'replace',
          });
        }
      })
    );
  });

  await runWithConcurrency(replaceTasks, MUTATION_CONCURRENCY);

  const importChunks = chunk(rowsToImport, CREATE_BATCH_SIZE);
  const importTasks = importChunks.map((importChunk) => async () => {
    const payload = importChunk.map(({ row }) => {
      const metrics = deriveTradeMetricsForCreate(row);
      return {
        ...row,
        user_id: user.id,
        pnl: metrics.pnl,
        pnl_percent: metrics.pnl_percent,
      };
    });

    const { error } = await params.supabase.from('trades').insert(payload);

    if (error) {
      for (const entry of importChunk) {
        failures.push({
          rowIndex: entry.rowIndex,
          reason: error.message,
          action: 'import',
        });
      }
    }
  });

  await runWithConcurrency(importTasks, MUTATION_CONCURRENCY);

  const failedImportRows = new Set(
    failures.filter((failure) => failure.action === 'import').map((failure) => failure.rowIndex)
  );
  const failedReplaceRows = new Set(
    failures.filter((failure) => failure.action === 'replace').map((failure) => failure.rowIndex)
  );

  const imported = rowsToImport.filter((entry) => !failedImportRows.has(entry.rowIndex)).length;
  const replaced = rowsToReplace.filter((entry) => !failedReplaceRows.has(entry.rowIndex)).length;

  return {
    imported,
    replaced,
    skippedInvalid: params.skippedInvalid,
    skippedDuplicate,
    failed: failures.sort((a, b) => a.rowIndex - b.rowIndex),
  };
}
