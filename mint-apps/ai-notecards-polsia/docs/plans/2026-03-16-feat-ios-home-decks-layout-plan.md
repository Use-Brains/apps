---
title: 'iOS Home Decks Layout Refresh'
type: feat
date: 2026-03-16
origin: docs/brainstorms/2026-03-16-ios-home-decks-layout-brainstorm.md
---

# iOS Home Decks Layout Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the split Home deck layout with one active deck list, move secondary actions into a top-right actions menu, and add safe archive handling for purchased decks.

**Architecture:** Keep Home focused on immediate deck access (`Open`, `Study`) and move deck management into a stateful per-card actions sheet. Reuse the existing offline SQLite snapshot layer for download/remove-download behavior, add a small archived state to the deck model for purchased decks, and keep seller eligibility driven by the authenticated user object plus existing sell routes.

**Tech Stack:** Expo Router v4, React Native 0.83, TypeScript strict mode, TanStack Query v5, Expo SQLite offline store, Express 4, PostgreSQL.

---

## Research Summary

### Repo Patterns

- [home/index.tsx](/repo/ai-notecards/mobile/app/(tabs)/home/index.tsx) currently owns both offline download actions and deck listing UI. It already has the right data sources for deck list query + offline snapshot lookup, but the information hierarchy is wrong for the desired product direction.
- [settings.tsx](/repo/ai-notecards/mobile/app/(tabs)/settings.tsx) already hosts download management through [ManageDownloads.tsx](/repo/ai-notecards/mobile/src/components/downloads/ManageDownloads.tsx), so Home should not duplicate download explanation copy.
- [BottomSheet.tsx](/repo/ai-notecards/mobile/src/components/BottomSheet.tsx) is the correct primitive for the deck actions menu. `ActionSheetIOS` is too limited for inline progress, disabled checked rows, and mixed destructive/non-destructive states.
- [auth.tsx](/repo/ai-notecards/mobile/src/lib/auth.tsx) and [api.ts](/repo/ai-notecards/mobile/src/lib/api.ts) already expose seller readiness signals: `plan`, `sellerTermsAccepted`, and `stripeConnectOnboarded`.
- [decks.js](/repo/ai-notecards/server/src/routes/decks.js) supports list, read, duplicate, edit, and delete, but has no archive state or archive route today.

### Institutional Learnings

- [ios-offline-study-sync-and-local-storage.md](/repo/ai-notecards/docs/solutions/integration-issues/ios-offline-study-sync-and-local-storage.md): treat offline downloads as a SQLite-backed source of truth, not a UI-only flag. Reuse the existing repository/download helpers instead of introducing a parallel cache.
- [2026-03-13-feat-seller-onboarding-and-marketplace-listing-plan.md](/repo/ai-notecards/docs/plans/2026-03-13-feat-seller-onboarding-and-marketplace-listing-plan.md): seller state should come from existing account signals and existing sell routes rather than a new eligibility system.

### External Research Decision

Skipped. The feature is an internal product/UI flow with strong local patterns already in the codebase. No external API, payment, or platform rule research is required for planning.

## SpecFlow Analysis

### User Flows

1. User opens Home and sees only active decks in `All Decks`.
2. User taps `Open` and navigates to deck detail.
3. User taps `Study`; if the deck is not downloaded and the app is online, the app may save an offline snapshot first and then enter study. If offline and not downloaded, the existing offline-safe behavior still applies.
4. User opens the top-right actions icon and sees state-aware menu rows.
5. User chooses `Download`; the menu shows an in-progress state, then a checked `Downloaded` state.
6. User chooses `Remove Download`; a confirmation explains that the deck remains in the account and only the device copy is removed.
7. User chooses `Sell`; if eligible, navigate to sell flow. If not eligible because seller onboarding is incomplete, show a modal with a direct path to seller onboarding.
8. User chooses `Delete` on a generated deck; a destructive confirmation appears, then the deck is removed from the account.
9. User chooses `Archive` on a purchased deck; the deck disappears from the active list and moves into a collapsed `Archived` section.
10. User expands `Archived`, opens/studies an archived purchased deck, or restores it to the active list.

### Gaps Resolved In This Plan

- `Archive needs restore`: add an unarchive/restore action in archived deck actions. Without that, archive becomes a soft-delete with no recovery path.
- `Sell ineligibility has two causes`: generated decks with incomplete seller setup should show onboarding guidance; purchased decks should show a non-onboarding explanation because they can never be sold.
- `Download stateful UI requires custom sheet`: use the shared bottom sheet instead of `ActionSheetIOS`.

## Assumptions

- Archiving applies only to purchased decks. Generated decks keep real deletion.
- Archived decks remain fully owned and accessible; archive is an organizational state, not a permissions change.
- The archived section is collapsed by default and rendered only when archived purchased decks exist.
- Seller onboarding entry should route to the existing seller flow, likely via `/seller`, and let that screen own the onboarding process.

