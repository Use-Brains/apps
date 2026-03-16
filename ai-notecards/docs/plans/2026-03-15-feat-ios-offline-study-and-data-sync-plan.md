# iOS Offline Study & Data Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a real native study flow on iOS that works against downloaded decks offline, stores completed sessions locally, and syncs them safely to the server when connectivity returns.

**Architecture:** Build this in two phases under one plan. Phase 1 gives the mobile app a real local study loop plus SQLite-backed offline deck/session storage. Phase 2 adds timestamp-aware server sync, deck refresh/download management, and offline-aware UI gating across the existing mobile surfaces. MMKV-backed React Query persistence remains for warm cache hydration, but SQLite becomes the durable source of truth for offline study data.

**Tech Stack:** Expo Router, React Native, expo-sqlite, MMKV, TanStack Query, Express, PostgreSQL migrations, Node test runner, Vitest

---

## Research Summary

- Relevant brainstorm: [2026-03-15-ios-offline-study-and-data-sync-brainstorm.md](/Users/kashane/app-dev/apps/ai-notecards/docs/brainstorms/2026-03-15-ios-offline-study-and-data-sync-brainstorm.md)
- Mobile app shell already persists selected query roots with MMKV in [query-client.ts](/Users/kashane/app-dev/apps/ai-notecards/mobile/src/lib/query-client.ts).
- iOS study and deck detail screens are still placeholders in [study/[deckId].tsx](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/study/[deckId].tsx) and [decks/[id].tsx](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/decks/[id].tsx).
- The home screen is also a placeholder in [home/index.tsx](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/(tabs)/home/index.tsx), so download/offline status should land there rather than in a new top-level surface.
- The current study backend only supports server-created sessions and `NOW()`-based completion/streak logic in [study.js](/Users/kashane/app-dev/apps/ai-notecards/server/src/routes/study.js).
- Profile/settings cannot be treated as fully disabled offline anymore because [profile.tsx](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/(tabs)/profile.tsx) now contains biometric controls and billing entry points.
- Relevant institutional doc: [account-settings-experience.md](/Users/kashane/app-dev/apps/ai-notecards/docs/solutions/feature-patterns/account-settings-experience.md) confirms the project prefers extending existing settings/profile surfaces instead of inventing parallel account UIs.
- Current package manifests do not yet include `expo-sqlite` or `@react-native-community/netinfo`, so the plan must account for dependency installation and any Expo compatibility checks in [mobile/package.json](/Users/kashane/app-dev/apps/ai-notecards/mobile/package.json).
- The existing server test command uses Node's built-in test runner and currently has no route-level study test file, so the plan should expect to add route tests from scratch in [server/package.json](/Users/kashane/app-dev/apps/ai-notecards/server/package.json).

## Spec Decisions

- Ship this as two implementation phases inside one branch:
  - Phase 1: native study flow + SQLite persistence foundation
  - Phase 2: sync endpoint, download management, stale refresh, offline banners/gating
- Use batch sync at the API contract level from the start. Even if the client uploads one session at a time initially, the endpoint should accept arrays to avoid a contract migration later.
- Show last-known stats offline with explicit stale copy rather than hiding them completely.
- Keep download management inside the existing profile/settings area, not as a separate app section.
- Do not attempt background iOS sync, offline editing, or offline marketplace behavior in this plan.
- Accept client-supplied study timestamps, but only through a bounded-trust policy: validate ISO format, require `started_at <= completed_at`, reject sessions too far in the future, and reject sessions older than a defined retention window.
- Treat the downloaded deck snapshot as authoritative for the historical session. Sync must validate ownership and session integrity, but must not reject a legitimate offline session just because the live deck changed after download.
- Execute Task 1 with service-first tests around `server/src/services/study-sync.js`. Keep route tests thin or optional until the repo has a stronger HTTP test harness.

## Risks

