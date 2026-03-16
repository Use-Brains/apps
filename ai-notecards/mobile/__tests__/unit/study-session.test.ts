import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-sqlite', () => ({
  openDatabaseAsync: vi.fn(),
}));

import {
  createLocalStudySession,
  getMinimumCardsForMode,
  queueCompletedSession,
} from '../../src/lib/study/session';

describe('local study session orchestration', () => {
  it('creates a local study session with deterministic UUID and timestamps', () => {
    const session = createLocalStudySession(
      {
        id: 'deck-1',
        cards: [
          { id: 'card-1', deckId: 'deck-1', front: 'Q1', back: 'A1', position: 0 },
          { id: 'card-2', deckId: 'deck-1', front: 'Q2', back: 'A2', position: 1 },
        ],
      },
      'flip',
      {
        now: new Date('2026-03-15T12:00:00.000Z'),
        createId: () => 'session-1',
      },
    );

    expect(session).toMatchObject({
      clientSessionId: 'session-1',
      deckId: 'deck-1',
      mode: 'flip',
      totalCards: 2,
      startedAt: '2026-03-15T12:00:00.000Z',
      cardIds: ['card-1', 'card-2'],
    });
  });

  it('uses the same minimum-card rules as the server contract', () => {
    expect(getMinimumCardsForMode('flip')).toBe(1);
    expect(getMinimumCardsForMode('multiple_choice')).toBe(4);
    expect(getMinimumCardsForMode('type_answer')).toBe(1);
    expect(getMinimumCardsForMode('match')).toBe(6);
  });

  it('queues a completed session exactly once with snapshot metadata', async () => {
    const enqueuePendingSession = vi.fn();
    const draft = createLocalStudySession(
      {
        id: 'deck-1',
        serverUpdatedAt: '2026-03-15T11:00:00.000Z',
        cards: [
          { id: 'card-1', deckId: 'deck-1', front: 'Q1', back: 'A1', position: 0 },
          { id: 'card-2', deckId: 'deck-1', front: 'Q2', back: 'A2', position: 1 },
        ],
      },
      'flip',
      {
        now: new Date('2026-03-15T12:00:00.000Z'),
        createId: () => 'session-1',
      },
    );

    const result = await queueCompletedSession(draft, {
      correct: 1,
      now: new Date('2026-03-15T12:05:00.000Z'),
      enqueuePendingSession,
    });

    expect(enqueuePendingSession).toHaveBeenCalledTimes(1);
    expect(enqueuePendingSession).toHaveBeenCalledWith({
      clientSessionId: 'session-1',
      deckId: 'deck-1',
      mode: 'flip',
      correct: 1,
      total: 2,
      startedAt: '2026-03-15T12:00:00.000Z',
      completedAt: '2026-03-15T12:05:00.000Z',
      deckSnapshotUpdatedAt: '2026-03-15T11:00:00.000Z',
      synced: false,
    });
    expect(result.clientSessionId).toBe('session-1');
  });

  it('does not mutate cached user stats when queuing a local completion', async () => {
    const stats = Object.freeze({
      studyScore: 10,
      currentStreak: 3,
      longestStreak: 5,
    });
    const draft = createLocalStudySession(
      {
        id: 'deck-1',
        cards: [{ id: 'card-1', deckId: 'deck-1', front: 'Q1', back: 'A1', position: 0 }],
      },
      'flip',
      {
        now: new Date('2026-03-15T12:00:00.000Z'),
        createId: () => 'session-1',
      },
    );

    await queueCompletedSession(draft, {
      correct: 1,
      now: new Date('2026-03-15T12:01:00.000Z'),
      enqueuePendingSession: vi.fn(),
    });

    expect(stats).toEqual({
      studyScore: 10,
      currentStreak: 3,
      longestStreak: 5,
    });
  });
});
