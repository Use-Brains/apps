---
date: 2026-03-15
topic: ios-offline-study-and-data-sync
---

# iOS Offline Study & Data Synchronization

## What We're Building

An offline-first study experience for the iOS app. Students study on subways, in lecture halls, and on planes — if the app requires internet to flip a flashcard, it's dead on arrival. The minimum viable offline experience is simple: download decks to the device, study them without a connection, and sync completed sessions when connectivity returns.

Everything else — marketplace browsing, AI generation, purchasing — stays online-only. We are not building a general-purpose offline sync engine. We are building a local cache of study data with a one-directional upload queue for completed sessions.

## Why This Approach

Three approaches were considered:

1. **Full offline sync (CRDTs / real-time sync engine):** Bidirectional sync of all data with automatic conflict resolution. Tools like WatermelonDB or PowerSync promise this. Rejected — massively over-engineered for our use case. We don't need offline deck editing, offline card creation, or offline marketplace access. The complexity-to-value ratio is terrible.

2. **No offline at all (web parity):** Ship the iOS app as online-only, same as the web app. Rejected — this is the one thing mobile must do better than web. A flashcard app that doesn't work on the subway will get 1-star reviews instantly.

3. **Read-only offline cache with upload queue (chosen):** Download deck+card data to a local SQLite database. Study sessions run entirely against local data. Completed sessions queue for upload when online. Simple, predictable, and covers the one use case that matters.

## Feature Details

### 1. Offline Study Mode

**Problem:** Study sessions currently require two server round-trips — POST to start, PATCH to complete. On the subway, both fail. The entire study experience breaks.

**Approach:**

- Study sessions run 100% locally against downloaded deck/card data
- No server call to "start" a session — the session is created locally with a UUID, mode, and timestamp
- On completion, the session result (mode, correct, total, started_at, completed_at, deck_id) is written to a local `pending_sessions` queue
- When online, a background sync worker drains the queue by POSTing each session to the server
- The server endpoint accepts a `client_session_id` (UUID) for idempotent deduplication — if the app retries a sync that already succeeded, the server ignores it via `ON CONFLICT DO NOTHING`
- Study score and streak updates happen server-side when sessions are synced, same as today

**What works offline:** Deck browsing (downloaded decks only), study sessions (all four modes), session history (local only, shows "pending sync" badge for un-synced sessions).

**What doesn't work offline:** Dashboard stats (study score, streak) won't reflect pending sessions until sync. Generation, marketplace, purchases, settings, profile — all disabled.

### 2. Local Database (expo-sqlite)

**Problem:** We need a local persistence layer that stores decks, cards, and pending study sessions. It needs to be fast, reliable, and simple.

**Approach:**

- Use `expo-sqlite` — it ships with Expo, requires zero native config, and is SQLite under the hood. No need for an ORM or abstraction layer like WatermelonDB.
- Local schema (3 tables):