- The highest-risk area is server-side streak correctness. Existing `NOW()`-based updates cannot be reused as-is for offline sessions.
- There is a real chance of overbuilding the mobile study UI. Keep the first native study loop simple and support only the modes already recognized by the server.
- SQLite and MMKV can drift if responsibilities are not explicit. SQLite must own offline study data; MMKV should only cache server/query state.
- Ratings rely on completed study sessions. Synced offline sessions must satisfy the existing “studied before rating” rule.
- Out-of-order sync is a real data-integrity risk. A user may sync an older session after a newer online session already exists, so recomputation must be deterministic from stored session dates instead of incrementally guessing streak state.
- Download refresh can become chatty if every foreground event refetches every downloaded deck. Refresh logic needs a cheap comparison path and bounded retry behavior.

## Hardening Notes

- Prefer a shared server helper that recomputes `current_streak`, `longest_streak`, and `last_study_date` from persisted `study_sessions` for one user after inserts, rather than trying to incrementally patch the existing `NOW()` logic for offline sessions.
- Keep `/api/study/sync` behind the same auth and CSRF expectations already used by state-changing study routes. Validate every field strictly and reject malformed timestamps, unsupported modes, and impossible `correct/total_cards` pairs before any write.
- Add a route-specific rate limiter for sync uploads. Offline retry loops can unintentionally hammer the endpoint when the network is unstable.
- Make SQLite writes transactional at the repository boundary, especially when replacing deck snapshots or marking batches of sessions as synced.
- Keep the first UI cut accessible and narrow. Reuse existing screens and simple compound components instead of introducing a second navigation model for offline-only flows.
- Normalize accepted client timestamps to UTC and store the accepted values used for server-side streak/history updates.
- Include snapshot metadata in the queued session payload and SQLite record, at minimum `deck_id`, `server_updated_at`, and `total_cards`, so the server can validate the historical session against what was downloaded instead of the current deck row.
- If the downloaded deck is later edited or deleted on the server, still accept historical offline sessions from that snapshot as long as the deck belonged to the user when downloaded and the payload remains internally valid.

## Task 1: Add Timestamp-Aware Offline Sync Support on the Server

**Files:**
- Create: `server/src/db/migrations/017_study_sync.sql`
- Modify: `server/src/routes/study.js`
- Create: `server/src/services/study-sync.js`
- Test: `server/src/services/study-sync.test.js`
- Test: `server/src/routes/study.test.js` only if a thin route wiring check is still useful after the service suite exists
- Test: `server/package.json`

**Step 1: Write the failing route tests**

Cover:
- the service accepts an array of completed sessions with `client_session_id`
- duplicate `client_session_id` does not double-count study score or deck stats
- a session completed yesterday but synced today updates streaks using the provided completion date, not `NOW()`
- syncing an older session after a newer one does not corrupt `current_streak`, `longest_streak`, or `last_study_date`
- synced sessions count toward the rating prerequisite query path already used by `ratings.js`
- invalid session payloads are rejected with `400` before writes
- malformed timestamps, future timestamps, and too-old timestamps are rejected per the bounded-trust policy
- live deck edits after download do not invalidate an otherwise valid historical offline session when snapshot metadata is present

**Step 2: Run the targeted tests and verify they fail**

Run: `npm test -- src/services/study-sync.test.js` from `apps/ai-notecards/server`

Expected: FAIL because the sync service, migration, and timestamp-aware logic do not exist yet.

**Step 3: Add the database shape for idempotent sync**

Implement in `server/src/db/migrations/017_study_sync.sql`:
- add `client_session_id UUID` to `study_sessions`
- add nullable snapshot metadata columns needed to validate historical offline sessions, such as `deck_snapshot_updated_at` and `deck_snapshot_total_cards`
- add a unique index on `(user_id, client_session_id)` where `client_session_id IS NOT NULL`
- add any supporting indexes needed for user/date recomputation queries
- leave existing online session creation semantics unchanged

Do not change existing session rows during migration beyond adding nullable support.

**Step 4: Implement shared study-stat recomputation helpers**

Refactor `server/src/routes/study.js` so both the existing online completion path and the new sync path can call shared helpers for:
- validating study mode/card totals
- applying `study_score`
- updating `deck_stats`
- recomputing `current_streak`, `longest_streak`, and `last_study_date` from persisted completion dates for that user

