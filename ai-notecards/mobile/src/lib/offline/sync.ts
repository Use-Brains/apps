import { api } from '@/lib/api';
import { getPendingSessions, markSessionSynced } from './repository';

const FAILURE_BACKOFF_MS = 30 * 1000;

let lastSyncFailureAt = 0;

export async function syncPendingSessions(options: { now?: Date } = {}) {
  const now = options.now ?? new Date();
  if (lastSyncFailureAt && now.getTime() - lastSyncFailureAt < FAILURE_BACKOFF_MS) {
    throw new Error('Sync backoff active');
  }

  const sessions = await getPendingSessions(null);
  if (sessions.length === 0) {
    return { syncedCount: 0 };
  }

  try {
    const result = await api.syncStudySessions(
      sessions.slice(0, 25).map((session) => ({
        client_session_id: session.clientSessionId,
        deck_id: session.deckId,
        mode: session.mode,
        correct: session.correct,
        total_cards: session.total,
        started_at: session.startedAt,
        completed_at: session.completedAt,
        deck_snapshot_updated_at: session.deckSnapshotUpdatedAt,
      })),
    );

    const syncedIds = [...result.acceptedSessionIds, ...result.dedupedSessionIds];
    for (const clientSessionId of syncedIds) {
      await markSessionSynced(null, clientSessionId);
    }

    lastSyncFailureAt = 0;

    return { syncedCount: syncedIds.length };
  } catch (error) {
    lastSyncFailureAt = now.getTime();
    throw error;
  }
}
