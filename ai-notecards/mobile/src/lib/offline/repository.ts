import { getOfflineDb } from './db';
import type {
  OfflineCardRow,
  OfflineDb,
  OfflineDeck,
  OfflineDeckRow,
  OfflineDeckSnapshot,
  PendingSession,
  PendingSessionRow,
} from './types';

function mapDeckRow(row: OfflineDeckRow, cards: OfflineCardRow[]): OfflineDeck {
  return {
    id: row.id,
    title: row.title,
    cardCount: row.card_count,
    origin: row.origin,
    downloadedAt: row.downloaded_at,
    serverUpdatedAt: row.server_updated_at,
    deletedOnServer: row.deleted_on_server === 1,
    cards: cards.map((card) => ({
      id: card.id,
      deckId: card.deck_id,
      front: card.front,
      back: card.back,
      position: card.position,
    })),
  };
}

function mapPendingSession(row: PendingSessionRow): PendingSession {
  return {
    clientSessionId: row.client_session_id,
    deckId: row.deck_id,
    mode: row.mode,
    correct: row.correct,
    total: row.total,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    deckSnapshotUpdatedAt: row.deck_snapshot_updated_at,
    synced: row.synced === 1,
  };
}

export async function saveDeckSnapshot(inputDb: OfflineDb | null, snapshot: OfflineDeckSnapshot) {
  const db = inputDb ?? await getOfflineDb();

  await db.execAsync('BEGIN');

  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO local_decks (id, title, card_count, origin, downloaded_at, server_updated_at, deleted_on_server) VALUES (?, ?, ?, ?, ?, ?, ?)',
      snapshot.id,
      snapshot.title,
      snapshot.cardCount,
      snapshot.origin,
      snapshot.downloadedAt,
      snapshot.serverUpdatedAt,
      snapshot.deletedOnServer ? 1 : 0,
    );

    await db.runAsync('DELETE FROM local_cards WHERE deck_id = ?', snapshot.id);

    for (const card of snapshot.cards) {
      await db.runAsync(
        'INSERT INTO local_cards (id, deck_id, front, back, position) VALUES (?, ?, ?, ?, ?)',
        card.id,
        snapshot.id,
        card.front,
        card.back,
        card.position,
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export async function getDownloadedDeck(inputDb: OfflineDb | null, deckId: string) {
  const db = inputDb ?? await getOfflineDb();
  const deck = await db.getFirstAsync<OfflineDeckRow>('SELECT * FROM local_decks WHERE id = ?', deckId);

  if (!deck) {
    return null;
  }

  const cards = await db.getAllAsync<OfflineCardRow>(
    'SELECT * FROM local_cards WHERE deck_id = ? ORDER BY position ASC',
    deckId,
  );

  return mapDeckRow(deck, cards);
}

export async function getDownloadedDecks(inputDb: OfflineDb | null) {
  const db = inputDb ?? await getOfflineDb();
  const decks = await db.getAllAsync<OfflineDeckRow>(
    'SELECT * FROM local_decks ORDER BY downloaded_at DESC',
  );

  return Promise.all(decks.map(async (deck) => {
    const cards = await db.getAllAsync<OfflineCardRow>(
      'SELECT * FROM local_cards WHERE deck_id = ? ORDER BY position ASC',
      deck.id,
    );
    return mapDeckRow(deck, cards);
  }));
}

export async function removeDownloadedDeck(inputDb: OfflineDb | null, deckId: string) {
  const db = inputDb ?? await getOfflineDb();
  await db.runAsync('DELETE FROM local_decks WHERE id = ?', deckId);
}

export async function markDeckDeletedOnServer(inputDb: OfflineDb | null, deckId: string, deletedOnServer = true) {
  const db = inputDb ?? await getOfflineDb();
  await db.runAsync(
    'UPDATE local_decks SET deleted_on_server = ? WHERE id = ?',
    deletedOnServer ? 1 : 0,
    deckId,
  );
}

export async function enqueuePendingSession(inputDb: OfflineDb | null, session: PendingSession) {
  const db = inputDb ?? await getOfflineDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO pending_sessions (client_session_id, deck_id, mode, correct, total, started_at, completed_at, deck_snapshot_updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    session.clientSessionId,
    session.deckId,
    session.mode,
    session.correct,
    session.total,
    session.startedAt,
    session.completedAt,
    session.deckSnapshotUpdatedAt,
    session.synced ? 1 : 0,
  );
}

export async function getPendingSessions(inputDb: OfflineDb | null) {
  const db = inputDb ?? await getOfflineDb();
  const rows = await db.getAllAsync<PendingSessionRow>(
    'SELECT * FROM pending_sessions WHERE synced = 0 ORDER BY completed_at ASC',
  );
  return rows.map(mapPendingSession);
}

export async function markSessionSynced(inputDb: OfflineDb | null, clientSessionId: string) {
  const db = inputDb ?? await getOfflineDb();
  await db.runAsync('UPDATE pending_sessions SET synced = 1 WHERE client_session_id = ?', clientSessionId);
}

export async function purgeSyncedSessions(inputDb: OfflineDb | null, olderThanIso: string) {
  const db = inputDb ?? await getOfflineDb();
  await db.runAsync(
    'DELETE FROM pending_sessions WHERE synced = 1 AND completed_at < ?',
    olderThanIso,
  );
}