In `server/src/services/study-sync.js`:
- parse and validate sync payloads
- enforce bounded-trust timestamp rules
- insert deduplicated sessions in a transaction
- recalculate streak fields from stored rows after inserts
- update per-deck stats without double-counting deduped sessions
- treat snapshot metadata as authoritative for historical validation rather than the current live deck shape

**Step 5: Add `POST /api/study/sync`**

Implement:
- request body `{ sessions: [...] }`
- per-session fields: `client_session_id`, `deck_id`, `mode`, `correct`, `total_cards`, `started_at`, `completed_at`, `deck_snapshot_updated_at`
- ownership validation for `deck_id`
- idempotent insert/update behavior
- route-level rate limiting tuned for retry bursts
- response with accepted IDs and deduped IDs

Keep existing `POST /api/study` and `PATCH /api/study/:id` working for the web app and any online-only native fallback.

**Step 6: Re-run the route tests**

Run: `npm test -- src/services/study-sync.test.js`

Expected: PASS

**Step 7: Run the full server suite**

Run: `npm test`

Expected: PASS with no regressions in billing or study behavior.

**Step 8: Commit**

```bash
git add server/src/db/migrations/017_study_sync.sql server/src/services/study-sync.js server/src/services/study-sync.test.js server/src/routes/study.js server/package.json
git commit -m "feat: add timestamp-aware offline study sync"
```

## Task 2: Create the Mobile SQLite Offline Data Layer

**Files:**
- Modify: `mobile/package.json`
- Create: `mobile/src/lib/offline/db.ts`
- Create: `mobile/src/lib/offline/schema.ts`
- Create: `mobile/src/lib/offline/repository.ts`
- Create: `mobile/src/lib/offline/types.ts`
- Test: `mobile/__tests__/unit/offline-db.test.ts`
- Modify: `mobile/package.json`
- Modify: `mobile/vitest.config.ts`

**Step 1: Write the failing unit tests**

Cover:
- schema bootstrap creates `local_decks`, `local_cards`, and `pending_sessions`
- saving a downloaded deck replaces stale card rows atomically
- enqueuing a pending session is durable and queryable after reload
- synced sessions can be marked and purged safely

**Step 2: Run the targeted mobile tests and verify they fail**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/offline-db.test.ts`

Expected: FAIL because the offline DB module does not exist.

**Step 2.5: Add required mobile dependencies**

Add:
- `expo-sqlite`

Verify the chosen version matches Expo SDK 55 compatibility before implementation.

**Step 3: Implement the SQLite bootstrap layer**

In `mobile/src/lib/offline/db.ts`:
- initialize `expo-sqlite`
- expose a singleton/open helper
- run schema bootstrap from `schema.ts`

In `mobile/src/lib/offline/schema.ts`:
- define SQL statements for `local_decks`, `local_cards`, `pending_sessions`
- include `deleted_on_server`
- include indexes for `deck_id` and `synced`

**Step 4: Implement repository helpers**

In `mobile/src/lib/offline/repository.ts`:
- `saveDeckSnapshot`
- `getDownloadedDecks`
- `getDownloadedDeck`
- `markDeckDeletedOnServer`
- `enqueuePendingSession`
- `getPendingSessions`
- `markSessionSynced`
- `purgeSyncedSessions`

Keep return shapes immutable and type them in `types.ts`.
Use explicit transactions for deck snapshot replacement so partially written decks never become visible.

**Step 5: Re-run the targeted mobile tests**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/offline-db.test.ts`

Expected: PASS

**Step 6: Run the existing mobile unit suite**

Run: `node ./node_modules/vitest/vitest.mjs run`

Expected: PASS, including existing RevenueCat tests.

**Step 7: Commit**

```bash
git add mobile/src/lib/offline mobile/__tests__/unit/offline-db.test.ts mobile/package.json mobile/vitest.config.ts
git commit -m "feat: add offline sqlite storage layer"
```

## Task 3: Build the Native Study Flow Against Local Deck Data

