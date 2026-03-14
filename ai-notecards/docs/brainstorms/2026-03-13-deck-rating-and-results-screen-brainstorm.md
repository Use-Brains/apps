---
date: 2026-03-13
topic: deck-rating-and-results-screen
---

# Deck Rating & Results Screen

## What We're Building

Rework the post-study flow into two distinct screens:

1. **Results Screen** — shown after every deck completion. Displays current session accuracy, best accuracy ever, times completed, and an improvement indicator. Data powered by a new `deck_stats` table that tracks per-user, per-deck aggregate stats.

2. **Rating Screen** — shown only for purchased decks, only once (first completion where they haven't rated yet). Mandatory 1-5 star rating with optional 200-character review text. Rating is final — no edits. Reviews are displayed on the marketplace listing page.

## Why This Approach

The current flow shows a basic summary with a skippable rating modal overlay. This redesign:
- Makes rating mandatory for purchased decks (no skip button) — improves rating coverage on marketplace
- Separates results from rating into distinct, focused screens
- Adds meaningful stats (best score, times completed, improvement delta) to encourage repeated study
- Stores aggregates in `deck_stats` rather than computing from session history — fast reads, extensible for future stats
- Adds review text to give marketplace buyers more signal beyond star count

## Key Decisions

- **One-time rating, final**: Users see a clear warning that the rating cannot be changed. After rating, future completions skip the rating screen entirely.
- **`deck_stats` table**: New table `(user_id, deck_id, times_completed, best_accuracy)` updated atomically on session completion. Extensible for future metrics.
- **Review text**: Optional, max 200 characters, stored in the existing `ratings` table as a new `review_text` column. Displayed on MarketplaceDeck page.
- **Improvement indicator**: Computed client-side by comparing current accuracy against `best_accuracy` from `deck_stats`. Shows "New personal best!" or "Up X% from your best".
- **Rating screen gating**: Only shown for purchased decks (`deck.origin === 'purchased'`) where the user hasn't already rated (`no existing rating for user+listing`).
- **Flow order**: Study all cards → Results screen → Rating screen (if applicable) → Dashboard

## Screen Details

### Results Screen (all decks, every completion)

| Stat | Source |
|------|--------|
| Cards correct / total | Current session (`correct`, `total_cards`) |
| Current accuracy % | Computed from session |
| Best accuracy % | `deck_stats.best_accuracy` |
| Times completed | `deck_stats.times_completed` |
| Improvement indicator | Compare current vs best: "New personal best!" or "Up X% from best" or "Down X% from best" |

Buttons: "Study Again" and "Continue" (goes to rating screen for eligible purchased decks, or back to dashboard)

### Rating Screen (purchased decks, first time only)

- Deck title and card count shown for context
- 1-5 star selector (click to select)
- Optional review text field (200 char max)
- Submit button (disabled until stars selected)
- Warning text: "This rating is final and cannot be changed"
- No skip/back button — must submit to proceed
- After submit → navigate to dashboard

### Marketplace Listing Reviews (MarketplaceDeck page)

- New section below sample cards: "Reviews"
- Each review shows: star rating, reviewer display name, review text (if provided), date
- Only reviews with text are shown in this section (star-only ratings contribute to the average but don't appear as reviews)

## Data Changes

### New table: `deck_stats`
- `user_id` UUID FK → users
- `deck_id` UUID FK → decks
- `times_completed` INT DEFAULT 0
- `best_accuracy` NUMERIC(5,2) DEFAULT 0
- UNIQUE(user_id, deck_id)
- Updated atomically when study session completes via UPSERT

### Alter `ratings` table
- ADD COLUMN `review_text` TEXT (nullable, max 200 enforced in app)

### Backend changes
- `PATCH /api/study/:id` — upsert `deck_stats` on completion, return stats for results screen
- `POST /api/ratings` — accept optional `review_text`, remove the skip path
- `GET /api/ratings/listing/:id` — include `review_text` and `display_name` in response
- New: `GET /api/study/deck-stats/:deckId` — return `deck_stats` for a specific deck (or inline in session completion response)

## Additional Decisions

- **"Rated" badge on dashboard**: Yes — purchased deck cards show a small indicator once the user has rated them. Helps users track which decks they've reviewed.
- **Review moderation**: Yes — reviews are flaggable using the existing content flags system. Same report flow as listing flags.

## Next Steps

→ `/workflows:plan` for implementation details