## Acceptance Criteria

- Home shows one active `All Decks` section and no separate `Downloaded` section.
- Deck cards keep visible `Open` and `Study` buttons.
- Deck cards do not show inline download/offline metadata.
- Each active card has a top-right actions trigger that opens a bottom sheet.
- Download action supports idle, in-progress, and checked downloaded states.
- Remove-download confirmation clearly states that only the device copy is removed.
- Sell action is active for eligible generated decks, greyed out with explanation for incomplete seller onboarding, and unavailable with a different explanation for purchased decks.
- Generated decks expose destructive delete with confirmation.
- Purchased decks expose archive instead of delete.
- Archived purchased decks appear in a collapsed `Archived` section at the bottom of Home.
- Archived decks can be restored back to the active list.
- Existing Settings download management continues to work.

## Technical Considerations

- Add archived state on the server, not only in client memory, so archived decks remain stable across device restarts and fresh installs.
- Prefer a nullable `archived_at` timestamp on `decks` over a boolean so the system retains chronology and leaves room for future archive UX.
- Extend the deck list/read contract and mobile deck types to include archive metadata.
- Keep downloaded deck snapshots separate from server archive state. A deck can be archived and still downloaded unless product explicitly wants archive to remove the local copy. For v1, remove the local snapshot when archiving to avoid hidden device storage for hidden decks.
- Invalidate/refetch `deckKeys.lists()` after any delete/archive/unarchive action.
- Preserve current offline-study rules. Do not introduce new offline mutation types beyond best-effort local download removal.

## System-Wide Impact

- Mobile Home screen UX and supporting components
- Mobile deck types and API client methods
- Server deck schema and routes
- Unit tests for mobile UI state and server archive behavior

## Implementation Tasks

### Task 1: Add Server-Side Archive Support For Purchased Decks

**Files:**
- Create: [013_deck_archive_state.sql](/repo/ai-notecards/server/src/db/migrations/013_deck_archive_state.sql)
- Modify: [decks.js](/repo/ai-notecards/server/src/routes/decks.js)
- Test: [decks.test.js](/repo/ai-notecards/server/src/routes/decks.test.js)

**Steps:**
1. Add a migration that introduces `archived_at TIMESTAMPTZ NULL` on `decks`.
2. Update `GET /api/decks` to return `archived_at` so the mobile app can split active vs archived decks client-side.
3. Add `POST /api/decks/:id/archive` that only succeeds for purchased decks owned by the current user and sets `archived_at = NOW()`.
4. Add `POST /api/decks/:id/unarchive` that only succeeds for purchased decks owned by the current user and clears `archived_at`.
5. Keep `DELETE /api/decks/:id` available for generated decks; reject delete for purchased decks if needed so the mobile app cannot accidentally hard-delete them through any future client path.
6. Add route tests covering archive success, unarchive success, generated-deck archive rejection, ownership checks, and purchased-deck delete rejection.

### Task 2: Extend Mobile API Types And Client Methods

**Files:**
- Modify: [api.ts](/repo/ai-notecards/mobile/src/lib/api.ts)
- Modify: [api.ts](/repo/ai-notecards/mobile/src/types/api.ts)

**Steps:**
1. Extend the mobile `Deck` type with `archivedAt: string | null` and ensure API response mapping includes it.
2. Add typed client methods for `archiveDeck(id)` and `unarchiveDeck(id)`.
3. Confirm seller-related user fields already required by Home are present and document the derived gating logic in code comments if needed.

### Task 3: Extract Reusable Home Deck Action UI

**Files:**
- Create: [DeckActionsSheet.tsx](/repo/ai-notecards/mobile/src/components/decks/DeckActionsSheet.tsx)
- Create: [DeckCard.tsx](/repo/ai-notecards/mobile/src/components/decks/DeckCard.tsx)
- Create: [deck-actions.ts](/repo/ai-notecards/mobile/src/lib/decks/deck-actions.ts)
- Test: [home-deck-actions.test.tsx](/repo/ai-notecards/mobile/__tests__/unit/home-deck-actions.test.tsx)

**Steps:**
1. Create a reusable `DeckCard` component that renders title plus visible `Open` and `Study` buttons and a top-right actions trigger.
2. Create a `DeckActionsSheet` using the shared [BottomSheet.tsx](/repo/ai-notecards/mobile/src/components/BottomSheet.tsx).
3. Build a small helper module to derive action rows from deck state: downloaded/not downloaded/downloading, generated/purchased, seller-ready/onboarding-needed, archived/active.
4. Support `Download`, `Downloaded` with circled check icon and disabled state, `Remove Download`, `Sell`, `Archive` or `Delete`, and archived-state `Restore`.
5. Use `ActivityIndicator` for in-progress download row state.
6. Add unit tests for action derivation and the most important visible row combinations.