**Files:**
- Modify: `mobile/app/study/[deckId].tsx`
- Modify: `mobile/app/decks/[id].tsx`
- Modify: `mobile/app/(tabs)/home/index.tsx`
- Modify: `mobile/src/lib/api.ts`
- Modify: `mobile/src/types/api.ts`
- Create: `mobile/src/lib/study/session.ts`
- Create: `mobile/src/lib/study/modes.ts`
- Create: `mobile/src/components/study/StudyModePicker.tsx`
- Create: `mobile/src/components/study/StudySessionCard.tsx`
- Test: `mobile/__tests__/unit/study-session.test.ts`

**Step 1: Write the failing study-session tests**

Cover:
- local session creation generates a client UUID and timestamps
- mode-specific minimum card rules match the server contract
- completing a local session writes one pending sync item
- online fallback does not require server session creation for offline-capable study
- last-known stats remain read-only display state and are not mutated directly by local session completion

**Step 2: Run the targeted tests and verify they fail**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/study-session.test.ts`

Expected: FAIL because the local study session module does not exist.

**Step 3: Implement local study session orchestration**

In `mobile/src/lib/study/session.ts`:
- create local sessions from downloaded deck data
- compute per-mode totals
- finalize sessions into `pending_sessions`
- expose a clear result shape the UI can use for “queued for sync” confirmation and optimistic local history

In `mobile/src/lib/study/modes.ts`:
- centralize supported modes and minimum-card requirements to match server values

**Step 4: Replace placeholder study UI**

In `mobile/app/study/[deckId].tsx`:
- load the downloaded deck snapshot from SQLite first
- if missing and online, offer download/fetch path rather than a broken study state
- render a simple study loop with mode selection, progress, and completion state
- show a “queued for sync” confirmation after local completion

Do not block this task on polished animations or advanced card interactions.
Keep the first screen architecture compositional:
- small study components under `mobile/src/components/study/`
- local session orchestration in hooks/helpers, not inline inside the screen

**Step 5: Hook deck detail and home screens into study**

In `mobile/app/decks/[id].tsx` and `mobile/app/(tabs)/home/index.tsx`:
- replace placeholder copy with a real deck list/detail flow
- expose “Download for offline”, “Remove download”, and “Study” actions
- show offline availability state clearly

If the deck list/detail work becomes too large, keep the first cut narrow:
- home shows downloaded decks + owned decks
- detail shows cards count, updated state, and study/download actions

**Step 6: Re-run the targeted tests**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/study-session.test.ts`

Expected: PASS

**Step 7: Run mobile typecheck**

Run: `node ./node_modules/typescript/bin/tsc --noEmit`

Expected: PASS

**Step 8: Commit**

```bash
git add mobile/app/study/'[deckId]'.tsx mobile/app/decks/'[id]'.tsx mobile/app/'(tabs)'/home/index.tsx mobile/src/lib/api.ts mobile/src/types/api.ts mobile/src/lib/study mobile/src/components/study mobile/__tests__/unit/study-session.test.ts
git commit -m "feat: add native local study flow"
```

## Task 4: Add Download, Refresh, and Sync Workers on Mobile

**Files:**
- Modify: `mobile/package.json`
- Create: `mobile/src/lib/offline/sync.ts`
- Create: `mobile/src/lib/offline/downloads.ts`
- Create: `mobile/src/lib/network.tsx`
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/src/lib/query-client.ts`
- Modify: `mobile/src/lib/api.ts`
- Test: `mobile/__tests__/unit/offline-sync.test.ts`

**Step 1: Write the failing sync tests**

Cover:
- online transition triggers pending session upload
- duplicate sync responses mark local rows as synced without replay
- deck download saves deck + card snapshot atomically
- stale deck refresh updates downloaded data when `updated_at` changes
- sync backoff prevents repeated immediate retries on repeated failures

**Step 2: Run the targeted tests and verify they fail**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/offline-sync.test.ts`

Expected: FAIL because the download/sync modules do not exist.

**Step 2.5: Add required network dependency**

Add:
- `@react-native-community/netinfo`

Confirm compatibility with Expo SDK 55 before wiring the provider.

**Step 3: Implement download helpers**

