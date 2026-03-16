---
date: 2026-03-15
topic: ios-offline-study-and-data-sync
---

# iOS Offline Study & Data Synchronization

## What We're Building

An offline-first study experience for the iOS app. Students study on subways, in lecture halls, and on planes. If the app requires internet to complete a study session, mobile loses one of its clearest advantages over web.

The minimum viable version is not "offline everything." It is:

- a real native study flow for downloaded decks
- local persistence for deck/card study data
- a one-directional upload queue for completed sessions
- graceful online/offline transitions

Everything else remains online-first. We are not building a general-purpose sync engine.

## Why This Approach

Three approaches were considered:

1. **Full offline sync (CRDTs / real-time sync engine):** Bidirectional sync of all data with automatic conflict resolution. Tools like WatermelonDB or PowerSync promise this. Rejected — massively over-engineered for our use case. We don't need offline deck editing, offline card creation, or offline marketplace access. The complexity-to-value ratio is terrible.

2. **No offline at all (web parity):** Ship the iOS app as online-only, same as the web app. Rejected — this is the one thing mobile must do better than web. A flashcard app that doesn't work on the subway will get 1-star reviews instantly.

3. **Read-only offline cache with upload queue (chosen):** Download deck and card data to a local SQLite database. Study sessions run against local data. Completed sessions queue for upload when online. Simple, predictable, and targeted at the one mobile use case that matters.

## Feature Details

### 1. Offline Study Mode

**Problem:** The current iOS study implementation is still thin. The mobile app has online study APIs, but the native study screen is still a placeholder and the current session model assumes server participation to start and complete a session. That means offline study is not just a sync feature. It also requires finishing the native study loop in a way that can run without the server.

**Approach:**

- Study sessions run locally against downloaded deck/card data
- No server call to "start" a session in offline mode. The device creates a local session record with a UUID, mode, and timestamps.
- On completion, the session result is written to a local `pending_sessions` queue.
- When online, a sync worker drains the queue to the server.
- The server accepts a `client_session_id` for idempotent deduplication.
- Server-side study score, streaks, and deck stats still remain authoritative, but they must be updated from the synced session's client timestamps rather than only `NOW()`

**What works offline:** Downloaded deck browsing, local study sessions, and a lightweight local view of pending/completed offline sessions.

**What doesn't work offline:** Marketplace, purchasing, AI generation, and any server-authored stats that require fresh data. Profile and settings should degrade gracefully, not disappear entirely, because they now contain device-local features like biometrics and the future download manager.

### 2. Local Database (expo-sqlite)

**Problem:** We need a local persistence layer that stores decks, cards, and pending study sessions. It needs to be fast, reliable, and simple. The app already persists some React Query data to MMKV, so the offline design needs to be explicit about which data stays in cache versus which data becomes first-class offline state.

**Approach:**

- Use `expo-sqlite`. It ships with Expo, requires no custom native setup, and gives direct control over the few tables we need.
- Treat SQLite as the source of truth for offline study data.
- Keep MMKV-backed React Query persistence for lightweight online cache hydration, but do not rely on it as the durable store for offline study sessions.
- Local schema (3 tables):

```sql
-- Mirrors server decks needed for offline study
CREATE TABLE local_decks (
  id TEXT PRIMARY KEY,           -- server deck ID
  title TEXT NOT NULL,
  card_count INTEGER NOT NULL,
  origin TEXT NOT NULL,
  downloaded_at INTEGER NOT NULL, -- epoch ms
  server_updated_at TEXT,         -- for staleness detection
  deleted_on_server INTEGER DEFAULT 0
);

-- Mirrors server cards needed for offline study
CREATE TABLE local_cards (
  id TEXT PRIMARY KEY,           -- server card ID
  deck_id TEXT NOT NULL REFERENCES local_decks(id) ON DELETE CASCADE,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  position INTEGER NOT NULL
);

-- Outbound queue for completed sessions
CREATE TABLE pending_sessions (
  client_session_id TEXT PRIMARY KEY, -- UUID generated on device
  deck_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0        -- 0 = pending, 1 = synced
);
```

