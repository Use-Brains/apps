---
title: "V1 Feature Gaps: Study Modes, Recap, Preview, Search, Streaks, Randomization"
type: feat
date: 2026-03-14
deepened: 2026-03-14
---

# V1 Feature Gaps

Six features to round out v1 before moving to v2: forced card randomization, dashboard search+sort, session recap screen, generation preview before save, three new study modes, and study streaks with daily goal.

## Enhancement Summary

**Deepened on:** 2026-03-14
**Reviewed on:** 2026-03-14
**Agents used:** Performance Oracle, Security Sentinel, Architecture Strategist, Data Integrity Guardian, Frontend Races Reviewer, Code Simplicity Reviewer, Best Practices Researcher

### Key Improvements

1. **Use Fisher-Yates shuffle** — Current `sort(() => Math.random() - 0.5)` produces biased distributions; replace with proper algorithm
2. **Decompose Study.jsx** — Split into orchestrator + per-mode components (FlipMode, MultipleChoiceMode, TypeAnswerMode, MatchMode, SessionRecap) to avoid a 500+ line file
3. **Atomic streak + study_score in one UPDATE** — Combine the existing `study_score = study_score + 1` with the streak CASE logic in a single SQL statement
4. **Multi-row INSERT for card saves** — Single INSERT with multiple VALUES (1 round-trip vs N) on the new save endpoint
5. **Covering index for last_studied_at** — `(user_id, deck_id, completed_at DESC) WHERE completed_at IS NOT NULL` prevents seq scan
6. **State machines for async UI** — Explicit states (IDLE/PREVIEWING/SAVING for generate, IDLE/FIRST_SELECTED/EVALUATING for match) prevent impossible transitions
7. **Security hardening** — Rate limiter on save endpoint, max-length validation on card content, HTML stripping, requireXHR on study routes

### Simplification Recommendations (Noted, Not Applied)

The Code Simplicity Reviewer recommended deferring Match mode and dropping daily goal. These are noted but **not adopted** — the user explicitly selected all three study modes and study streaks + daily goal during brainstorming. The recommendations are preserved below each relevant phase for future reference.

---

## Overview

The app's core loop (generate → study → improve) works but lacks depth. Study sessions offer only one mode and no post-session review. The dashboard doesn't scale as deck count grows. Generated cards are saved immediately with no curation step. There's no engagement hook to bring users back daily. These six features address study effectiveness, organization, generation quality, and retention.

**Brainstorm:** `docs/brainstorms/2026-03-14-v1-feature-gaps-brainstorm.md`

## Resolved Open Questions

Decisions made from SpecFlow analysis:

| Question | Decision | Rationale |
|----------|----------|-----------|
| Match mode min cards | 6 cards | More accessible, works with smaller decks |
| Match mode batching | 6 random pairs per session | Provides variety on replay; total_cards = 6 for scoring |
| Type-the-answer algorithm | Levenshtein, 85% threshold | Higher threshold prevents false positives on short answers (e.g., DNA vs RNA = 67%, correctly rejected) |
| Type-the-answer "close" state | Binary right/wrong; "Close!" text if 70-85% | Keeps scoring simple but gives learning feedback |
| Study mode persistence | Per-session selection, no persistence | Simplest for v1; user picks each time |
| Generation preview rate limiting | Count consumed at preview time | Prevents unlimited AI calls; user "spends" a generation on preview even if they discard |
| Save endpoint | New `POST /api/decks/save` | Distinct from listing creation; accepts title + cards[] + source_text |
| Streak vs daily goal | Independent — any session maintains streak; daily goal is progress bar only | Missing goal doesn't break streak |
| Study Again from recap | Restarts in same mode | Reduces friction for repeated study |
| Recap data persistence | Ephemeral, client-side only | No server storage of per-card results for v1 |
| Stale card_order values | Leave in JSONB, remove from validation | Harmless dead data; no data migration needed |
| Dashboard "Last Studied" | Modify `GET /api/decks` with subquery | Minor backend change, not purely client-side |
| Recap + rating flow | Rating prompt triggers from recap's "Continue" button | Preserves existing purchased-deck rating flow |

---

## Technical Approach

### Database Migration: `009_study_modes_and_streaks.sql`

```sql
-- Study mode tracking (split ADD COLUMN from CHECK for minimal lock duration)
ALTER TABLE study_sessions
  ADD COLUMN mode TEXT NOT NULL DEFAULT 'flip';

ALTER TABLE study_sessions
  ADD CONSTRAINT chk_study_session_mode
  CHECK (mode IN ('flip', 'multiple_choice', 'type_answer', 'match')) NOT VALID;

ALTER TABLE study_sessions
  VALIDATE CONSTRAINT chk_study_session_mode;

-- Streak tracking on users
ALTER TABLE users
  ADD COLUMN current_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN longest_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN last_study_date DATE;

-- Covering index for last_studied_at subquery (Dashboard sort)
CREATE INDEX IF NOT EXISTS idx_study_sessions_last_studied
  ON study_sessions (user_id, deck_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;
```

**Why split CHECK from ADD COLUMN:** An inline `CHECK` on `ADD COLUMN` acquires ACCESS EXCLUSIVE lock while it scans all existing rows. Splitting into `NOT VALID` (adds constraint without scanning — fast, same lock) + `VALIDATE` (scans with SHARE UPDATE EXCLUSIVE — reads/writes allowed) reduces lock scope in separate transactions. **Caveat:** The migrator (`migrator.js`) wraps the entire SQL file in a single transaction, so the lock-splitting benefit is not realized at this scale — the ACCESS EXCLUSIVE lock from `ADD COLUMN` is held until COMMIT. At v1 data volumes this is fine (milliseconds). For future large-table migrations, split into separate migration files (009a/009b) to get independent transactions.