In `mobile/src/lib/offline/downloads.ts`:
- fetch deck + cards from `api.getDeck`
- save snapshots to SQLite
- compare server `updatedAt` values for downloaded decks
- mark missing server decks as `deleted_on_server`
- avoid N round-trips where possible by using `api.getDecks()` as the first comparison pass before fetching full deck payloads

**Step 4: Implement sync helpers**

In `mobile/src/lib/offline/sync.ts`:
- load unsynced sessions from SQLite
- POST them to `/study/sync`
- mark successes as synced
- leave failures queued
- expose a lightweight retry/backoff guard to avoid storming the API
- keep batch sizes bounded so one large backlog does not create a giant request body

**Step 5: Implement shared network context**

In `mobile/src/lib/network.tsx`:
- expose current reachability state
- listen to foreground and online transitions
- trigger sync/download refresh hooks

Wire it into `mobile/app/_layout.tsx` so the provider is available app-wide.

**Step 6: Trim query persistence responsibilities**

In `mobile/src/lib/query-client.ts`:
- keep query persistence for cache hydration
- stop treating persisted query state as the source of truth for offline study
- document this boundary in comments so the split stays explicit

**Step 7: Re-run the targeted tests**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/offline-sync.test.ts`

Expected: PASS

**Step 8: Run the full mobile unit suite and typecheck**

Run: `node ./node_modules/vitest/vitest.mjs run`

Run: `node ./node_modules/typescript/bin/tsc --noEmit`

Expected: PASS

**Step 9: Commit**

```bash
git add mobile/src/lib/offline mobile/src/lib/network.tsx mobile/app/_layout.tsx mobile/src/lib/query-client.ts mobile/src/lib/api.ts mobile/__tests__/unit/offline-sync.test.ts
git commit -m "feat: add offline download and sync workers"
```

## Task 5: Make Offline State Visible Across Existing Mobile Surfaces

**Files:**
- Modify: `mobile/app/(tabs)/profile.tsx`
- Modify: `mobile/app/(tabs)/generate.tsx`
- Modify: `mobile/app/(tabs)/marketplace/index.tsx`
- Modify: `mobile/app/(tabs)/marketplace/[id].tsx`
- Modify: `mobile/app/(tabs)/home/index.tsx`
- Create: `mobile/src/components/OfflineBanner.tsx`
- Create: `mobile/src/components/downloads/ManageDownloads.tsx`
- Test: `mobile/__tests__/unit/offline-ui.test.ts`

**Step 1: Write the failing UI tests**

Cover:
- offline banner appears when reachability is lost
- generate and marketplace surfaces show clear offline-disabled copy
- profile still renders biometrics and download management while remote billing actions are gated
- last-known stats render with stale wording when offline
- offline surfaces do not navigate users into dead-end flows for marketplace purchase or billing management

**Step 2: Run the targeted tests and verify they fail**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/offline-ui.test.ts`

Expected: FAIL because the banner and offline UI states do not exist.

**Step 3: Implement shared offline banner**

In `mobile/src/components/OfflineBanner.tsx`:
- render offline and syncing states
- keep copy concise and non-blocking

Mount it near the app shell or tab shell rather than duplicating per-screen.

**Step 4: Add offline-aware gating**

Update:
- `mobile/app/(tabs)/generate.tsx`
- `mobile/app/(tabs)/marketplace/index.tsx`
- `mobile/app/(tabs)/marketplace/[id].tsx`
- `mobile/app/(tabs)/profile.tsx`

Rules:
- generate and marketplace browsing/purchase actions are disabled offline
- profile keeps biometrics, logout, and download management available
- Apple/Stripe management actions show an offline message when unreachable

**Step 5: Add download management UI**

In `mobile/src/components/downloads/ManageDownloads.tsx` and `mobile/app/(tabs)/profile.tsx`:
- show downloaded decks
- show storage usage
- support remove-one and remove-all actions
- show last sync / last refresh timestamp if available
- keep destructive actions confirm-gated when removing all downloads

**Step 6: Re-run the targeted tests**

