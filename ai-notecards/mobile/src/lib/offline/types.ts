export type OfflineCard = {
  id: string;
  deckId: string;
  front: string;
  back: string;
  position: number;
};

export type OfflineDeck = {
  id: string;
  title: string;
  cardCount: number;
  origin: string;
  downloadedAt: number;
  serverUpdatedAt: string | null;
  deletedOnServer: boolean;
  cards: OfflineCard[];
};

export type OfflineDeckSnapshot = Omit<OfflineDeck, 'cards'> & {
  cards: OfflineCard[];
};

export type PendingSession = {
  clientSessionId: string;
  deckId: string;
  mode: string;
  correct: number;
  total: number;
  startedAt: string;
  completedAt: string;
  deckSnapshotUpdatedAt: string | null;
  synced: boolean;
};

export type OfflineDb = {
  execAsync: (sql: string) => Promise<unknown>;
  runAsync: (sql: string, ...params: (string | number | null)[]) => Promise<unknown>;
  getFirstAsync: <T>(sql: string, ...params: (string | number)[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: (string | number)[]) => Promise<T[]>;
};

export type OfflineDeckRow = {
  id: string;
  title: string;
  card_count: number;
  origin: string;
  downloaded_at: number;
  server_updated_at: string | null;
  deleted_on_server: number;
};

export type OfflineCardRow = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  position: number;
};

export type PendingSessionRow = {
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
