import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

import { bootstrapOfflineDb } from '../../src/lib/offline/schema';
import {
  enqueuePendingSession,
  getDownloadedDeck,
  getPendingSessions,
  markSessionSynced,
  purgeSyncedSessions,
  saveDeckSnapshot,
} from '../../src/lib/offline/repository';

type DeckRow = {
  id: string;
  title: string;
  card_count: number;
  origin: string;
  downloaded_at: number;
  server_updated_at: string | null;
  deleted_on_server: number;
};

type CardRow = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  position: number;
};

type PendingSessionRow = {
  client_session_id: string;
  deck_id: string;
  mode: string;
  correct: number;
  total: number;
  started_at: string;
  completed_at: string;
  deck_snapshot_updated_at: string | null;
  synced: number;
};

class FakeOfflineDb {
  decks = new Map<string, DeckRow>();
  cards = new Map<string, CardRow[]>();
  pendingSessions = new Map<string, PendingSessionRow>();
  executedSql: string[] = [];
  inTransaction = false;

  async execAsync(sql: string) {
    this.executedSql.push(sql);
    if (sql.includes('BEGIN')) this.inTransaction = true;
    if (sql.includes('COMMIT') || sql.includes('ROLLBACK')) this.inTransaction = false;
  }

  async runAsync(sql: string, ...params: Array<string | number | null>) {
    if (sql.startsWith('INSERT OR REPLACE INTO local_decks')) {
      const [id, title, cardCount, origin, downloadedAt, serverUpdatedAt, deletedOnServer] = params;
      this.decks.set(String(id), {
        id: String(id),
        title: String(title),
        card_count: Number(cardCount),
        origin: String(origin),
        downloaded_at: Number(downloadedAt),
        server_updated_at: serverUpdatedAt ? String(serverUpdatedAt) : null,
        deleted_on_server: Number(deletedOnServer),
      });
      return;
    }

    if (sql.startsWith('DELETE FROM local_cards WHERE deck_id = ?')) {
      this.cards.set(String(params[0]), []);
      return;
    }

    if (sql.startsWith('INSERT INTO local_cards')) {
      const [id, deckId, front, back, position] = params;
      const deckCards = this.cards.get(String(deckId)) || [];
      deckCards.push({
        id: String(id),
        deck_id: String(deckId),
        front: String(front),
        back: String(back),
        position: Number(position),
      });
      deckCards.sort((left, right) => left.position - right.position);
      this.cards.set(String(deckId), deckCards);
      return;
    }

    if (sql.startsWith('INSERT OR REPLACE INTO pending_sessions')) {
      const [
        clientSessionId,
        deckId,
        mode,
        correct,
        total,
        startedAt,
        completedAt,
        deckSnapshotUpdatedAt,
        synced,
      ] = params;
      this.pendingSessions.set(String(clientSessionId), {
        client_session_id: String(clientSessionId),
        deck_id: String(deckId),
        mode: String(mode),
        correct: Number(correct),
        total: Number(total),
        started_at: String(startedAt),
        completed_at: String(completedAt),
        deck_snapshot_updated_at: deckSnapshotUpdatedAt ? String(deckSnapshotUpdatedAt) : null,
        synced: Number(synced),
      });
      return;
    }

    if (sql.startsWith('UPDATE pending_sessions SET synced = 1')) {
      const row = this.pendingSessions.get(String(params[0]));
      if (row) {
        row.synced = 1;
      }
      return;
    }

    if (sql.startsWith('DELETE FROM pending_sessions WHERE synced = 1')) {
      const threshold = params[0] ? String(params[0]) : '';
      for (const [id, row] of this.pendingSessions.entries()) {
        if (row.synced === 1 && row.completed_at < threshold) {
          this.pendingSessions.delete(id);
        }
      }
      return;
    }

    throw new Error(`Unhandled SQL in fake DB: ${sql}`);
  }

  async getFirstAsync<T>(sql: string, ...params: Array<string | number>) {
    if (sql.startsWith('SELECT * FROM local_decks WHERE id = ?')) {
      const deck = this.decks.get(String(params[0]));
      return (deck ?? null) as T | null;
    }

    throw new Error(`Unhandled getFirstAsync SQL: ${sql}`);
  }