**Idempotency:** `IF NOT EXISTS` on the index. `ADD COLUMN` is not idempotent but the migrations table prevents re-runs.

### API Changes

| Change | Endpoint | Details |
|--------|----------|---------|
| New | `POST /api/generate/preview` | AI generation only, returns `{ cards: [{front, back}] }`. Consumes generation count. Uses existing middleware chain. |
| New | `POST /api/decks/save` | Save deck from preview. Accepts `{ title, source_text, cards: [{front, back}] }`. Checks deck count limits. Does NOT consume generation count. Max 30 cards, min 1. |
| Modify | `POST /api/study` | Accept `mode` in body. Validate mode. Enforce min deck size per mode (MC: 4, Match: 6). Store on session. |
| Modify | `PATCH /api/study/:id` | After existing logic, update streak atomically (see SQL below). |
| Modify | `GET /api/decks` | Add `last_studied_at` via subquery on study_sessions. |
| Modify | `GET /api/study/stats` | Return `current_streak`, `longest_streak`, `daily_goal` from users table + preferences. |
| Modify | `PATCH /api/settings/preferences` | Add `daily_goal` to validatePreferences (integer, 5-100). |
| Remove | `validatePreferences` | Remove `card_order` from allowlist. |

#### API Security (incorporated into implementation details above)

- Rate limiter on save endpoint: 20/hr, keyed by `req.userId` (not IP — shared IPs punish multiple users, per-user is more accurate since these endpoints require auth)
- Max-length validation on card content: front 2000, back 5000, source_text 50,000 — **also applied to existing `POST /:id/cards` and `PATCH /:deckId/cards/:cardId`** (pre-existing gap)
- HTML stripping: use `striptags` library (not regex — regex is bypassable) on **all card-write paths** including AI parse output. React's JSX escaping provides defense-in-depth, but never store HTML in card fields.
- `requireXHR` on study routes: prevents CSRF via form submission
- Explicit UTC in streak SQL: `(NOW() AT TIME ZONE 'UTC')::date` (resolved in CTE above)
- Explicit server-side mode allowlist with `ALLOWED_MODES.includes(mode)` + default to `'flip'`

### Atomic Streak + Study Score Update SQL

Combines the existing `study_score = study_score + 1` with streak logic in a single UPDATE — one round-trip instead of two. Uses a CTE to compute the new streak value once (avoids duplicated CASE that could drift during maintenance). Uses explicit UTC to avoid timezone config surprises:

```sql
WITH new_streak AS (
  SELECT CASE
    WHEN last_study_date = (NOW() AT TIME ZONE 'UTC')::date THEN current_streak
    WHEN last_study_date = (NOW() AT TIME ZONE 'UTC')::date - 1 THEN current_streak + 1
    ELSE 1
  END AS val
  FROM users WHERE id = $1
)
UPDATE users SET
  study_score = study_score + 1,
  current_streak = (SELECT val FROM new_streak),
  longest_streak = GREATEST(longest_streak, (SELECT val FROM new_streak)),
  last_study_date = GREATEST(last_study_date, (NOW() AT TIME ZONE 'UTC')::date)
WHERE id = $1
RETURNING current_streak, longest_streak, study_score
```

**Why CTE:** The original version duplicated the CASE expression in both `current_streak` and `longest_streak`. If someone changes one without the other, streaks break silently. The CTE computes the value once.

**Why `(NOW() AT TIME ZONE 'UTC')::date`:** Bare `CURRENT_DATE` uses the PostgreSQL session timezone. Supabase defaults to UTC, but being explicit prevents surprises if the config changes. The `::date` cast is needed because `AT TIME ZONE` returns a timestamp, not a date.

**Atomicity:** PostgreSQL SET clauses read pre-update values within the same statement. The CTE also reads pre-update values. This is safe without explicit locking because a single statement is atomic.

**Why GREATEST on `last_study_date`:** Prevents a cross-midnight race where two concurrent sessions (one at 23:59:59, one at 00:00:01) commit in reverse order, causing `last_study_date` to regress backward from day N+1 to day N. `GREATEST` ensures the date can only advance, regardless of commit ordering.

### Generation Preview Architecture

Current flow:
```
Generate.jsx → POST /api/generate → AI + save in transaction → navigate to DeckView
```

New flow:
```
Generate.jsx → POST /api/generate/preview → AI only → Preview screen (edit/delete cards)
                                                       → POST /api/decks/save → navigate to DeckView
                                                       → "Regenerate" → POST /api/generate/preview again
```

The existing `POST /api/generate` endpoint is refactored into two:
1. **`/api/generate/preview`** — Same middleware chain (rate limit, CSRF, auth, trial check, generation limits), calls AI service, returns unsaved cards. Generation count increments here.
2. **`/api/decks/save`** — Auth + CSRF + deck limit check + rate limiter (20/hr). Accepts `{ title, source_text, cards }`. Inserts deck + cards in transaction. No generation count change.

**Deck count check (inlined):** The save endpoint needs to check the user's deck count against their tier limit, but does NOT need to check generation count. Inline the ~12-line deck-count check from `checkGenerationLimits` (lines 82-94 of plan.js) directly in the save handler. Single consumer — no need to extract a separate middleware.

**Multi-row INSERT for cards:** When saving, build a single INSERT with multiple VALUES instead of inserting cards in a loop. One round-trip vs 30:
```sql
INSERT INTO cards (deck_id, front, back, position)
VALUES ($1, $2, $3, $4), ($1, $5, $6, $7), ...
```

**Kill old endpoint:** Remove `POST /api/generate` entirely once the client is migrated to the preview flow. Don't maintain two code paths.

