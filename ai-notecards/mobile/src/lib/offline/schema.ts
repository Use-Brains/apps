import type { OfflineDb } from './types';

const OFFLINE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS local_decks (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    card_count INTEGER NOT NULL,
    origin TEXT NOT NULL,
    downloaded_at INTEGER NOT NULL,
    server_updated_at TEXT,
    deleted_on_server INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS local_cards (
    id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL REFERENCES local_decks(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pending_sessions (
    client_session_id TEXT PRIMARY KEY NOT NULL,
    deck_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    correct INTEGER NOT NULL,
    total INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    deck_snapshot_updated_at TEXT,
    synced INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_local_cards_deck_id
    ON local_cards(deck_id);

  CREATE INDEX IF NOT EXISTS idx_pending_sessions_synced_completed_at
    ON pending_sessions(synced, completed_at);
`;

export async function bootstrapOfflineDb(db: OfflineDb) {
  await db.execAsync(OFFLINE_SCHEMA);
}
