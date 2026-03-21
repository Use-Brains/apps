---
date: 2026-03-16
topic: ios-home-decks-layout
---

# iOS Home Decks Layout

## What We're Building

A cleaner Home screen for the iOS app that treats the tab as a deck library, not a download management surface. The current split between `Downloaded` and `All Decks` on Home creates duplicate information architecture because download management already lives in Settings.

The new Home screen should show one primary `All Decks` section with the existing `Open` and `Study` buttons on every active deck card. Secondary actions move into a top-right overflow action icon on each card. Purchased decks should never present a destructive delete path; instead they can be archived into a separate `Archived` section at the bottom of Home, collapsed by default.

## Why This Approach

Three directions were considered:

1. Keep the current split between downloaded and all decks. Rejected because it duplicates offline management and adds visual noise to the default library view.
2. Keep one deck list but still show inline download status text on every card. Rejected because it adds metadata the user does not need to scan during normal use.
3. Use one active deck list with a top-right overflow menu for secondary actions. Chosen because it keeps Home focused on study and access, while still making deck management available when needed.

This is the simplest approach that improves clarity without inventing folders, filters, or more navigation.

## Key Decisions

- `Home has one primary deck list`: Replace the separate `Downloaded` and `All Decks` sections with a single `All Decks` section for active decks.
- `Keep current primary buttons`: Each active deck card keeps the visible `Open` and `Study` buttons exactly as the default actions.
- `Remove inline download state`: Do not show `downloaded`, `online only`, or similar lightweight state in the card body. Download state is inferred from the overflow menu.
- `Move download explanation out of Home`: Any instructional copy about offline downloads belongs in Settings, which already owns download management details.
- `Add a top-right overflow action icon`: Every deck card gets a compact actions trigger in the top-right corner for secondary deck actions.
- `Download menu state is explicit`: If a deck is not downloaded, the menu shows `Download`. While downloading, show a circular progress indicator for that action. After completion, the menu item changes to `Downloaded`, becomes non-interactive, and shows a circled check icon.
- `Remove Download requires confirmation`: The menu includes `Remove Download` for downloaded decks. Tapping it opens a confirmation modal explaining that the download is removed from this device only and does not delete the deck from the user's account. Actions: continue or go back.
- `Sell is always present in the menu`: `Sell` appears after the download actions.
- `Sell eligibility is stateful`: If the account is eligible to sell, `Sell` looks active and routes into the sell flow. If the account is not yet eligible, `Sell` is greyed out.
- `Greyed-out Sell is still explainable`: Tapping an unavailable `Sell` action opens a modal explaining that seller onboarding must be completed first, with actions to go directly to seller onboarding or go back.
- `Delete is last and destructive`: The final overflow action for non-purchased decks is a red `Delete` option with a confirmation modal that explains deletion is permanent and cannot be undone.
- `Purchased decks use Archive instead of Delete`: Purchased decks must never expose a destructive delete action from Home. The final action label becomes `Archive`.
- `Archived purchased decks move out of the active list`: Archiving removes the purchased deck from the active `All Decks` section and places it in a dedicated `Archived` section below it.
- `Archived is collapsed by default`: The `Archived` section sits at the bottom of Home and starts collapsed so it does not compete with the active deck library.

## Resolved Questions

- `Primary CTA layout`: Keep both visible `Open` and `Study` buttons on each active deck card.
- `Per-card metadata`: Do not show download state text in the card body.
- `Overflow menu scope`: Include download state/actions, sell, and delete/archive in the same menu.
- `Purchased deck safety`: Purchased decks use archive behavior instead of delete.
- `Archived section behavior`: Show archived purchased decks in a bottom section that is collapsed by default.

## Next Steps

-> `/workflows:plan` for implementation details
