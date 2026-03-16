---
module: System
date: 2026-03-15
problem_type: integration_issue
component: database
symptoms:
  - "The iOS app had no durable offline study flow, only online study endpoints and placeholder mobile study screens."
  - "Study streaks and history depended on server NOW() timestamps, so offline completions could not be synced accurately."
  - "Profile, marketplace, and generation surfaces needed to degrade cleanly offline instead of breaking or disappearing."
root_cause: incomplete_setup
resolution_type: code_fix
severity: high
tags: [ios, offline-study, sqlite, sync, study-streaks, expo, react-native]
---

# Troubleshooting: iOS Offline Study Sync And Local Storage

## Problem

The mobile app had enough cached query data to render some previously fetched content, but it did not have a real offline study product. There was no durable local deck store, no queued study-session sync contract, and no server path that could safely accept historical completions without corrupting streaks.

## Environment

- Module: System-wide
- Affected Component: Mobile offline study flow, local persistence, server study sync, and offline-aware iOS UI
- Date: 2026-03-15

## Symptoms

- Mobile study screens were still placeholders, so there was no trustworthy local study flow.
- Existing study completion routes used server `NOW()`, which made offline streak preservation impossible.
- There was no idempotent sync key for retried local session uploads.
- Downloaded decks were not stored in a durable local database with snapshot metadata.
- Profile, billing, generation, and marketplace surfaces needed explicit offline behavior instead of assuming constant connectivity.

## What Didn't Work

**Attempted solution 1:** Rely on existing React Query + MMKV persistence for offline study.
- **Why it failed:** Cached API responses were not a durable source of truth for card snapshots or pending study uploads. They also did not provide transactional replacement for downloaded deck content.

**Attempted solution 2:** Reuse the existing `POST /api/study` and `PATCH /api/study/:id` flow for offline completions.
- **Why it failed:** Those routes validate against live deck state and stamp completion time with server `NOW()`. That breaks historical session sync and makes retried uploads unsafe.

**Attempted solution 3:** Revalidate synced sessions against the current live deck contents at upload time.
- **Why it failed:** A user can legitimately study a previously downloaded snapshot after the deck changes on the server. Revalidating against the live deck would reject valid historical study work.

## Solution

The working fix had four parts:

1. Add a dedicated server sync service and migration for idempotent offline study uploads.
2. Store downloaded decks and pending study sessions in SQLite on device.
3. Replace the mobile study placeholders with a real offline-capable study loop.
4. Add network-aware UI that degrades non-offline-safe surfaces instead of hiding the entire profile/settings area.

**Code changes**:

```js
// server/src/services/study-sync.js
const FUTURE_GRACE_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function validateSyncedSession(session, now) {
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

  return {
    clientSessionId: session.client_session_id,
    deckId: session.deck_id,
    deckSnapshotUpdatedAt: normalizeDate(
      session.deck_snapshot_updated_at ?? session.completed_at,
      'deck_snapshot_updated_at',
    ).toISOString(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}
```

```sql
-- server/src/db/migrations/017_study_sync.sql
ALTER TABLE study_sessions
  ADD COLUMN IF NOT EXISTS client_session_id UUID,
  ADD COLUMN IF NOT EXISTS deck_snapshot_updated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_sessions_user_client_session
  ON study_sessions (user_id, client_session_id)
  WHERE client_session_id IS NOT NULL;
```

```ts
// mobile/src/lib/offline/repository.ts
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
```

```ts
// mobile/src/lib/offline/sync.ts
export async function syncPendingSessions(options: { now?: Date } = {}) {
  const sessions = await getPendingSessions(null);
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
}
```

**Commands run**:

```bash
cd /Users/kashane/app-dev/apps/ai-notecards/server && npm test
cd /Users/kashane/app-dev/apps/ai-notecards/mobile && /Users/kashane/.nvm/versions/node/v22.22.0/bin/node ./node_modules/vitest/vitest.mjs run
cd /Users/kashane/app-dev/apps/ai-notecards/mobile && /Users/kashane/.nvm/versions/node/v22.22.0/bin/node ./node_modules/typescript/bin/tsc --noEmit
```

## Why This Works

The root issue was not just “offline support is missing.” It was a cross-layer contract gap:

1. The client had no durable source of truth for downloaded deck snapshots and pending completions.
2. The server had no safe way to accept historical client timestamps without opening up streak corruption or duplicate inserts.
3. The mobile UI still assumed online-only flows for study, billing, generation, and marketplace.

The fix closes all three gaps together:

- SQLite becomes the durable offline store for downloaded deck snapshots and pending uploads.
- `client_session_id` gives the server an idempotent dedupe key for retries.
- `deck_snapshot_updated_at` records which downloaded snapshot the session came from, so valid historical study is accepted even if the live deck changed later.
- Timestamp validation uses bounded trust instead of total trust or total rejection. That preserves offline streak correctness while limiting abuse.
- Streaks are recomputed from persisted `completed_at` values instead of patched incrementally from request time.
- Offline UI is explicit: downloaded decks still work, sync resumes when connectivity returns, and online-only surfaces show clear messages instead of failing ambiguously.

## Prevention

- Treat offline features as an API-contract problem, not just a local-cache problem. Decide idempotency, timestamp trust, and historical snapshot rules before writing UI.
- Keep durable offline study data in SQLite and treat MMKV/query persistence as a cache layer, not the authoritative store.
- For client-authored historical events, accept timestamps only inside explicit server-side bounds. Reject future drift and stale backfills.
- Preserve the downloaded snapshot identity when syncing historical work. Do not revalidate offline sessions against mutable live deck contents.
- Use service-level tests for sync semantics first. Route wiring can stay thin.
- Add transactional replacement whenever a downloaded snapshot owns child rows, so deck/card state cannot be half-written.
- Run mobile verification with Node 22 in this repo. The local Vitest and TypeScript tooling here is sensitive to the active Node runtime.

## Related Issues

- See also: [Account & Settings Experience](/Users/kashane/app-dev/apps/ai-notecards/docs/solutions/feature-patterns/account-settings-experience.md)
- See also: [Pre-Launch Checklist](/Users/kashane/app-dev/apps/ai-notecards/docs/solutions/feature-patterns/pre-launch-checklist.md)
