import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getDeck: vi.fn(),
    getDecks: vi.fn(),
    syncStudySessions: vi.fn(),
  },
}));

const repositoryMocks = vi.hoisted(() => ({
  getDownloadedDecks: vi.fn(),
  markDeckDeletedOnServer: vi.fn(),
  getPendingSessions: vi.fn(),
  markSessionSynced: vi.fn(),
  saveDeckSnapshot: vi.fn(),
}));

vi.mock('../../src/lib/api', () => ({
  api: apiMock,
}));

vi.mock('../../src/lib/offline/repository', () => repositoryMocks);

describe('offline sync helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('downloads a deck and saves its snapshot atomically', async () => {
    apiMock.getDeck.mockResolvedValue({
      deck: {
        id: 'deck-1',
        title: 'Offline Deck',
        origin: 'generated',
        cardCount: 2,
        updatedAt: '2026-03-15T11:00:00.000Z',
        cards: [
          { id: 'card-1', deckId: 'deck-1', front: 'Q1', back: 'A1', position: 0, createdAt: '2026-03-15T10:00:00.000Z' },
          { id: 'card-2', deckId: 'deck-1', front: 'Q2', back: 'A2', position: 1, createdAt: '2026-03-15T10:01:00.000Z' },
        ],
      },
      cards: [],
    });

    const { downloadDeckForOffline } = await import('../../src/lib/offline/downloads');
    await downloadDeckForOffline('deck-1');

    expect(apiMock.getDeck).toHaveBeenCalledWith('deck-1');
    expect(repositoryMocks.saveDeckSnapshot).toHaveBeenCalledTimes(1);
  });

  it('refreshes downloaded decks and only refetches changed entries', async () => {
    repositoryMocks.getDownloadedDecks.mockResolvedValue([
      {
        id: 'deck-1',
        title: 'Deck One',
        serverUpdatedAt: '2026-03-15T09:00:00.000Z',
      },
      {
        id: 'deck-2',
        title: 'Deck Two',
        serverUpdatedAt: '2026-03-15T09:00:00.000Z',
      },
    ]);
    apiMock.getDecks.mockResolvedValue({
      decks: [
        { id: 'deck-1', updatedAt: '2026-03-15T09:00:00.000Z' },
        { id: 'deck-2', updatedAt: '2026-03-15T10:00:00.000Z' },
      ],
    });
    apiMock.getDeck.mockResolvedValue({
      deck: {
        id: 'deck-2',
        title: 'Deck Two',
        origin: 'generated',
        cardCount: 1,
        updatedAt: '2026-03-15T10:00:00.000Z',
        cards: [{ id: 'card-2', deckId: 'deck-2', front: 'Q', back: 'A', position: 0, createdAt: '2026-03-15T10:00:00.000Z' }],
      },
      cards: [],
    });

    const { refreshOfflineDeckSnapshots } = await import('../../src/lib/offline/downloads');
    await refreshOfflineDeckSnapshots();

    expect(apiMock.getDeck).toHaveBeenCalledTimes(1);
    expect(apiMock.getDeck).toHaveBeenCalledWith('deck-2');
    expect(repositoryMocks.markDeckDeletedOnServer).not.toHaveBeenCalled();
  });

  it('uploads pending sessions and marks accepted plus deduped rows as synced', async () => {
    repositoryMocks.getPendingSessions.mockResolvedValue([
      {
        clientSessionId: 'session-1',
        deckId: 'deck-1',
        mode: 'flip',
        correct: 8,
        total: 10,
        startedAt: '2026-03-15T10:00:00.000Z',
        completedAt: '2026-03-15T10:05:00.000Z',
        deckSnapshotUpdatedAt: '2026-03-15T09:00:00.000Z',
        synced: false,
      },
      {
        clientSessionId: 'session-2',
        deckId: 'deck-2',
        mode: 'flip',
        correct: 9,
        total: 10,
        startedAt: '2026-03-15T11:00:00.000Z',
        completedAt: '2026-03-15T11:05:00.000Z',
        deckSnapshotUpdatedAt: '2026-03-15T10:00:00.000Z',
        synced: false,
      },
    ]);
    apiMock.syncStudySessions.mockResolvedValue({
      acceptedSessionIds: ['session-1'],
      dedupedSessionIds: ['session-2'],
    });

    const { syncPendingSessions } = await import('../../src/lib/offline/sync');
    const result = await syncPendingSessions();

    expect(apiMock.syncStudySessions).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.markSessionSynced).toHaveBeenCalledTimes(2);
    expect(result.syncedCount).toBe(2);
  });

  it('does not immediately retry after a recent sync failure', async () => {
    repositoryMocks.getPendingSessions.mockResolvedValue([
      {
        clientSessionId: 'session-1',
        deckId: 'deck-1',
        mode: 'flip',
        correct: 8,
        total: 10,
        startedAt: '2026-03-15T10:00:00.000Z',
        completedAt: '2026-03-15T10:05:00.000Z',
        deckSnapshotUpdatedAt: '2026-03-15T09:00:00.000Z',
        synced: false,
      },
    ]);
    apiMock.syncStudySessions.mockRejectedValue(new Error('offline'));

    const { syncPendingSessions } = await import('../../src/lib/offline/sync');

    await expect(syncPendingSessions({ now: new Date('2026-03-15T12:00:00.000Z') })).rejects.toThrow('offline');
    await expect(syncPendingSessions({ now: new Date('2026-03-15T12:00:10.000Z') })).rejects.toThrow(/backoff/i);
  });
});