- No marketplace catalog, payout, or billing data is stored in SQLite.
- We may still cache the last-known user object and last-known stats for UX continuity, but those remain cache data, not conflict-prone offline state.
- WatermelonDB was considered for its built-in sync protocol, but it adds a large dependency and abstracts away control we want to keep. expo-sqlite is simpler and sufficient.

### 3. Sync Strategy

**Problem:** Study sessions completed offline need to reach the server. The sync must be reliable, idempotent, and unobtrusive. It also has to fit the current backend, which today only supports "start session" and "complete session" routes tied to server timestamps.

**Approach:**

- **Upload queue pattern:** Completed sessions are written to `pending_sessions` with `synced = 0`. A sync worker checks this table and uploads each session.
- **Sync triggers:** (1) app comes to foreground, (2) network reachability changes from offline to online, (3) after completing a local session while online.
- **Server endpoint:** Add `POST /api/study/sync` that accepts one or more completed sessions with `client_session_id`, `started_at`, and `completed_at`. The server inserts deduplicated study sessions and recalculates derived user stats from the provided timestamps.
- **On success:** Mark `synced = 1` in local DB. Optionally purge synced sessions older than 7 days.
- **On failure:** Leave `synced = 0`, retry on next trigger. Exponential backoff if repeated failures. Sessions stay in the queue indefinitely — they never expire.
- **Streak handling:** The existing streak logic currently uses `NOW()`, so offline sync requires a small redesign. The sync endpoint must update streak state using the session's actual completed date, or explicitly run a recomputation pass, so that a session completed yesterday but synced today is counted on the correct day.

### 4. Conflict Resolution

**Problem:** A user could study the same deck on web and mobile while the mobile device is offline. When mobile syncs, there could be conflicts or duplicate accounting.

**Approach:**

- **Study sessions: no conflict.** Sessions are append-only. Two sessions on the same deck from different devices are just two sessions. The server's `client_session_id` deduplication handles retries, not cross-device conflicts.
- **Streaks: no conflict.** Streaks are derived from session timestamps server-side. When offline sessions sync with their real timestamps, the streak calculation incorporates them correctly. No client-side streak state to conflict.
- **Study score: low conflict, but server logic must be idempotent.** Offline sessions should contribute normally, but only once per `client_session_id`.
- **Deck edits: last-write-wins, but rare.** If a user edits card text on web while the same deck is downloaded on mobile, the local copy is stale. We handle this by re-downloading deck data on the next online sync (compare `server_updated_at`). The user never edits cards on mobile offline — card editing is an online-only feature for v1.
- **No CRDTs. No vector clocks. No merge logic.** The architecture avoids conflicts by making local data read-only (except the session upload queue).

### 5. Download & Storage Management

**Problem:** Users might have 5 decks or 500. We need a strategy for what gets stored locally, how users control it, and where that control lives in the current tab structure.

**Approach:**