```sql
-- Mirrors server decks (read-only local copy)
CREATE TABLE local_decks (
  id TEXT PRIMARY KEY,           -- server deck ID
  title TEXT NOT NULL,
  card_count INTEGER NOT NULL,
  origin TEXT NOT NULL,
  downloaded_at INTEGER NOT NULL, -- epoch ms
  server_updated_at TEXT          -- for staleness detection
);

-- Mirrors server cards (read-only local copy)
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

- No user profile data stored locally. No marketplace data. No stats. Just the bare minimum for offline study.
- WatermelonDB was considered for its built-in sync protocol, but it adds a large dependency and abstracts away control we want to keep. expo-sqlite is simpler and sufficient.

### 3. Sync Strategy

**Problem:** Study sessions completed offline need to reach the server. The sync must be reliable (no lost sessions), idempotent (no double-counting), and unobtrusive (no user action required).

**Approach:**

- **Upload queue pattern:** Completed sessions are written to `pending_sessions` with `synced = 0`. A sync worker checks this table and POSTs each to the server.
- **Sync triggers:** (1) App comes to foreground, (2) network reachability changes from offline to online, (3) after completing a study session while online. Use `@react-native-community/netinfo` for reachability events and `AppState` for foreground detection.
- **Server endpoint:** New `POST /api/study/sync` endpoint that accepts an array of session objects. Each includes `client_session_id`. The server inserts sessions, increments study_score, and updates streaks in a single transaction. Returns which session IDs were accepted vs. already existed.
- **On success:** Mark `synced = 1` in local DB. Optionally purge synced sessions older than 7 days.
- **On failure:** Leave `synced = 0`, retry on next trigger. Exponential backoff if repeated failures. Sessions stay in the queue indefinitely — they never expire.
- **Streak handling:** Streaks are calculated server-side based on `study_sessions` timestamps. Offline sessions carry their real `completed_at` timestamps, so when they sync, the server recalculates the streak correctly. If a user studied on Tuesday offline and syncs on Wednesday, the Tuesday streak is preserved because the session timestamp is Tuesday.

### 4. Conflict Resolution

**Problem:** A user could study the same deck on web and mobile while the mobile is offline. When mobile syncs, there could be conflicts.

**Approach:**

- **Study sessions: no conflict.** Sessions are append-only. Two sessions on the same deck from different devices are just two sessions. The server's `client_session_id` deduplication handles retries, not cross-device conflicts.
- **Streaks: no conflict.** Streaks are derived from session timestamps server-side. When offline sessions sync with their real timestamps, the streak calculation incorporates them correctly. No client-side streak state to conflict.
- **Study score: no conflict.** Study score is incremented server-side per session. Offline sessions increment it on sync. Two devices studying simultaneously just means more increments.
- **Deck edits: last-write-wins, but rare.** If a user edits card text on web while the same deck is downloaded on mobile, the local copy is stale. We handle this by re-downloading deck data on the next online sync (compare `server_updated_at`). The user never edits cards on mobile offline — card editing is an online-only feature for v1.
- **No CRDTs. No vector clocks. No merge logic.** The architecture avoids conflicts by making local data read-only (except the session upload queue).

### 5. Download & Storage Management

**Problem:** Users might have 5 decks or 500. We need a strategy for what gets stored locally and how much space it uses.

**Approach:**

- **Opt-in downloads** for v1. Each deck on the dashboard shows a download icon (cloud with arrow). Tap it to save locally. Downloaded decks show a checkmark and "Available offline" label.
- **No auto-download.** Auto-downloading all decks could use significant storage for power users and burn through cellular data. Opt-in is the safe default.
- **Storage budget:** A card is ~200 bytes (front + back text). A 50-card deck is ~10KB. 1,000 decks would be ~10MB. Storage is not a real concern — text is tiny. No images, no audio, no media.
- **"Manage Downloads" screen** in Settings showing total offline storage used and a list of downloaded decks with individual delete buttons and a "Remove All" option.
- **Stale data refresh:** When online, the app checks `server_updated_at` for each downloaded deck against the server. If the server copy is newer (card edited, card added/deleted), re-download. This check happens on app foreground, not continuously.
- **Deleted decks:** If a deck is deleted on the server (or a purchased deck's listing is removed), the next sync marks it locally as orphaned. Show a subtle indicator but don't auto-delete — the user might still want to study it. Let them manually remove it.

### 6. Cache Invalidation

**Problem:** Local deck data can become stale. Cards might be edited on web, or a deck might be deleted.

**Approach:**

- **Staleness check on foreground:** When the app opens and is online, hit `GET /api/decks` (already exists) and compare each downloaded deck's `updated_at` against `local_decks.server_updated_at`. Re-download any that changed.
- **Purchased decks are copies.** If the original marketplace listing updates, the user's purchased copy doesn't change — this is existing behavior. No invalidation needed for purchased decks unless the user's own copy changes (which only happens if they edit cards on web).
- **Deleted deck handling:** If a server deck no longer appears in the deck list response, mark the local copy with a `deleted_on_server` flag. Show it dimmed with an info label. Don't auto-delete — the data is still useful for studying.
- **No TTL / expiry.** Downloaded decks don't "expire." They stay until the user removes them or the staleness check updates them. Flashcard content doesn't go stale the way a news feed does.

### 7. Network State Awareness

**Problem:** The app needs to gracefully handle being offline, coming online, and the transition between states.

**Approach:**

- **Detection:** `@react-native-community/netinfo` provides `addEventListener` for reachability changes. Expose network state via a React context (`NetworkContext`) that any component can consume.
- **UI indicators:** A slim banner at the top of the screen (below the nav bar): "You're offline — studying downloaded decks" in a muted amber. Dismissible, reappears on navigation. Not a blocking modal — never interrupt studying.
- **Feature gating:** When offline, navigation items for Generate, Marketplace, and Settings show a subtle lock/cloud icon. Tapping them shows a toast: "This feature requires internet." The Dashboard shows downloaded decks only with an "Offline Mode" label. Study is fully functional.
- **Transition online:** When connectivity returns, the amber banner changes to "Back online — syncing..." briefly, then disappears. The sync worker fires automatically. No user action needed.
- **Transition offline mid-study:** No impact. Study sessions are already local. The session completes normally and queues for sync.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Local database | expo-sqlite | Ships with Expo, zero config, full SQL control, no heavy ORM |
| Sync direction | Upload-only (sessions) | Deck data is read-only locally, avoids bidirectional sync complexity |
| Download strategy | Opt-in per deck | Respects storage and data usage, safe default for all users |
| Conflict resolution | None needed | Sessions are append-only, streaks/scores are server-derived, deck edits are online-only |
| Streak accuracy | Real timestamps preserved | Offline sessions carry actual `completed_at`, server recalculates correctly on sync |
| Session deduplication | `client_session_id` UUID | Idempotent server endpoint, safe retries, no double-counting |
| Network detection | `@react-native-community/netinfo` | Standard RN library, event-driven, reliable |

## Open Questions

- Should we batch-sync sessions (one POST with array) or sync individually? Batch is more efficient but slightly more complex. Leaning batch.
- Should the "Download for offline" action also pre-download any deck assets we add in the future (images, audio)? For now there are no media assets on cards, but the download architecture should be extensible.
- Should we show a "last synced" timestamp somewhere in the UI so users know their data is current? Probably yes, in the Manage Downloads screen.
- When offline, should we show locally-cached study score and streak (potentially stale) or hide them entirely? Leaning toward showing with a "may not reflect recent web activity" footnote.

## Scope Boundaries

**In scope:**

- Offline study on downloaded decks (all four modes)
- Local SQLite database with expo-sqlite (decks, cards, pending sessions)
- Session upload queue with idempotent sync
- Opt-in deck download with storage management UI
- Network state detection and offline/online UI indicators
- Staleness check and deck re-download on foreground

**Out of scope:**

- Offline deck creation or card editing (online-only for v1)
- Offline marketplace browsing or purchasing
- Offline AI generation
- Full bidirectional sync / CRDTs / real-time sync
- Background sync via iOS background fetch (foreground sync only for v1)
- Offline user profile or settings changes
- Media/image caching (no media on cards currently)

## Next Steps

→ `/workflows:plan` for implementation details
