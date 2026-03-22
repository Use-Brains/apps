import test from 'node:test';
import assert from 'node:assert/strict';

import { syncOfflineStudySessions } from './study-sync.js';

function createClient({ sessionsByUser = new Map(), ownedDecks = new Set(), preferencesByUser = new Map() } = {}) {
  const state = {
    sessionsByUser: new Map(sessionsByUser),
    ownedDecks: new Set(ownedDecks),
    preferencesByUser: new Map(preferencesByUser),
    insertedSessions: [],
    rollbacks: 0,
    commits: 0,
  };

  return {
    state,
    async query(sql, params = []) {
      if (sql === 'BEGIN') return { rows: [], rowCount: 0 };
      if (sql === 'COMMIT') {
        state.commits += 1;
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'ROLLBACK') {
        state.rollbacks += 1;
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes('SELECT preferences FROM users')) {
        const [userId] = params;
        return {
          rows: [{ preferences: state.preferencesByUser.get(userId) || {} }],
          rowCount: 1,
        };
      }

      if (sql.includes('SELECT id, updated_at FROM decks')) {
        const [deckId, userId] = params;
        const key = `${userId}:${deckId}`;
        if (!state.ownedDecks.has(key)) return { rows: [], rowCount: 0 };
        return {
          rows: [{ id: deckId, updated_at: '2026-03-15T12:00:00.000Z' }],
          rowCount: 1,
        };
      }

      if (sql.includes('INSERT INTO study_sessions')) {
        const [
          userId,
          deckId,
          totalCards,
          correct,
          startedAt,
          completedAt,
          mode,
          clientSessionId,
          deckSnapshotUpdatedAt,
        ] = params;
        const existing = state.sessionsByUser.get(userId) || [];
        const duplicate = existing.find((entry) => entry.client_session_id === clientSessionId);
        if (duplicate) {
          return { rows: [], rowCount: 0 };
        }

        const inserted = {
          id: `session-${existing.length + 1}`,
          user_id: userId,
          deck_id: deckId,
          total_cards: totalCards,
          correct,
          started_at: startedAt,
          completed_at: completedAt,
          mode,
          client_session_id: clientSessionId,
          deck_snapshot_updated_at: deckSnapshotUpdatedAt,
        };

        existing.push(inserted);
        state.sessionsByUser.set(userId, existing);
        state.insertedSessions.push(inserted);

        return { rows: [inserted], rowCount: 1 };
      }

      if (sql.includes('SELECT completed_at FROM study_sessions')) {
        const [userId] = params;
        const sessions = (state.sessionsByUser.get(userId) || [])
          .filter((entry) => entry.completed_at)
          .sort((left, right) => new Date(left.completed_at) - new Date(right.completed_at))
          .map((entry) => ({ completed_at: entry.completed_at }));
        return { rows: sessions, rowCount: sessions.length };
      }

      if (sql.includes('INSERT INTO deck_stats')) {
        return {
          rows: [{ times_completed: 1, best_accuracy: 80 }],
          rowCount: 1,
        };
      }

      if (sql.includes('UPDATE users SET')) {
        const [userId, studyScore, currentStreak, longestStreak, lastStudyDate] = params;
        state.userUpdate = {
          userId,
          studyScore,
          currentStreak,
          longestStreak,
          lastStudyDate,
        };
        return { rows: [state.userUpdate], rowCount: 1 };
      }

      throw new Error(`Unhandled SQL in test client: ${sql}`);
    },
  };
}

test('syncOfflineStudySessions rejects sessions too far in the future', async () => {
  const client = createClient({
    ownedDecks: new Set(['user-1:deck-1']),
    preferencesByUser: new Map([['user-1', { timezone: 'UTC' }]]),
  });

  await assert.rejects(
    () => syncOfflineStudySessions(client, 'user-1', {
      now: new Date('2026-03-15T12:00:00.000Z'),
      sessions: [{
        client_session_id: 'a78f34d5-7d54-4f60-87ac-f7a3dcbf6ec1',
        deck_id: 'deck-1',
        mode: 'flip',
        total_cards: 10,
        correct: 8,
        started_at: '2026-03-15T11:55:00.000Z',
        completed_at: '2026-03-15T12:20:01.000Z',
        deck_snapshot_updated_at: '2026-03-15T11:00:00.000Z',
      }],
    }),
    /future/i
  );
});