Photo-based generation: The preview endpoint handles multipart uploads the same way. If user clicks "Regenerate," the client re-sends the photos (File objects stay in browser memory). The original `input`, `title`, and `files` are held in Generate.jsx state.

---

## Implementation Phases

### Phase 1: Forced Card Randomization + Preferences Cleanup

**Scope:** Remove dead `card_order` preference. Smallest change, can ship immediately.

**Files:**
- [x] `client/src/pages/Settings.jsx` — Remove "Card Order" radio buttons (lines ~389-404) and `card_order` from default preferences state (line ~149)
- [x] `server/src/routes/settings.js` — Remove `card_order` block from `validatePreferences()` (lines 115-118)

**No migration needed.** Study.jsx already shuffles unconditionally (line 40) and again in `handleStudyAgain` (line 129). Both locations use the biased `sort(() => Math.random() - 0.5)` — replace both with Fisher-Yates. Existing `card_order` values in JSONB are harmless — they'll be ignored.

#### Research Insight: Fisher-Yates Shuffle

If Study.jsx currently uses `cards.sort(() => Math.random() - 0.5)`, replace with Fisher-Yates. The sort-based approach produces biased distributions (some orderings are more likely than others):
```js
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
```
Place this `shuffle()` helper in **`client/src/lib/shuffle.js`** (follows the project's `lib/` convention for shared utilities — same pattern as `api.js`, `imageResize.js`). Import from Study.jsx, MultipleChoiceMode.jsx, and MatchMode.jsx for: shuffling cards at session start, shuffling MC option positions, and shuffling match tiles.

### Phase 2: Dashboard Search + Sort

**Scope:** Search bar + sort dropdown for the deck grid. Minor backend change for "Last Studied" data.

**Backend:**
- [x] `server/src/routes/decks.js` — Modify `GET /api/decks` query to include `last_studied_at` via LEFT JOIN subquery (not LATERAL — single scan vs N lookups):
  ```sql
  LEFT JOIN (
    SELECT deck_id, MAX(completed_at) AS last_studied_at
    FROM study_sessions
    WHERE user_id = $1 AND completed_at IS NOT NULL
    GROUP BY deck_id
  ) ls ON ls.deck_id = d.id
  ```
  **Performance:** This does one scan of study_sessions filtered by user_id, versus LATERAL which executes a subquery per deck. The covering index `idx_study_sessions_last_studied` from the migration makes this fast.

**Frontend:**
- [x] `client/src/pages/Dashboard.jsx` — Add between header (line ~307) and deck grid (line ~310):
  - Search input filtering `decks` by title (case-insensitive `includes()`), debounced at 150ms to prevent jank on mobile during fast typing
  - Sort dropdown: Newest, Oldest, A-Z, Most Cards, Last Studied
  - Use `useMemo` to derive filtered+sorted deck list (depends on `[decks, debouncedSearchQuery, sortOption]`)
  - Empty search results state ("No decks match your search")
  - Hide search/sort controls when user has 0 decks

### Phase 3: Session Recap Screen

**Scope:** Enhance the existing results phase in Study.jsx to show missed cards with correct answers.

**Frontend only (no backend changes):**
- [x] `client/src/pages/Study.jsx` — Extend the results phase (lines ~173-252):
  - Compute missed cards: `cards.filter((_, i) => results[i] === 'missed')`
  - Below existing stats grid, add "Missed Cards" section showing front + back for each missed card
  - If 0 missed cards, show congratulatory "Perfect score!" message instead
  - "Study Again" button calls existing reshuffle + restart logic
  - "Continue" / "Back to Dashboard" preserves existing rating flow for purchased decks
  - Recap is ephemeral — data is in client state only, not persisted

### Phase 4: Generation Preview Before Save

**Scope:** Split generation endpoint, add preview screen with edit/delete capability.

**Backend:**
- [x] `npm install striptags` — Add HTML stripping dependency (used in save endpoint and all card-write paths)
- [x] `server/src/routes/generate.js` — Refactor into two endpoints:
  - `POST /api/generate/preview` — Existing middleware chain (rate limit, CSRF, auth, trial, generation limits). Calls AI service. Returns `{ cards: [{front, back}], generationsRemaining }`. Increments generation count but does NOT create deck/cards in DB.
  - Remove existing `POST /api/generate` entirely — client and server deploy together, no backward compatibility period needed.
- [x] `server/src/routes/decks.js` — Add `POST /api/decks/save`:
  - Middleware chain (order matters): `requireXHR`, `authenticate`, `checkTrialExpiry`, `saveLimiter(20/hr, keyed by req.userId)`, then handler
  - Accepts: `{ title, source_text, cards: [{front, back}] }`
  - Validates: title length (max 200), cards array (min 1, max 30), front/back non-empty, front max 2000 chars, back max 5000 chars, source_text max 50000 chars
  - Strip HTML from card front/back before save (use `striptags` library, not regex)
  - Inline deck count limit check (~12 lines from `checkGenerationLimits` — single consumer, no need to extract middleware). **Import `PLAN_LIMITS` from `plan.js`** (add a named export) to access `PLAN_LIMITS[req.userPlan].maxDecks`. `req.userPlan` is set by `checkTrialExpiry` which runs earlier in the middleware chain.
  - Transaction: INSERT deck with `origin = 'generated'` + multi-row INSERT cards with position, using `RETURNING *` on both to avoid follow-up SELECT queries
  - Returns saved deck with cards (from RETURNING clause — no extra round-trip)

**Frontend:**
- [x] `client/src/pages/Generate.jsx` — Change flow:
  - On submit, call `api.generatePreview(input, title)` or `api.generatePreviewWithPhotos(input, title, files)`
  - On success, set `previewCards` state (stay on Generate page, show preview section)
  - Hold `input`, `title`, `files` in state for "Regenerate"
- [x] `client/src/pages/Generate.jsx` — Add preview section (renders when `previewCards` is set):
  - Editable card list (reuse DeckView.jsx card edit pattern — inline textareas for front/back)
  - Delete button per card
  - Card count display
  - "Save Deck" button → calls `api.saveDeck(title, source_text, previewCards)` → navigate to DeckView
  - "Regenerate" button → calls preview endpoint again with same input
  - "Save Deck" disabled if 0 cards remain
- [x] `client/src/lib/api.js` — Add:
  - `generatePreview: (input, title) => request('/generate/preview', ...)`
  - `generatePreviewWithPhotos: (input, title, files) => ...` (multipart)
  - `saveDeck: (title, sourceText, cards) => request('/decks/save', ...)`

#### Preview Frontend Race Conditions

**Ref guard on save:** Prevent double-submit with a synchronous ref check before the async save call:
```js
const savingRef = useRef(false);
const handleSave = async () => {
  if (savingRef.current) return;
  savingRef.current = true;
  try {
    const data = await api.saveDeck(...);
    setPreviewCards(null); // unblock beforeunload BEFORE navigating
    navigate(`/decks/${data.deck.id}`);
  } finally { savingRef.current = false; }
};
```

**AbortController per-request (not per-mount):** The controller must be scoped to each generation call, not to the component lifecycle. This is critical for Regenerate — clicking Regenerate must abort the previous in-flight generation to prevent the old response from overwriting edited cards:
```js
const controllerRef = useRef(null);

const handleGenerate = async () => {
  controllerRef.current?.abort(); // Cancel any in-flight generation
  const controller = new AbortController();
  controllerRef.current = controller;
  setLoading(true);
  try {
    const data = await api.generatePreview(input, title, { signal: controller.signal });
    if (controller.signal.aborted) return;
    setPreviewCards(data.cards);
  } catch (err) {
    if (err.name === 'AbortError') return;
    toast.error(err.message);
  } finally {
    // Only clear loading if THIS request is still the latest one.
    // Without this check, an aborted request's finally block clobbers
    // the new request's setLoading(true), removing the spinner.
    if (controllerRef.current === controller) setLoading(false);
  }
};

// Unmount cleanup
useEffect(() => () => controllerRef.current?.abort(), []);
```

**Prerequisite — make `api.js` `request()` signal forwarding explicit:**
The current `request()` already forwards `signal` accidentally via `...restOptions`, but this should be made explicit with a single-pass destructuring to prevent subtle bugs if the function is refactored:
```js
async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const { headers: optHeaders, signal, ...restOptions } = options; // single-pass destructure
  const res = await fetch(`${BASE}${path}`, {
    headers: isFormData
      ? { 'X-Requested-With': 'XMLHttpRequest', ...optHeaders }
      : { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...optHeaders },
    credentials: 'include',
    signal, // Explicit — not relying on restOptions spread
    ...restOptions,
  });
  // ...
}
```
Without explicit `signal` forwarding, the AbortController pattern works by accident and could silently break on refactor.

**Navigate-away confirmation — `beforeunload` only for v1:**
Add a `beforeunload` listener while `previewCards` is non-null (handles browser navigation, tab close, refresh):
```js
useEffect(() => {
  if (!previewCards || previewCards.length === 0) return;
  const handler = (e) => { e.preventDefault(); };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [previewCards]);
```
**Why not `useBlocker`:** In react-router v7, `useBlocker` does NOT auto-show a browser dialog — it returns a `blocker` object requiring custom confirmation UI (`blocker.state === 'blocked'` → render confirm/cancel). This adds component complexity for an edge case (user clicking an in-app link while staring at preview cards). If data loss reports emerge from in-app navigation, add `useBlocker` with a custom dialog in a follow-up.

**Clear preview state before post-save navigation:** After a successful save, `setPreviewCards(null)` MUST precede `navigate()`. Otherwise the `beforeunload` listener fires on the happy path (harmless but sloppy) and any future `useBlocker` addition would block the post-save redirect.

#### Simplification Note

The Code Simplicity Reviewer recommends removing the old `POST /api/generate` endpoint immediately rather than maintaining backward compatibility. Since the client and server are deployed together, there is no need for a deprecation period.

### Phase 5: Study Modes (MC, Type, Match)

**Scope:** Add mode selection and three new study modes. Largest feature.

**Backend:**
- [x] `server/src/db/migrations/009_study_modes_and_streaks.sql` — Add `mode` column to study_sessions, streak columns to users (migration covers both Phase 5 and Phase 6)
- [x] `server/src/routes/study.js` — Add `requireXHR` middleware to `POST /api/study` and `PATCH /api/study/:id`
- [x] `server/src/routes/study.js` — Modify `POST /api/study`:
  - Accept `mode` in body with explicit server-side allowlist (don't rely on DB CHECK alone):
    ```js
    const ALLOWED_MODES = ['flip', 'multiple_choice', 'type_answer', 'match'];
    const mode = req.body.mode || 'flip'; // Default for backward compat
    if (!ALLOWED_MODES.includes(mode)) {
      return res.status(400).json({ error: 'Invalid study mode' });
    }
    ```
  - Combine deck ownership check + card count into one query (saves a round-trip):
    ```sql
    SELECT COUNT(c.id)::int AS card_count
    FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
    WHERE d.id = $1 AND d.user_id = $2
    GROUP BY d.id
    ```
  - Enforce min deck size per mode: **Flip requires 1 card** (pre-existing bug: currently creates session with `total_cards = 0` for empty decks), MC requires 4 cards, Match requires 6 cards
  - For Match mode: hardcode `total_cards = 6` in the INSERT (not from card count query). Add comment explaining why.
  - Store mode on session record
- [x] `server/src/routes/study.js` — Modify `PATCH /api/study/:id`:
  - Add `Number.isInteger()` validation on `correct` and `totalCards` before the existing range check (pre-existing gap: string `"5"` passes `"5" < 0` due to JS coercion)
  - No other change to completion logic — correct/totalCards works the same regardless of mode

**Frontend — Mode Selection:**
- [x] `client/src/pages/Study.jsx` — Add new phase `'mode-select'` before `'studying'`:
  - **Move session creation from mount effect to mode-select handler.** Currently `api.startSession` fires on mount — with mode-select added, the session should only be created after the user picks a mode. The mount effect should only fetch deck data.
  - Show 4 mode cards: Flip Cards, Multiple Choice, Type the Answer, Match
  - Each card shows mode name, brief description, and icon
  - Disable MC if deck < 4 cards, Match if deck < 6 cards (check `deckData.cards.length`)
  - On mode select: call `api.startSession(deckId, mode)`, transition to `'studying'` phase
  - Store selected `mode` in state for recap "Study Again" button

**Frontend — Multiple Choice Mode:**
- [x] `client/src/components/study/MultipleChoiceMode.jsx` — Extracted component:
  - Show card front as the question
  - Generate 4 options: correct answer (current card's `back`) + 3 random distractors (other cards' `back` values from same deck, deduplicated — skip cards with identical `back` text)
  - Shuffle option positions with Fisher-Yates each time
  - On option click: highlight correct/incorrect, advance after 1s delay
  - **Click guard during 1s delay:** Use `advancingRef` — ignore all clicks (and keyboard input) while highlight is active. Without this, a second click during reveal causes double-result/double-advance:
    ```js
    const advancingRef = useRef(false);
    const advanceTimeoutRef = useRef(null);
    const handleOptionClick = (i) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      // ... highlight, call onRate ...
      advanceTimeoutRef.current = setTimeout(() => {
        advancingRef.current = false;
        // advance to next card
      }, 1000);
    };
    useEffect(() => () => clearTimeout(advanceTimeoutRef.current), []);
    ```
  - Keyboard: 1-4 number keys to select options (must also check `advancingRef`)
  - Calls `onRate('correct'|'missed')` callback
  - Truncate long answers in options (max ~100 chars with ellipsis)

**Frontend — Type-the-Answer Mode:**
- [x] `client/src/components/study/TypeAnswerMode.jsx` — Extracted component (if >80 lines with Levenshtein helper, otherwise inline in Study.jsx):
  - Show card front
  - Text input field with "Type your answer" placeholder, auto-focused via ref
  - Two-phase state: `ANSWERING` → (Enter) → `SHOWING_RESULT` → (Enter or 1.5s timeout) → advance
  - On first Enter (ANSWERING): compare using normalized Levenshtein
  - Show result: green check + "Correct!" (>=85%) or red X + correct answer (<70%), or "Close!" (70-85%)
  - **Input lockout:** After entering SHOWING_RESULT, impose a 200ms lockout before accepting the "skip" keypress. Prevents fast Enter-Enter from submitting answer AND immediately skipping the result display.
  - On second Enter (SHOWING_RESULT, after lockout) or 1.5s timeout: advance to next card
  - Clear and re-focus input on advance (guard: `if (inputRef.current)`)
  - Cleanup: `clearTimeout` on unmount
  - Calls `onRate('correct'|'missed')` callback

  **Levenshtein helper** (client-side, ~25 lines, two-row optimization for O(min(m,n)) space):
  ```js
  function similarity(a, b) {
    const normalize = s => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const s1 = normalize(a), s2 = normalize(b);
    if (s1 === s2) return 1;
    // Max-length guard: Levenshtein is O(m*n), which causes UI stutter on mobile
    // for long strings. Card backs can be up to 5000 chars — fall back to exact match.
    if (s1.length > 500 || s2.length > 500) return s1 === s2 ? 1 : 0;
    // Early exit: if length ratio > 5:1, similarity will be very low
    if (Math.max(s1.length, s2.length) > 5 * Math.min(s1.length, s2.length)) return 0;
    const len = Math.max(s1.length, s2.length);
    if (len === 0) return 1;
    // Two-row Levenshtein (only keeps previous row, not full matrix)
    // Return 1 - (distance / len)
  }
  ```
  **Thresholds (resolved):** 0.85 for correct, 0.70 for "close". Higher correct threshold prevents false positives on short answers where one character is meaningful (e.g., "DNA" vs "RNA" = 0.67, correctly rejected).

**Frontend — Match Mode:**
- [x] `client/src/components/study/MatchMode.jsx` — Extracted component (complex tile state warrants its own file):
  - Select 6 random cards from shuffled deck
  - Create 12 tiles: 6 fronts + 6 backs, shuffled with Fisher-Yates
  - Tile states: default, selected, matched, incorrect
  - On tile tap: select first tile, then second. If front matches back → matched (green, CSS transition for fade). If not → incorrect flash (red, deselect after 0.5s)
  - **Evaluation lock:** Use `evaluatingRef` + cancelable timeout. During EVALUATING (0.5s incorrect flash), ignore all taps. Cleanup: `clearTimeout(evalTimeoutRef.current)` on unmount.
  - Track correct matches (first attempt) vs incorrect attempts locally
  - Session completes when all 6 pairs matched
  - total_cards = 6 (server-authoritative — server sets this on session start based on mode, not client)
  - correct = number matched on first attempt
  - **Separate recording from completion:** `onRate` should be synchronous (push to results array in orchestrator). Session completion API call happens only after all 6 pairs resolved, triggered by the orchestrator when results.length === 6. Do NOT call async `api.completeSession` during rapid pair matching.

#### Architecture: Decompose Study.jsx (3-4 files, not 7)

Extract only components with nontrivial independent state. FlipMode (~70 lines), ModeSelect (~40 lines), and SessionRecap (~100 lines) stay inline in Study.jsx — they are too small for their own files:

```
client/src/pages/Study.jsx                        ← Orchestrator + FlipMode inline + ModeSelect inline + SessionRecap inline
client/src/components/study/MultipleChoiceMode.jsx ← Distractor generation, option shuffling, keyboard nav, reveal delay
client/src/components/study/MatchMode.jsx          ← 12-tile grid, pair state machine, evaluation lock
client/src/components/study/TypeAnswerMode.jsx     ← Only if >80 lines (Levenshtein + two-phase input), otherwise inline
```

**Callback contract (orchestrator ↔ mode):**
- Orchestrator provides: `card` (current card), `allCards` (for MC distractors), `onRate(result)` callback
- `onRate('correct'|'missed')` is **synchronous** — it records the result and returns. The orchestrator decides when to advance to the next card (or complete the session).
- **Use a ref for results accumulation** to avoid stale closures. A `useCallback` with `[results]` in its deps would capture a stale `results` array if called twice before React re-renders (e.g., MC keyboard mashing). The ref-based approach makes `onRate` truly stable:
  ```js
  const resultsRef = useRef([]);
  const handleRate = useCallback((rating) => {
    if (!['correct', 'missed'].includes(rating)) return; // guard against invalid strings
    resultsRef.current = [...resultsRef.current, rating];
    setResults(resultsRef.current); // trigger re-render
    if (resultsRef.current.length === totalCards) {
      // complete session — only from orchestrator
      api.completeSession(sessionId, resultsRef.current.filter(r => r === 'correct').length, totalCards);
    }
  }, []); // stable — no deps on results state
  ```
- Each mode component manages its own feedback timing (1s MC delay, 1.5s Type delay, 0.5s Match flash). After feedback completes, the mode calls a second callback `onAdvance()` to tell the orchestrator to show the next card.
- Session completion (`api.completeSession`) is called only by the orchestrator when `resultsRef.current.length === totalCards`, never by mode components.
- `onRate` and `onAdvance` are stable via `useCallback(fn, [])` (no deps — uses refs internally). Pass `allCards` as a stable reference (useMemo or useRef).

#### Match Mode State Machine

Prevent race conditions from rapid tile taps:
```
IDLE → (tap tile) → FIRST_SELECTED → (tap second tile) → EVALUATING → (after delay) → IDLE
                                    ↘ (tap same tile) → IDLE (deselect)
```
During EVALUATING, ignore all taps. Use a ref (`evaluatingRef`) checked synchronously before any state update. The 0.5s incorrect flash timeout must be cancelable on unmount.

#### Simplification Note

The Code Simplicity Reviewer recommends deferring Match mode to v2 (it's the most complex mode with the least learning benefit) and using exact normalized string matching instead of Levenshtein for type-the-answer. These are noted but not adopted per user decisions during brainstorming. If implementation timeline pressure emerges, Match mode is the first candidate to cut.

### Phase 6: Study Streaks + Daily Goal

**Scope:** Streak tracking, dashboard widget, daily goal preference.

**Backend (migration already in Phase 5):**
- [x] `server/src/routes/study.js` — In `PATCH /api/study/:id`, replace the separate `UPDATE users SET study_score = study_score + 1` with the combined streak+score CTE-based UPDATE (see Atomic Streak SQL above)
- [x] `server/src/routes/account.js` — **PII scrub:** Add streak columns AND pre-existing behavioral columns to account deletion UPDATE:
  ```sql
  current_streak = 0, longest_streak = 0, last_study_date = NULL,
  study_score = 0, daily_generation_count = 0, last_generation_date = NULL
  ```
  (`study_score` and generation fields are a pre-existing gap — they should have been zeroed already)
  **Also delete behavioral data from related tables** (soft-delete doesn't trigger CASCADE):
  ```sql
  DELETE FROM deck_stats WHERE user_id = $1;
  DELETE FROM study_sessions WHERE user_id = $1;
  ```
  These contain temporal usage patterns (`completed_at`, `best_accuracy`, `times_completed`, `mode`) tied to the user_id. Deleting them is safer than relying on anonymization-by-association (scrubbed email → `deleted-{id}`).
- [x] `server/src/routes/study.js` — Modify `GET /api/study/stats`:
  - **Two separate queries** (simpler than joining — avoids complicating the existing aggregate):
    1. Existing aggregate query on `study_sessions` (unchanged)
    2. New query: `SELECT current_streak, longest_streak, preferences->'daily_goal' AS daily_goal FROM users WHERE id = $1`
  - Also count sessions completed today for daily progress: `SELECT COUNT(*)::int FROM study_sessions WHERE user_id = $1 AND completed_at >= (NOW() AT TIME ZONE 'UTC')::date`
  - Merge results into response: `{ stats: { ...existing, current_streak, longest_streak, daily_goal, sessions_today } }`
- [x] `server/src/routes/settings.js` — Add `daily_goal` to `validatePreferences()`:
  ```js
  if ('daily_goal' in input) {
    const goal = input.daily_goal;
    if (!Number.isInteger(goal) || goal < 5 || goal > 100) return null;
    clean.daily_goal = goal;
  }
  ```

**Frontend:**
- [x] `client/src/pages/Dashboard.jsx` — Add streak widget to stats grid:
  - Flame icon with current streak count
  - "day streak" / "days streak" label
  - Gold color when streak >= 7
  - Longest streak shown as secondary text
  - Daily progress bar: "X / Y cards today" (Y = daily_goal from preferences, default 20)
- [x] `client/src/pages/Dashboard.jsx` — Add streak-at-risk banner:
  - Show above deck grid when no session completed today
  - "Keep your streak alive! Study now to maintain your X-day streak."
  - Dismiss-able (session state, not persisted)
  - Don't show if current_streak is 0
- [x] `client/src/pages/Settings.jsx` — Add daily goal input to Study Preferences section:
  - Number input or select: 5, 10, 15, 20, 25, 50, 100
  - Auto-save via existing debounce + serialize pattern
- [x] `client/src/lib/api.js` — No new methods needed; existing `getStats()` and `updatePreferences()` cover it

#### Streak Backend: Combined UPDATE

The streak update merges with the existing `study_score` increment (see Atomic Streak + Study Score SQL above). In `PATCH /api/study/:id`, replace the current separate `UPDATE users SET study_score = study_score + 1` with the combined statement. This reduces round-trips and keeps both updates atomic within the same transaction.

#### Streak Frontend: bfcache Awareness

If a user studies, presses back, then navigates forward, the browser may serve the page from bfcache with stale streak data. Add a `pageshow` listener to refetch stats:
```js
useEffect(() => {
  const handler = (e) => { if (e.persisted) refetchStats(); };
  window.addEventListener('pageshow', handler);
  return () => window.removeEventListener('pageshow', handler);
}, []);
```

#### Simplification Note

The Code Simplicity Reviewer recommends dropping daily goal (keep just the streak counter) and the streak-at-risk banner. If the goal is minimum viable motivation, the streak number alone may suffice. Daily goal adds a preference, a progress bar, and settings UI for a feature that may not drive behavior. Noted for possible scope reduction if needed.

---

## Acceptance Criteria

### Functional Requirements

- [ ] Cards are always shuffled in all study modes — no sequential option exists
- [ ] Dashboard search filters decks by title (case-insensitive)
- [ ] Dashboard sort supports: Newest, Oldest, A-Z, Most Cards, Last Studied
- [ ] Session recap shows all missed cards with front + back
- [ ] Perfect score shows congratulatory message instead of missed cards list
- [ ] Rating prompt still appears for purchased decks after recap
- [ ] Generation preview shows editable card list before saving
- [ ] Users can edit front/back, delete individual cards, and regenerate on preview
- [ ] Save is disabled when 0 cards remain in preview
- [ ] Generation count consumed at preview time, not save time
- [ ] Multiple Choice shows 4 options with 3 distractors from same deck
- [ ] MC requires minimum 4 cards in deck (mode disabled otherwise)
- [ ] Type-the-Answer uses Levenshtein with 85% correct / 70% close thresholds
- [ ] Match Mode uses 6 random pairs per session
- [ ] Match requires minimum 6 cards in deck (mode disabled otherwise)
- [ ] All modes feed the same correct/incorrect tracking
- [ ] Study mode stored on session record in DB
- [ ] Streak increments on first completed session of the day (UTC)
- [ ] Streak resets to 1 if user misses a day
- [ ] Longest streak always preserved
- [ ] Daily goal configurable in settings (5-100 cards)
- [ ] Streak widget visible on dashboard with flame icon
- [ ] "Streak at risk" banner shown when streak > 0 and no session today

### Non-Functional Requirements

- [ ] Dashboard search/sort is client-side — no API call on filter/sort change
- [ ] Preview screen handles photo regeneration (files stay in browser memory)
- [ ] Streak update is atomic SQL — no race condition on concurrent completions
- [ ] Match mode tile interactions have clear visual feedback (color flash on correct/incorrect)
- [ ] All new UI follows existing design system (parchment palette, study dark theme)

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `server/src/db/migrations/009_study_modes_and_streaks.sql` | New: mode column + NOT VALID CHECK on study_sessions, streak columns on users, covering index |
| `server/src/routes/generate.js` | Refactor: split into preview endpoint, remove old generate endpoint |
| `server/src/routes/decks.js` | Add: `POST /api/decks/save` (with rate limiter, validation, HTML strip, inline deck limit), modify: `GET /api/decks` with last_studied_at. **Also fix pre-existing gaps:** add `requireXHR` to all 5 existing mutation endpoints (`PATCH /:id`, `DELETE /:id`, `POST /:id/cards`, `PATCH /:deckId/cards/:cardId`, `DELETE /:deckId/cards/:cardId`), add max-length validation to existing `POST /:id/cards`, `PATCH /:deckId/cards/:cardId`, and title length on `PATCH /:id` |
| `server/src/routes/study.js` | Modify: add `requireXHR`, accept mode with explicit allowlist on start, combined streak+score UPDATE on complete, streak data in stats |
| `server/src/routes/settings.js` | Modify: remove card_order, add daily_goal to validatePreferences |
| `server/src/routes/account.js` | **Fix PII scrub:** add `current_streak`, `longest_streak`, `last_study_date`, `study_score`, `daily_generation_count`, `last_generation_date` to deletion UPDATE. **Delete `deck_stats` and `study_sessions` rows** for the user (soft-delete doesn't trigger CASCADE). |
| `server/src/middleware/plan.js` | **Export `PLAN_LIMITS`** (named export for save endpoint deck count check) |
| `client/src/lib/shuffle.js` | New: Fisher-Yates shuffle utility (shared by Study.jsx, MultipleChoiceMode, MatchMode) |
| `client/src/pages/Study.jsx` | Major: orchestrator + FlipMode/ModeSelect/SessionRecap inline, mode selection phase, move session creation to mode-select handler |
| `client/src/components/study/MultipleChoiceMode.jsx` | New: distractor generation, option shuffling, advancingRef guard, keyboard handling |
| `client/src/components/study/MatchMode.jsx` | New: 12-tile grid, pair state machine, evaluatingRef lock, cancelable timeouts |
| `client/src/components/study/TypeAnswerMode.jsx` | New (if >80 lines): Levenshtein helper, two-phase input state, input lockout |
| `client/src/pages/Dashboard.jsx` | Add: debounced search bar, sort dropdown, streak widget, streak-at-risk banner |
| `client/src/pages/Generate.jsx` | Refactor: per-request AbortController (with identity check in finally), beforeunload listener, preview state, editable card list, regenerate flow |
| `client/src/pages/Settings.jsx` | Remove: card order radios. Add: daily goal input |
| `client/src/lib/api.js` | Add: generatePreview, generatePreviewWithPhotos, saveDeck, update startSession signature to `(deckId, mode)` → `JSON.stringify({ deckId, mode })`. **Fix:** make `signal` forwarding explicit in `request()` via single-pass destructuring |

---

## Cross-Cutting Research Insights

### Performance Checklist

- [ ] Fisher-Yates shuffle replaces `sort(() => Math.random() - 0.5)` everywhere
- [ ] Covering index `idx_study_sessions_last_studied` created in migration
- [ ] `GET /api/decks` uses plain LEFT JOIN subquery (not LATERAL) for last_studied_at
- [ ] Streak + study_score in single UPDATE statement
- [ ] Multi-row INSERT for card saves on `POST /api/decks/save` with `RETURNING *` (no follow-up SELECT)
- [ ] `useMemo` for dashboard search/sort derived state

### Security Checklist

- [ ] Rate limiter on `POST /api/decks/save` (20/hr, **keyed by `req.userId`** not IP)
- [ ] Save middleware chain ordered: `requireXHR` → `authenticate` → `checkTrialExpiry` → `saveLimiter(keyed by req.userId)` → handler
- [ ] Max-length validation on card front (2000), back (5000), source_text (50,000)
- [ ] **Max-length validation on existing `POST /:id/cards` and `PATCH /:deckId/cards/:cardId`** (pre-existing gap)
- [ ] **Title max-length (200) on existing `PATCH /:id` deck rename** (pre-existing gap)
- [ ] HTML stripped from card front/back on **all card-write paths** (save, add card, update card, AI parse)
- [ ] `requireXHR` middleware on `POST /api/study` and `PATCH /api/study/:id`
- [ ] **`requireXHR` on all 5 existing mutation endpoints in `decks.js`** (pre-existing CSRF gap)
- [ ] **`Number.isInteger()` validation on `correct` and `totalCards`** in `PATCH /api/study/:id` (pre-existing type coercion gap)
- [ ] **DELETE `deck_stats` and `study_sessions` rows** for user during account deletion (soft-delete doesn't trigger CASCADE)
- [ ] **Explicit server-side mode allowlist** on `POST /api/study` with default to `'flip'`
- [ ] Streak columns + `study_score` + generation fields included in account deletion PII scrub
- [ ] **Streak SQL uses `(NOW() AT TIME ZONE 'UTC')::date`** not bare `CURRENT_DATE`
- [ ] **Match mode `total_cards` hardcoded to 6** in session creation INSERT
- [ ] **Saved decks set `origin = 'generated'`** in save endpoint INSERT

### Frontend Robustness Checklist

- [ ] Ref guards on all async submit handlers (save, regenerate, session complete)
- [ ] **AbortController per-request** (ref-based, not per-mount) — Regenerate aborts previous generation
- [ ] **AbortController `finally` uses identity check** (`controllerRef.current === controller`) to prevent loading state clobber on abort
- [ ] **`api.js` `request()` forwards `signal` parameter** to `fetch()` (already works via `...restOptions` spread, but make explicit with single-pass destructuring: `const { headers: optHeaders, signal, ...restOptions } = options`)
- [ ] `beforeunload` listener on preview page (browser navigation / tab close) — `useBlocker` deferred to post-v1
- [ ] **Preview state cleared (`setPreviewCards(null)`) before `navigate()`** after successful save
- [ ] **MC mode `advancingRef`** prevents clicks/keyboard during 1s highlight delay
- [ ] **Type-the-answer 200ms input lockout** after submit prevents Enter-Enter skip
- [ ] Match mode evaluation lock (`evaluatingRef`) prevents double-tap race condition
- [ ] Cancelable timeouts on all delayed transitions (clearTimeout on unmount)
- [ ] **Session creation moved from mount effect to mode-select handler**
- [ ] **`onRate` is synchronous via ref-based results accumulation** — `resultsRef.current` avoids stale closures; `useCallback(fn, [])` with no deps; session completion only from orchestrator when `resultsRef.current.length === totalCards`
- [ ] **`onRate` validates input** — guard `['correct', 'missed'].includes(rating)` prevents silent garbage from mode components

---

## References

- **Brainstorm:** `docs/brainstorms/2026-03-14-v1-feature-gaps-brainstorm.md`
- **Account settings patterns:** `docs/solutions/feature-patterns/account-settings-experience.md` — JSONB validation, deep merge, debounce auto-save
- **Current study flow:** `client/src/pages/Study.jsx` (phase-based rendering, results tracking)
- **Current generation flow:** `server/src/routes/generate.js` (transaction pattern, middleware chain)
- **Deck listing query:** `server/src/routes/decks.js` (current SELECT with card_count)
- **Preferences validation:** `server/src/routes/settings.js:111` (validatePreferences allowlist)
- **Auth context:** `client/src/lib/AuthContext.jsx` (user data propagation pattern)