- **Opt-in downloads** for v1. Each owned deck should expose a download action. Downloaded decks show an "Available offline" state.
- **No auto-download.** Auto-downloading all decks could use significant storage for power users and burn through cellular data. Opt-in is the safe default.
- **Storage budget:** A card is ~200 bytes (front + back text). A 50-card deck is ~10KB. 1,000 decks would be ~10MB. Storage is not a real concern — text is tiny. No images, no audio, no media.
- **"Manage Downloads" belongs in profile/settings, not a disabled offline surface.** That screen should show storage used, downloaded decks, and remove actions.
- **Stale data refresh:** When online, the app checks `server_updated_at` for each downloaded deck against the server. If the server copy is newer (card edited, card added/deleted), re-download. This check happens on app foreground, not continuously.
- **Deleted decks:** If a deck is deleted on the server (or a purchased deck's listing is removed), the next sync marks it locally as orphaned. Show a subtle indicator but don't auto-delete — the user might still want to study it. Let them manually remove it.

### 6. Cache Invalidation

**Problem:** Local deck data can become stale. Cards might be edited on web, or a deck might be deleted.

**Approach:**

- **Staleness check on foreground:** When the app opens and is online, hit `GET /api/decks` and compare each downloaded deck's `updated_at` against `local_decks.server_updated_at`. Re-download any that changed.
- **Purchased decks are copies.** If the original marketplace listing updates, the user's purchased copy doesn't change — this is existing behavior. No invalidation needed for purchased decks unless the user's own copy changes (which only happens if they edit cards on web).
- **Deleted deck handling:** If a server deck no longer appears in the deck list response, mark the local copy with a `deleted_on_server` flag. Show it dimmed with an info label. Don't auto-delete — the data is still useful for studying.
- **No TTL / expiry.** Downloaded decks don't "expire." They stay until the user removes them or the staleness check updates them. Flashcard content doesn't go stale the way a news feed does.

### 7. Network State Awareness

**Problem:** The app needs to gracefully handle being offline, coming online, and the transition between states.

**Approach:**

- **Detection:** `@react-native-community/netinfo` provides reachability changes. Expose network state via a small React context that any component can consume.
- **UI indicators:** A slim banner at the top of the screen (below the nav bar): "You're offline — studying downloaded decks" in a muted amber. Dismissible, reappears on navigation. Not a blocking modal — never interrupt studying.
- **Feature gating:** When offline, online-only actions should be disabled or rerouted with clear copy. Generate and marketplace are unavailable. Profile/settings remain available for local/device actions, but remote billing and any server-dependent controls should show an offline message.
- **Transition online:** When connectivity returns, the amber banner changes to "Back online — syncing..." briefly, then disappears. The sync worker fires automatically. No user action needed.
- **Transition offline mid-study:** No impact. Study sessions are already local. The session completes normally and queues for sync.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Local database | expo-sqlite | Ships with Expo, zero config, full SQL control, no heavy ORM |
| Existing cache layer | Keep MMKV query persistence | Useful for warm starts, but not durable enough for offline study source of truth |
| Sync direction | Upload-only (sessions) | Deck data is read-only locally, avoids bidirectional sync complexity |
| Download strategy | Opt-in per deck | Respects storage and data usage, safe default for all users |
| Conflict resolution | Avoided by design | Sessions are append-only, deck data is read-only locally, deck edits stay online-only |
| Streak accuracy | Use real session timestamps | Requires backend support beyond the current `NOW()`-based study routes |
| Session deduplication | `client_session_id` UUID | Idempotent server endpoint, safe retries, no double-counting |
| Network detection | `@react-native-community/netinfo` | Standard RN library, event-driven, reliable |

## Open Questions

- Should we batch-sync sessions or sync individually? Batch is more efficient, but a single-session contract may be simpler for the first backend cut.
- Should the "Download for offline" action also pre-download any deck assets we add in the future (images, audio)? For now there are no media assets on cards, but the download architecture should be extensible.
- Should we show a "last synced" timestamp somewhere in the UI so users know their data is current? Probably yes, in the Manage Downloads screen.
- When offline, should we show last-known study score and streak with a stale label, or hide them entirely until the next successful refresh?
- Should this ship as one feature, or as two phases: (1) native study flow + local persistence foundation, then (2) offline sync + download management?

## Scope Boundaries

**In scope:**

- Native study flow that can operate on downloaded decks
- Local SQLite database with expo-sqlite (decks, cards, pending sessions)
- Session upload queue with idempotent sync
- Opt-in deck download with storage management UI
- Network state detection and offline/online UI indicators
- Staleness check and deck re-download on foreground
- Graceful offline behavior for profile/settings now that device-local controls and billing entry points live there

**Out of scope:**

- Offline deck creation or card editing (online-only for v1)
- Offline marketplace browsing or purchasing
- Offline AI generation
- Full bidirectional sync / CRDTs / real-time sync
- Background sync via iOS background fetch (foreground sync only for v1)
- Fully offline billing/account management
- Media/image caching (no media on cards currently)

## Resolved Questions

- SQLite should own durable offline study data. Existing MMKV React Query persistence stays as a lightweight cache layer, not the source of truth.
- Profile and settings should remain accessible offline for device-local controls and download management. Only server-dependent actions inside those surfaces should be gated.

## Next Steps

→ `/workflows:plan` for implementation details