test('syncOfflineStudySessions dedupes repeated client_session_id values', async () => {
  const client = createClient({
    ownedDecks: new Set(['user-1:deck-1']),
    preferencesByUser: new Map([['user-1', { timezone: 'UTC' }]]),
    sessionsByUser: new Map([
      ['user-1', [{
        client_session_id: '4d9cbf27-7f1a-4a7b-aa41-77199eae3851',
        completed_at: '2026-03-14T10:00:00.000Z',
      }]],
    ]),
  });

  const result = await syncOfflineStudySessions(client, 'user-1', {
    now: new Date('2026-03-15T12:00:00.000Z'),
    sessions: [{
      client_session_id: '4d9cbf27-7f1a-4a7b-aa41-77199eae3851',
      deck_id: 'deck-1',
      mode: 'flip',
      total_cards: 10,
      correct: 8,
      started_at: '2026-03-14T09:55:00.000Z',
      completed_at: '2026-03-14T10:00:00.000Z',
      deck_snapshot_updated_at: '2026-03-14T09:00:00.000Z',
    }],
  });

  assert.deepEqual(result, {
    acceptedSessionIds: [],
    dedupedSessionIds: ['4d9cbf27-7f1a-4a7b-aa41-77199eae3851'],
    streak: {
      current_streak: 1,
      longest_streak: 1,
      last_study_date: '2026-03-14',
    },
  });
});

test('syncOfflineStudySessions recomputes streaks from stored completion dates', async () => {
  const client = createClient({
    ownedDecks: new Set(['user-1:deck-1']),
    preferencesByUser: new Map([['user-1', { timezone: 'UTC' }]]),
    sessionsByUser: new Map([
      ['user-1', [
        {
          client_session_id: 'old-1',
          completed_at: '2026-03-13T10:00:00.000Z',
        },
        {
          client_session_id: 'old-2',
          completed_at: '2026-03-15T08:00:00.000Z',
        },
      ]],
    ]),
  });

  const result = await syncOfflineStudySessions(client, 'user-1', {
    now: new Date('2026-03-15T12:00:00.000Z'),
    sessions: [{
      client_session_id: '165a2446-8b94-43cb-a0bd-5b95ad5dd4b4',
      deck_id: 'deck-1',
      mode: 'flip',
      total_cards: 10,
      correct: 7,
      started_at: '2026-03-14T07:50:00.000Z',
      completed_at: '2026-03-14T08:00:00.000Z',
      deck_snapshot_updated_at: '2026-03-14T07:00:00.000Z',
    }],
  });

  assert.deepEqual(result, {
    acceptedSessionIds: ['165a2446-8b94-43cb-a0bd-5b95ad5dd4b4'],
    dedupedSessionIds: [],
    streak: {
      current_streak: 3,
      longest_streak: 3,
      last_study_date: '2026-03-15',
    },
  });
});

test('syncOfflineStudySessions accepts historical sessions even if the live deck changed after download', async () => {
  const client = createClient({
    ownedDecks: new Set(['user-1:deck-1']),
    preferencesByUser: new Map([['user-1', { timezone: 'UTC' }]]),
  });

  const result = await syncOfflineStudySessions(client, 'user-1', {
    now: new Date('2026-03-15T12:00:00.000Z'),
    sessions: [{
      client_session_id: '2fdad2b1-5000-4a09-bf0d-4ca8d1b35f4b',
      deck_id: 'deck-1',
      mode: 'flip',
      total_cards: 12,
      correct: 11,
      started_at: '2026-03-15T11:40:00.000Z',
      completed_at: '2026-03-15T11:50:00.000Z',
      deck_snapshot_updated_at: '2026-03-10T09:00:00.000Z',
    }],
  });

  assert.equal(result.acceptedSessionIds.length, 1);
  assert.equal(client.state.insertedSessions[0].deck_snapshot_updated_at, '2026-03-10T09:00:00.000Z');
});

test('syncOfflineStudySessions uses the stored user timezone for streak boundaries', async () => {
  const client = createClient({
    ownedDecks: new Set(['user-1:deck-1']),
    preferencesByUser: new Map([['user-1', { timezone: 'America/Los_Angeles' }]]),
    sessionsByUser: new Map([
      ['user-1', [
        {
          client_session_id: 'old-1',
          completed_at: '2026-03-14T07:30:00.000Z',
        },
      ]],
    ]),
  });

  const result = await syncOfflineStudySessions(client, 'user-1', {
    now: new Date('2026-03-15T12:00:00.000Z'),
    sessions: [{
      client_session_id: 'session-2',
      deck_id: 'deck-1',
      mode: 'flip',
      total_cards: 10,
      correct: 8,
      started_at: '2026-03-15T07:20:00.000Z',
      completed_at: '2026-03-15T07:30:00.000Z',
      deck_snapshot_updated_at: '2026-03-14T07:00:00.000Z',
    }],
  });

  assert.deepEqual(result.streak, {
    current_streak: 2,
    longest_streak: 2,
    last_study_date: '2026-03-15',
  });
});