Run: `node ./node_modules/vitest/vitest.mjs run __tests__/unit/offline-ui.test.ts`

Expected: PASS

**Step 7: Run mobile verification**

Run: `node ./node_modules/vitest/vitest.mjs run`

Run: `node ./node_modules/typescript/bin/tsc --noEmit`

Expected: PASS

**Step 8: Commit**

```bash
git add mobile/app/'(tabs)'/profile.tsx mobile/app/'(tabs)'/generate.tsx mobile/app/'(tabs)'/marketplace/index.tsx mobile/app/'(tabs)'/marketplace/'[id]'.tsx mobile/app/'(tabs)'/home/index.tsx mobile/src/components/OfflineBanner.tsx mobile/src/components/downloads/ManageDownloads.tsx mobile/__tests__/unit/offline-ui.test.ts
git commit -m "feat: surface offline state across mobile tabs"
```

## Task 6: Regression Coverage, Docs, and Manual Validation

**Files:**
- Modify: `apps/ai-notecards/README.md`
- Modify: `apps/ai-notecards/CLAUDE.md`
- Modify: `apps/ai-notecards/docs/brainstorms/2026-03-15-ios-offline-study-and-data-sync-brainstorm.md` only if implementation decisions materially diverge
- Modify: `apps/ai-notecards/docs/plans/2026-03-15-feat-ios-offline-study-and-data-sync-plan.md`

**Step 1: Update docs**

Document:
- new `/api/study/sync` contract
- SQLite vs MMKV responsibility split
- offline limitations and supported flows
- any new env or dependency requirements

**Step 2: Check off completed plan items**

Update this plan document as implementation lands. Leave manual validation items unchecked until actually run.

**Step 3: Run end-to-end verification**

Server:
- `npm test`

Mobile:
- `node ./node_modules/vitest/vitest.mjs run`
- `node ./node_modules/typescript/bin/tsc --noEmit`

Client:
- `npm run build` from `apps/ai-notecards/client`

Expected: PASS

**Step 4: Manual validation on iOS dev build**

Validate:
- download a deck while online
- force offline mode
- complete a local study session
- confirm it appears as pending sync
- restore connectivity
- confirm sync clears the pending state
- confirm study score/streak/history update correctly after sync
- confirm rating eligibility works after syncing an offline session on a purchased deck
- confirm profile still allows biometrics and download management offline
- confirm marketplace/generate surfaces show offline-disabled states
- confirm duplicate retry of the same queued session does not double-count stats
- confirm an older queued session synced after a newer online session leaves streaks correct

**Step 5: Commit**

```bash
git add README.md CLAUDE.md docs/plans/2026-03-15-feat-ios-offline-study-and-data-sync-plan.md
git commit -m "docs: capture offline study implementation details"
```

## Acceptance Criteria

- [x] iOS can download owned decks and study them without network access.
- [x] Native study sessions no longer depend on server-created session IDs when running offline.
- [x] Offline-completed sessions sync idempotently via `client_session_id`.
- [x] Synced offline sessions update study score, deck stats, and streaks from real completion timestamps.
- [x] Out-of-order sync of older sessions does not corrupt streak fields.
- [x] Profile/settings remain usable offline for local controls and download management.
- [x] Generate and marketplace surfaces clearly degrade offline instead of failing ambiguously.
- [x] SQLite owns offline study data; MMKV remains only a cache layer.
- [x] Server and mobile automated tests cover the new sync and offline storage paths.
- [x] Required native dependencies are added with Expo-compatible versions.
- [ ] Manual iOS validation confirms the end-to-end offline -> sync flow.

## Out of Scope

- Offline deck editing or card creation
- Background sync while the app is suspended
- Offline marketplace browsing or purchasing
- Offline billing/account management beyond local-device controls
- Media asset caching

## Execution Notes

- Keep commits small and phase-aligned. Do not attempt Tasks 1-5 in one edit pass.
- If streak recomputation becomes risky, isolate it into a dedicated helper and add extra regression tests before wiring the route.
- Prefer adapting the existing mobile screens over introducing new routes unless the existing screens become unmanageable.
