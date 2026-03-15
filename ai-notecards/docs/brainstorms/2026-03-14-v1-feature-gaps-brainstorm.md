# V1 Feature Gaps Brainstorm

**Date:** 2026-03-14
**Status:** Decided
**Scope:** New features needed to round out v1 before moving to v2

---

## What We're Building

Six feature areas to fill the most impactful gaps in the current v1 product:

### 1. Session Recap Screen

After completing a study session, show a summary screen with:
- Score and accuracy (already exists in results)
- List of missed cards with the correct answers displayed
- Cards grouped: correct vs missed
- "Study Again" and "Back to Dashboard" CTAs

This replaces the current results screen with a richer recap. No re-study-missed-only mode — keep it simple. Users who want to retry just start a new session.

### 2. Three New Study Modes

Add mode selection when starting a study session:

- **Flip Cards** (existing) — always randomized order
- **Multiple Choice Quiz** — show card front, pick correct answer from 4 options. 3 distractors pulled randomly from other cards in the same deck. Minimum deck size: 4 cards.
- **Type-the-Answer** — show card front, user types answer, fuzzy-match against the back. Show correct answer after submission. Use normalized string comparison (lowercase, trim, collapse whitespace) with a similarity threshold.
- **Match Mode** — show 6-8 front/back pairs scattered in a grid, user taps to match. No timer for v1. Good for vocabulary and definitions.

All modes track correct/incorrect the same way and feed into the existing study_sessions table. Mode is stored on the session record.

**Key decision:** Card order is ALWAYS randomized across all modes. Users should never be able to memorize card position — that's fake learning.

### 3. Dashboard Search and Sort

Add to the dashboard deck grid:
- **Search bar** — filter decks by title (client-side for speed, deck list is already loaded)
- **Sort dropdown** — options: Newest (default), Oldest, A-Z, Most Cards, Last Studied
- **Last studied** — join against `study_sessions` to get most recent `completed_at` per deck. No new column; avoids a migration and keeps study_sessions as the source of truth. Acceptable performance since the deck list is already loaded client-side.

Keep it simple: no folders, no tags, no filters by origin. Just search + sort. Covers 90% of the organization need.

### 4. Forced Card Randomization

Currently the `card_order` preference allows "shuffle" or "sequential". Remove the sequential option entirely. Cards are ALWAYS shuffled when a study session starts.

**Why:** Sequential order lets users memorize position instead of content. This is a well-known learning science anti-pattern. The preference should not exist.

This means:
- Remove `card_order` from preferences validation/UI
- Always shuffle cards client-side when loading a study session
- Simplify the preferences section (one fewer option)

### 5. Generation Preview Before Save

After AI generates cards, show a preview/review screen instead of saving immediately:

- Display all generated cards in an editable list
- Each card shows front/back with inline edit capability
- Delete button on each card to remove unwanted cards
- "Save Deck" button to commit the final set
- "Regenerate" button to try again
- Card count display ("12 cards generated")

This replaces the current flow where generated cards go straight to DeckView. The preview screen sits between generation and save.

**Architecture note:** The current `POST /api/generate` creates the deck + cards in a single server-side transaction and returns the saved result. Preview requires splitting this into two steps: (1) AI generates cards and returns them to the client without saving, (2) client shows preview, user edits/deletes, then a separate request saves the final set. This means refactoring the generate endpoint to return unsaved cards, and adding a new save endpoint (or reusing `POST /api/decks`). The generation count should only increment on save, not on generate.

**Not included:** Difficulty level selector or card count target. The AI prompt stays as-is. Preview alone is the highest-impact change — users can curate the output.

### 6. Study Streaks and Daily Goal

Track consecutive days the user has completed at least one study session:

- **Streak counter** — displayed on Dashboard, shows current streak (days) and longest streak
- **Daily goal** — configurable target (e.g., 20 cards/day), stored in preferences JSONB
- **Streak tracking** — new columns or table: `current_streak`, `longest_streak`, `last_study_date`
- **Visual indicator** — flame/fire icon on Dashboard with streak count, turns gold at milestones (7, 30, 100 days)
- **Streak-at-risk nudge** — if user hasn't studied today, show a gentle banner on Dashboard ("Keep your streak alive!"). Always shown when no session today, regardless of time. No timezone logic needed — just check if any session was completed with `completed_at >= start of current UTC day`.

No push notifications or emails for now (that's v2 notification delivery). Streak is passive — visible on Dashboard, motivates return visits.

---

## Why This Approach

These six features target the three biggest weaknesses of the current product:

1. **Study effectiveness** — recap screen + forced randomization + study modes make studying actually work for learning, not just card-flipping
2. **Scale** — dashboard search/sort prevents the app from becoming unusable as deck libraries grow
3. **Retention** — streaks give users a reason to come back daily, which is critical for a study app
4. **Generation quality** — preview before save puts users in control of AI output quality

We deliberately excluded:
- Card reordering (cards should always be random)
- Deck folders/tags (search + sort is sufficient for v1)
- Difficulty levels / card count targets (preview is the bigger win)
- Re-study-missed-only mode (just show recap, user can restart)
- Weak card tracking (good idea but complex, better for v2)

---

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Card order | Always randomized | Prevents position memorization, backed by learning science |
| Study modes | Flip + MC + Type + Match | Variety reduces study fatigue, all feed same tracking |
| Recap screen | Show missed cards, no re-study button | Keep it simple, user can start new session manually |
| Dashboard organization | Search + sort only (no folders) | Covers 90% of need, avoids complexity |
| Generation customization | Preview only (no difficulty/count) | Highest impact, lets users curate AI output |
| Streaks | Dashboard-only, no notifications | Passive motivation, email reminders are v2 |
| MC distractors | Pull from same deck | Keeps distractors contextually relevant, min 4 cards |
| Type-the-answer matching | Normalized fuzzy match | Lowercase, trim, collapse whitespace, similarity threshold |
| Generation preview arch | Split into generate + save | Generate returns unsaved cards; save is a separate request. Generation count increments on save only. |
| Streak day boundary | UTC | Avoids timezone preference complexity; acceptable tradeoff for v1 |
| Match mode timer | No timer for v1 | Keep it simple; timer adds pressure without clear learning benefit |
| Last studied sort | Join study_sessions, no new column | Avoids migration; deck list already loaded client-side |

---

## Open Questions

1. **Match mode minimum cards** — Should match mode require 6 or 8 cards minimum? 6 is more accessible, 8 gives better gameplay.
2. **Type-the-answer similarity threshold** — What percentage similarity is "close enough"? 80%? 90%? Should there be a "close" state vs just right/wrong?
3. **Study mode per session or per deck** — Should the mode choice persist per-deck or be selected each time?

---

## Implementation Priority

Recommended build order (each can be a separate PR):

1. **Forced card randomization** — Smallest change, remove sequential option, always shuffle
2. **Dashboard search + sort** — Client-side, no backend changes needed
3. **Session recap screen** — Enhances existing results, moderate frontend work
4. **Generation preview** — New screen between generate and save
5. **Study modes** — Largest feature, needs DB column for mode, new UI components per mode
6. **Study streaks** — New DB columns/table, dashboard widget, preferences integration

---

## Related Documents

- `docs/brainstorms/2026-03-13-deck-rating-and-results-screen-brainstorm.md` — Results screen patterns
- `docs/brainstorms/2026-03-14-account-settings-experience-brainstorm.md` — Preferences JSONB design
- `docs/brainstorms/2026-03-13-photo-upload-ai-vision-brainstorm.md` — Generation flow patterns
- `prd.json` — Full v1/v2 feature inventory