### Task 4: Rebuild Home Around Active And Archived Sections

**Files:**
- Modify: [home/index.tsx](/repo/ai-notecards/mobile/app/(tabs)/home/index.tsx)
- Test: [home-screen.test.tsx](/repo/ai-notecards/mobile/__tests__/unit/home-screen.test.tsx)

**Steps:**
1. Remove the subtitle and separate `Downloaded` section from Home.
2. Fetch decks once, split the result into `activeDecks` and `archivedDecks` by `archivedAt`.
3. Render `All Decks` for active decks with the extracted `DeckCard`.
4. Add a collapsed-by-default `Archived` section at the bottom, only when archived purchased decks exist.
5. Keep visible `Open` and `Study` CTAs on active cards. For archived cards, either keep `Open` plus `Study`, or `Open` plus `Restore`, but use one consistent pattern and document it in the implementation note. Recommendation: keep `Open` and `Study` for archived decks and make restore available in the actions sheet.
6. Ensure Home refreshes after archive, unarchive, delete, and download mutation completion.
7. Add unit tests covering no-downloaded-section behavior, archived section collapsed by default, and archive transitions between sections.

### Task 5: Wire Confirmations And Navigation For Secondary Actions

**Files:**
- Modify: [home/index.tsx](/repo/ai-notecards/mobile/app/(tabs)/home/index.tsx)
- Modify: [decks/[id].tsx](/repo/ai-notecards/mobile/app/decks/[id].tsx)
- Modify: [settings.tsx](/repo/ai-notecards/mobile/app/(tabs)/settings.tsx)

**Steps:**
1. Add `Alert.alert` confirmation for `Remove Download` with copy that explicitly says the deck stays in the account.
2. Add `Alert.alert` confirmation for generated deck delete with irreversible copy.
3. Add onboarding guidance alert for `Sell` when the user is not yet seller-ready, with a direct route to `/seller`.
4. Add a separate non-onboarding alert for purchased decks when `Sell` is unavailable because purchased decks cannot be sold.
5. Keep [decks/[id].tsx](/repo/ai-notecards/mobile/app/decks/[id].tsx) aligned with the new semantics if it still exposes download/remove controls. Do not let deck detail contradict Home.
6. Adjust Settings copy only if needed so download management language no longer implies Home owns offline management.

### Task 6: Add Verification Coverage

**Files:**
- Modify: [offline-sync.test.ts](/repo/ai-notecards/mobile/__tests__/unit/offline-sync.test.ts)
- Modify: [offline-db.test.ts](/repo/ai-notecards/mobile/__tests__/unit/offline-db.test.ts)
- Modify: [query-client.test.ts](/repo/ai-notecards/mobile/__tests__/unit/query-client.test.ts)
- Modify: [decks.test.js](/repo/ai-notecards/server/src/routes/decks.test.js)

**Steps:**
1. Add regression tests for download/remove-download behavior after the Home refactor.
2. Add route tests for archive/unarchive and delete safety.
3. Run mobile unit tests relevant to Home/offline logic.
4. Run server tests relevant to deck routes.
5. Run `npm run typecheck` and `npm run lint` in `mobile/`.

## Suggested Verification Commands

```bash
cd /repo/ai-notecards/mobile
npm run typecheck
npm run lint
npm test -- home-deck-actions home-screen offline-sync offline-db query-client
```

```bash
cd /repo/ai-notecards/server
npm test -- decks
```

## Risks

- Archive state touches persistent deck visibility, so server/client contract drift is the main risk.
- If the actions sheet is built ad hoc inside Home instead of extracted, the screen will become hard to maintain quickly.
- The sell gating copy can be misleading if purchased-deck ineligibility and onboarding ineligibility are not separated.
- Home and deck detail can diverge unless both are updated together.

## MVP Recommendation

Ship in this order:

1. Server archive support.
2. Mobile type/API updates.
3. Home single-list refactor with extracted actions sheet.
4. Confirmation flows and seller/archive edge cases.
5. Regression tests and verification.

## References

- [2026-03-16-ios-home-decks-layout-brainstorm.md](/repo/ai-notecards/docs/brainstorms/2026-03-16-ios-home-decks-layout-brainstorm.md)
- [home/index.tsx](/repo/ai-notecards/mobile/app/(tabs)/home/index.tsx)
- [settings.tsx](/repo/ai-notecards/mobile/app/(tabs)/settings.tsx)
- [ManageDownloads.tsx](/repo/ai-notecards/mobile/src/components/downloads/ManageDownloads.tsx)
- [BottomSheet.tsx](/repo/ai-notecards/mobile/src/components/BottomSheet.tsx)
- [decks.js](/repo/ai-notecards/server/src/routes/decks.js)
- [ios-offline-study-sync-and-local-storage.md](/repo/ai-notecards/docs/solutions/integration-issues/ios-offline-study-sync-and-local-storage.md)