  async getAllAsync<T>(sql: string, ...params: Array<string | number>) {
    if (sql.startsWith('SELECT * FROM local_cards WHERE deck_id = ?')) {
      return ((this.cards.get(String(params[0])) || []) as T[]);
    }

    if (sql.startsWith('SELECT * FROM pending_sessions WHERE synced = 0')) {
      return ([...this.pendingSessions.values()]
        .filter((row) => row.synced === 0)
        .sort((left, right) => left.completed_at.localeCompare(right.completed_at)) as T[]);
    }

    throw new Error(`Unhandled getAllAsync SQL: ${sql}`);
  }
}

describe('offline SQLite repository', () => {
  let db: FakeOfflineDb;

  beforeEach(() => {
    db = new FakeOfflineDb();
  });

  it('bootstraps the local offline schema', async () => {
    await bootstrapOfflineDb(db as never);

    const schemaSql = db.executedSql.join('\n');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS local_decks');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS local_cards');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS pending_sessions');
  });

  it('replaces stale deck card rows atomically when saving a deck snapshot', async () => {
    await saveDeckSnapshot(db as never, {
      id: 'deck-1',
      title: 'Original',
      cardCount: 1,
      origin: 'generated',
      downloadedAt: 1,
      serverUpdatedAt: '2026-03-15T10:00:00.000Z',
      deletedOnServer: false,
      cards: [{ id: 'card-1', deckId: 'deck-1', front: 'A', back: 'B', position: 0 }],
    });

    await saveDeckSnapshot(db as never, {
      id: 'deck-1',
      title: 'Refreshed',
      cardCount: 2,
      origin: 'generated',
      downloadedAt: 2,
      serverUpdatedAt: '2026-03-15T11:00:00.000Z',
      deletedOnServer: false,
      cards: [
        { id: 'card-2', deckId: 'deck-1', front: 'C', back: 'D', position: 0 },
        { id: 'card-3', deckId: 'deck-1', front: 'E', back: 'F', position: 1 },
      ],
    });

    const deck = await getDownloadedDeck(db as never, 'deck-1');
    expect(deck?.title).toBe('Refreshed');
    expect(deck?.cards.map((card) => card.id)).toEqual(['card-2', 'card-3']);
    expect(db.inTransaction).toBe(false);
  });

  it('persists pending sessions durably and returns them in completion order', async () => {
    await enqueuePendingSession(db as never, {
      clientSessionId: 'session-2',
      deckId: 'deck-1',
      mode: 'flip',
      correct: 8,
      total: 10,
      startedAt: '2026-03-15T11:00:00.000Z',
      completedAt: '2026-03-15T11:05:00.000Z',
      deckSnapshotUpdatedAt: '2026-03-15T10:00:00.000Z',
      synced: false,
    });
    await enqueuePendingSession(db as never, {
      clientSessionId: 'session-1',
      deckId: 'deck-1',
      mode: 'flip',
      correct: 7,
      total: 10,
      startedAt: '2026-03-15T10:00:00.000Z',
      completedAt: '2026-03-15T10:05:00.000Z',
      deckSnapshotUpdatedAt: '2026-03-15T09:00:00.000Z',
      synced: false,
    });

    const pending = await getPendingSessions(db as never);
    expect(pending.map((entry) => entry.clientSessionId)).toEqual(['session-1', 'session-2']);
  });

  it('marks synced sessions and purges old synced rows safely', async () => {
    await enqueuePendingSession(db as never, {
      clientSessionId: 'old-session',
      deckId: 'deck-1',
      mode: 'flip',
      correct: 8,
      total: 10,
      startedAt: '2026-03-01T10:00:00.000Z',
      completedAt: '2026-03-01T10:05:00.000Z',
      deckSnapshotUpdatedAt: '2026-03-01T09:00:00.000Z',
      synced: false,
    });
    await enqueuePendingSession(db as never, {
      clientSessionId: 'new-session',
      deckId: 'deck-1',
      mode: 'flip',
      correct: 9,
      total: 10,
      startedAt: '2026-03-15T10:00:00.000Z',
      completedAt: '2026-03-15T10:05:00.000Z',
      deckSnapshotUpdatedAt: '2026-03-15T09:00:00.000Z',
      synced: false,
    });

    await markSessionSynced(db as never, 'old-session');
    await purgeSyncedSessions(db as never, '2026-03-10T00:00:00.000Z');

    const pending = await getPendingSessions(db as never);
    expect(pending.map((entry) => entry.clientSessionId)).toEqual(['new-session']);
  });
});
