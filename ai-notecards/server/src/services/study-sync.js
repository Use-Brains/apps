const ALLOWED_MODES = new Set(['flip', 'multiple_choice', 'type_answer', 'match']);
const MIN_CARDS = {
  flip: 1,
  multiple_choice: 4,
  type_answer: 1,
  match: 6,
};

const FUTURE_GRACE_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeDate(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be an ISO timestamp`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be an ISO timestamp`);
  }

  return parsed;
}

function toUtcDateKey(value) {
  return value.toISOString().slice(0, 10);
}

function validateSyncedSession(session, now) {
  if (!session || typeof session !== 'object') {
    throw new Error('session payload is required');
  }
  if (typeof session.client_session_id !== 'string' || session.client_session_id.length === 0) {
    throw new Error('client_session_id is required');
  }
  if (typeof session.deck_id !== 'string' || session.deck_id.length === 0) {
    throw new Error('deck_id is required');
  }
  if (!ALLOWED_MODES.has(session.mode)) {
    throw new Error('mode is invalid');
  }
  if (!Number.isInteger(session.total_cards) || !Number.isInteger(session.correct)) {
    throw new Error('correct and total_cards must be integers');
  }
  if (session.total_cards < MIN_CARDS[session.mode]) {
    throw new Error('session total_cards is below the minimum for this mode');
  }
  if (session.correct < 0 || session.correct > session.total_cards) {
    throw new Error('correct count is invalid');
  }

  const startedAt = normalizeDate(session.started_at, 'started_at');
  const completedAt = normalizeDate(session.completed_at, 'completed_at');
  if (startedAt > completedAt) {
    throw new Error('started_at must be before completed_at');
  }
  if (completedAt.getTime() - now.getTime() > FUTURE_GRACE_MS) {
    throw new Error('completed_at cannot be in the future');
  }
  if (now.getTime() - completedAt.getTime() > MAX_AGE_MS) {
    throw new Error('completed_at is too old to sync');
  }

  const deckSnapshotUpdatedAt = normalizeDate(
    session.deck_snapshot_updated_at ?? session.completed_at,
    'deck_snapshot_updated_at',
  );

  return {
    clientSessionId: session.client_session_id,
    deckId: session.deck_id,
    mode: session.mode,
    totalCards: session.total_cards,
    correct: session.correct,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    deckSnapshotUpdatedAt: deckSnapshotUpdatedAt.toISOString(),
  };
}

function computeStreakMetrics(completedAtValues) {
  const uniqueDates = [...new Set(completedAtValues.map((value) => toUtcDateKey(new Date(value))))].sort();

  if (uniqueDates.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      last_study_date: null,
    };
  }

  let longest = 1;
  let currentRun = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00.000Z`);
    const current = new Date(`${uniqueDates[index]}T00:00:00.000Z`);
    const dayDelta = (current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000);

    if (dayDelta === 1) {
      currentRun += 1;
      longest = Math.max(longest, currentRun);
      continue;
    }

    currentRun = 1;
  }

  let trailingRun = 1;
  for (let index = uniqueDates.length - 1; index > 0; index -= 1) {
    const current = new Date(`${uniqueDates[index]}T00:00:00.000Z`);
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00.000Z`);
    const dayDelta = (current.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000);

    if (dayDelta === 1) {
      trailingRun += 1;
      continue;
    }

    break;
  }

  return {
    current_streak: trailingRun,
    longest_streak: longest,
    last_study_date: uniqueDates[uniqueDates.length - 1],
  };
}

export async function syncOfflineStudySessions(client, userId, payload) {
  const now = payload?.now instanceof Date ? payload.now : new Date();
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : [];

  if (!userId) {
    throw new Error('userId is required');
  }
  if (sessions.length === 0) {
    throw new Error('sessions are required');
  }

  const normalizedSessions = sessions.map((session) => validateSyncedSession(session, now));
  const acceptedSessionIds = [];
  const dedupedSessionIds = [];

  await client.query('BEGIN');

  try {
    for (const session of normalizedSessions) {
      const deckResult = await client.query(
        'SELECT id, updated_at FROM decks WHERE id = $1 AND user_id = $2',
        [session.deckId, userId],
      );

      if (deckResult.rowCount === 0) {
        throw new Error('deck not found');
      }

      const insertResult = await client.query(
        `INSERT INTO study_sessions
          (user_id, deck_id, total_cards, correct, started_at, completed_at, mode, client_session_id, deck_snapshot_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, client_session_id) DO NOTHING
         RETURNING id, client_session_id`,
        [
          userId,
          session.deckId,
          session.totalCards,
          session.correct,
          session.startedAt,
          session.completedAt,
          session.mode,
          session.clientSessionId,
          session.deckSnapshotUpdatedAt,
        ],
      );

      if (insertResult.rowCount === 0) {
        dedupedSessionIds.push(session.clientSessionId);
        continue;
      }

      acceptedSessionIds.push(session.clientSessionId);

      const accuracy = session.totalCards > 0 ? (session.correct / session.totalCards) * 100 : 0;
      await client.query(
        `INSERT INTO deck_stats (user_id, deck_id, times_completed, best_accuracy)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (user_id, deck_id) DO UPDATE SET
           times_completed = deck_stats.times_completed + 1,
           best_accuracy = GREATEST(deck_stats.best_accuracy, EXCLUDED.best_accuracy),
           updated_at = NOW()
         RETURNING times_completed, best_accuracy`,
        [userId, session.deckId, accuracy],
      );
    }

    const sessionRows = await client.query(
      `SELECT completed_at FROM study_sessions
       WHERE user_id = $1 AND completed_at IS NOT NULL
       ORDER BY completed_at ASC`,
      [userId],
    );

    const streak = computeStreakMetrics(sessionRows.rows.map((row) => row.completed_at));

    await client.query(
      `UPDATE users SET
         study_score = $2,
         current_streak = $3,
         longest_streak = $4,
         last_study_date = $5
       WHERE id = $1
       RETURNING study_score, current_streak, longest_streak, last_study_date`,
      [
        userId,
        sessionRows.rowCount,
        streak.current_streak,
        streak.longest_streak,
        streak.last_study_date,
      ],
    );

    await client.query('COMMIT');

    return {
      acceptedSessionIds,
      dedupedSessionIds,
      streak,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
