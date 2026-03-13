# Feature Brief: Strategies Tab + Strategy-Aware Trade Entry

## Metadata
- Date: 2026-03-10
- Owner: kashane
- Risk Lane: C
- Target platform for feature QA: iOS

---

## Problem

Traders execute the same setups repeatedly but have no structured place to define, document, or review those setups. The current "Setup Tags" field on the trade entry screen accepts free-text with no persistence, no descriptions, and no linkage to outcomes. This makes strategy-level analysis impossible today and prevents AI-driven strategy performance review in the future.

---

## User Outcome

1. A user can define named trading strategies with rich metadata (description, entry/exit rules, expected win rate, R:R, active date range, color/emoji label, etc.).
2. When logging a trade, the user picks one or more strategies from their own list — favorites surface first, ordered by the user's custom rank.
3. If a user types a new strategy name at trade entry, they're prompted to save it as a placeholder for later editing, with a "Full details →" path to the complete create flow.
4. Saving a trade without any strategy triggers a motivational nudge (not a hard block) encouraging the user to tag a strategy for better AI analysis later.
5. Strategy data becomes the structured foundation for AI performance analysis (win rate by strategy, R:R realized vs expected, market condition correlation).

---

## Scope In

### New: Strategies tab

**Strategy list screen:**
- Full-screen list of user strategies, grouped: Favorites (ordered by user rank) → Active → Testing → Archived.
- Each list item shows: emoji/color label, title, status chip, computed win rate (from linked trades), and a star-with-rank-number favorite badge.
- Sort/filter bar: by Status · Win Rate · Most Recently Used. Favorited strategies always float to top regardless of sort.
- Swipe-to-archive on any list item.
- Empty state with "Create your first strategy" CTA.

**Favorite ordering flow:**
- Tap the star on any strategy to favorite/unfavorite it.
- On favorite: the star fills and shows the next available rank number (e.g. ★3).
- Immediately after favoriting, a modal sheet appears showing only the current favorites list with emoji + title. User can drag-and-drop to reorder. New favorite is pre-inserted at the bottom; user can drag it anywhere. Confirm button closes the sheet and saves the new order.
- Rank numbers update live as user drags. Stored as `favorite_order integer` on the strategy row (null = not favorited).

**Create/edit strategy flow — fields:**
- **Emoji + color label** — emoji picker + color swatch for list/dropdown identification
- **Title** (required, unique per user)
- **Status** — Active / Testing / Archived
- **Active dates** — "From:" date (prefilled to today, editable) and "To:" date (optional, blank by default). Editable at any time. Useful for strategies the user has been running since before today.
- **Description** — paragraph free-text (what the setup looks like, why it works)
- **Entry criteria** — free-text that can be toggled into a tap-to-check checklist mode before entering a trade (no additional data model needed — render the line-by-line text as checkboxes on demand)
- **Exit criteria** — profit target and stop loss rules, also toggle-able into checklist mode
- **Expected win rate** — numeric % (0–100)
- **Risk-to-reward ratio** — numeric (e.g. 2.0 = 1:2)
- **Market conditions** — multi-select chips: Trending · Choppy · High Volatility · Low Volatility · Range-bound
- **Asset classes** — multi-select chips: Crypto · Stocks · Options · Futures · Forex
- **Timeframes** — multi-select chips: 1m · 5m · 15m · 1h · 4h · Daily · Weekly
- **Notes** — additional free-text scratchpad
- **Photo uploads** — example chart screenshots (reuse existing image upload/compress pattern, new `strategy-images` storage bucket)
- **Created date** — auto-set on save (read-only, displayed below active dates)

**Computed stats panel (read-only, shown on strategy detail screen):**
- Calculated from all trades where `setup_tags` includes this strategy's title.
- Fields: Total trades · Win rate (%) · Avg realized R:R · Total P&L · Best trade P&L · Worst trade P&L.
- Updates each time the detail screen opens (no background sync needed yet).

### Updated: Trade entry screen

- Rename "Setup Tags" label → "Strategy Tags".
- **Multi-select**: user can select more than one strategy per trade. Selected strategies shown as chips.
- On focus, show a dropdown/sheet of strategy titles ordered: Favorites (by rank) → Active → Testing. Each item shows emoji label + title.
- If no strategies exist: inline banner — "No strategies yet. [Create your first strategy →]" (deep link to Strategies tab).
- If user types a name not in the list and blurs the input: "Save as strategy?" prompt modal —
  - Title: "Save '[name]' as a strategy?"
  - Body: optional brief description field + status selector (Active / Testing).
  - Actions: "Save Placeholder" / "Full details →" (navigates to full create screen with title pre-filled) / "Not now".
  - On "Save Placeholder": creates minimal strategy record, toast confirms.
- **No-strategy nudge**: if user taps the Save button with zero strategies selected, a non-blocking prompt appears:
  - Title: "No strategy tagged — are you sure?"
  - Body: "Tagging a strategy helps the AI learn what's working for you over time. Even a quick label goes a long way."
  - Actions: "Add Strategy" (dismisses the prompt, returns to form) / "Save Anyway" (proceeds with save).
- Strategy selection on a trade is stored via a new `trade_strategies` junction table (`trade_id` + `strategy_id`), not via `setup_tags`. This is the permanent, clean data model.
- `setup_tags` on trades is repurposed as a **misc tags** field — free-text labels for quick setup notes that don't warrant a full strategy entry (e.g. "gap fill", "VWAP reclaim"). The label in the UI becomes "Other Tags". Existing `setup_tags` data is preserved as-is.
- The trade entry screen shows two distinct sections: "Strategy Tags" (structured, from strategies table) and "Other Tags" (free-text misc labels).

---

## Scope Out

- AI analysis engine / strategy performance dashboard (Phase 2).
- Sharing or exporting strategies.
- Community/template strategy library.
- Backtesting integration.
- Strategy journal (date-stamped activity log per strategy) — Phase 2.
- Strategy health badge (automated warning when realized win rate drops vs expected) — Phase 2.

---

## Additional Ideas Bank (Startup Phase — No Bad Ideas)

All items below are captured for future phases. Nothing here blocks Phase 1 shipping.

### Promoted to Scope In above
- Computed stats panel on strategy detail
- Quick-add "Full details →" button from trade entry placeholder modal
- Entry/exit checklist mode (toggle free-text criteria into checkboxes)
- Sort/filter on strategy list + favorites always on top
- Strategy color/emoji label
- Favorite ordering with drag-and-drop rank modal
- Active dates field (from/to)
- Multi-select strategies per trade
- No-strategy nudge on trade save

### Deferred ideas (Phase 2+)

1. **Strategy health badge** — if realized win rate drops >10 pts below expected, show a warning badge on the strategy card. First AI nudge hook.
2. **Strategy journal** — date-stamped notes log per strategy, separate from the main notes field. Track how your view on a setup evolves over time.
3. **"Best conditions" auto-tag** — after enough trades, surface which market conditions and timeframes this strategy performs best in, compared to what the user declared.
4. **Strategy comparison view** — side-by-side stats for two strategies. Useful for deciding which setup to focus on in current market conditions.
5. **Strategy score / ranking** — a single composite score per strategy (weighted: win rate, R:R, consistency, trade count). Visible on the list card. Gives traders an at-a-glance leaderboard of their own setups.
6. **Pre-trade checklist prompt** — before saving a trade that includes an entry criteria checklist, optionally prompt "Did you verify your entry checklist?" with a quick Yes/Skip. Stores the response as metadata on the trade for AI review.
7. **Strategy "last used" recency ring** — a subtle visual indicator on the strategy card showing how recently it was used (e.g. green ring = used this week, yellow = this month, gray = inactive). Helps the user notice which strategies they're neglecting.
8. **Strategy clone** — one-tap duplicate a strategy with a new title. Useful for creating variations (e.g. "Breakout Retest v2 — tighter stop").
9. **Linked trades drill-down** — from the computed stats panel, tap "View all trades →" to see a filtered journal view of only trades tagged with this strategy. No new data model; just a filtered query.
10. **Strategy import from notes** — paste a block of plain text (e.g. from a trading journal, Notion, Google Docs) and the app parses it into the strategy fields using an on-device or Claude-backed extraction step. Great AI hook and onboarding accelerator.
11. **Market session tags** — tag strategies by the session they work best in: London, New York, Asia, Overlap. Combines with market conditions for richer AI correlation.
12. **Strategy streak tracker** — count of consecutive wins or losses with this strategy. Shown on the detail screen. Psychologically useful; also good AI signal for "is this setup breaking down right now?"
13. **Confidence × strategy heatmap** — in the stats panel, show average confidence rating (already on trade) broken down by strategy. Surfaces whether the user is more or less confident when they use a particular setup.

---

## Impacted Files

### New files
- `app/(tabs)/strategies.tsx` — Strategies tab list screen
- `app/strategy/[id].tsx` — Strategy detail/edit screen
- `app/strategy/new.tsx` — Strategy create screen
- `src/hooks/use-strategies.ts` — CRUD hooks + favorite ordering (TanStack Query)
- `src/types/strategies.ts` — Zod schema + DB types
- `src/components/StrategyPickerModal.tsx` — "Save as strategy?" prompt modal from trade entry
- `src/components/FavoriteOrderModal.tsx` — drag-and-drop favorite reorder sheet
- `src/components/NoStrategyNudge.tsx` — non-blocking save-without-strategy alert
- `supabase/migrations/00002_strategies.sql` — `strategies` + `strategy_images` + `trade_strategies` tables, RLS, indexes

### Modified files
- `app/(tabs)/_layout.tsx` — Add Strategies tab
- `src/components/TradeForm.tsx` — Rename label, multi-select strategy picker, empty state banner, blur prompt, no-strategy nudge
- `src/components/TagInput.tsx` — (if needed) expose onBlur for the prompt trigger

---

## Data / Schema / Auth Impact

- **Schema changes: YES** — new `strategies` table + `strategy_images` table + `trade_strategies` junction table (all with RLS) + new storage bucket `strategy-images`. The `trades` table itself is not structurally altered — `setup_tags` is repurposed as misc/other tags, no column rename needed yet.
- **Auth/security changes: YES** — RLS policies on all new tables; storage bucket policy for `strategy-images`.
- **PnL/business logic changes: NO**.

### Draft schema

```sql
create table public.strategies (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade not null,
  title           text not null,
  emoji           text,
  color           text,                         -- hex color string
  status          text not null default 'active'
                    check (status in ('active', 'testing', 'archived')),
  active_from     date,                         -- user-editable, prefilled to created_at date
  active_to       date,                         -- optional end date
  description     text,
  entry_criteria  text,
  exit_criteria   text,
  expected_win_rate numeric(5,2)
                    check (expected_win_rate between 0 and 100),
  risk_reward_ratio numeric(10,4),
  market_conditions text[] default '{}',
  asset_classes   text[] default '{}',
  timeframes      text[] default '{}',
  notes           text,
  favorite_order  integer,                      -- null = not favorited; 1 = top
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null,
  unique (user_id, title)
);

-- Junction table: many-to-many trades <-> strategies
-- Replaces the text-array hack; clean FK linkage from day one
create table public.trade_strategies (
  trade_id    uuid references public.trades on delete cascade not null,
  strategy_id uuid references public.strategies on delete restrict not null,
  primary key (trade_id, strategy_id)
);

alter table public.trade_strategies enable row level security;
create policy "Users can manage own trade_strategies"
  on public.trade_strategies for all
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id and t.user_id = auth.uid()
    )
  );
```

---

## Gate Plan (Lane C)

- [ ] Feature brief complete
- [ ] Unit tests — Zod schema validation, strategy helper functions, favorite ordering logic
- [ ] Integration tests — strategy CRUD hooks (mock Supabase)
- [ ] Maestro smoke flow — create strategy → log trade with strategy → verify tag appears
- [ ] Manual smoke/sanity check on iOS simulator
- [ ] Rollback steps documented (see below)
- [ ] Human sign-off recorded

---

## Test Plan

### Unit
- Zod schema validates required fields, rejects invalid win_rate/R:R values, rejects active_to before active_from
- Multi-select strategy tag logic (add, remove, dedup)
- Favorite ordering logic — reorder array, assign rank integers, handle gaps
- "Save placeholder" modal form validation
- No-strategy nudge fires when setup_tags is empty on submit

### Integration
- `useStrategies` — list, create, update, archive, reorder favorites
- `useCreateStrategyFromTag` — creates minimal record from trade entry prompt
- Strategy image upload/delete (mock storage)
- Computed stats aggregation from mock trade data

### Smoke E2E (Maestro)
- Navigate to Strategies tab → empty state shown
- Create a strategy with title "Breakout Retest" → appears in list
- Favorite it → rank badge ★1 shown → reorder modal appears
- Open Add Trade → Strategy Tags dropdown shows "Breakout Retest" at top (favorited)
- Select it → chip applied to form
- Save trade → confirm tag stored
- Navigate back to Strategies → stats panel shows 1 trade
- Save a trade with no strategy → nudge prompt appears → "Save Anyway" → trade saves

### Manual Acceptance
- [ ] Multi-select: two strategies can be selected on one trade
- [ ] Favorites always appear above non-favorites in dropdown regardless of sort
- [ ] Drag-and-drop reorder in FavoriteOrderModal updates rank numbers live
- [ ] Active dates: "From" prefills to today, "To" is blank, both editable
- [ ] Entry/exit criteria text toggles into checkboxes correctly
- [ ] "Full details →" from placeholder modal opens create screen with title pre-filled
- [ ] Archived strategies do not appear in trade entry dropdown
- [ ] Photo upload on strategy detail works (compress + upload)
- [ ] Glass theme renders strategy screens correctly
- [ ] Computed stats panel shows correct win rate / P&L from seeded trades

---

## Rollback Plan

1. Strategies tab: revert `_layout.tsx` to 3-tab config; delete `app/(tabs)/strategies.tsx` and related screens. No data loss to existing trades.
2. TradeForm changes: revert label rename, multi-select, and dropdown logic to prior free-text TagInput. `setup_tags` data is unaffected.
3. Schema: run `DROP TABLE IF EXISTS public.trade_strategies; DROP TABLE IF EXISTS public.strategy_images; DROP TABLE IF EXISTS public.strategies;` — `trade_strategies` must be dropped first due to FK dependencies.
4. Storage: delete `strategy-images` bucket (isolated from `trade-images`).

---

## Known Risks

- **Tag/strategy name drift**: user may have existing `setup_tags` values that don't match any strategy title. Handled gracefully — old free-text tags still display in trades; dropdown just won't pre-select them.
- **Drag-and-drop library**: React Native drag-and-drop for the favorite reorder modal requires a dependency (e.g. `react-native-reanimated` + `react-native-gesture-handler`, both likely already present via Expo). Verify compatibility with SDK 55 before implementation.
- **Image storage costs**: if user uploads many chart examples per strategy, storage grows. Acceptable for startup phase; compression mitigates size.
- **Dropdown UX on small screens with many strategies**: flat dropdown may feel cramped. Modal sheet picker likely preferred — evaluate during implementation.

---

## Deferred Work

- Phase 2: rename `setup_tags` column to `misc_tags` in the DB (cosmetic migration — safe to defer, data is unchanged).
- Phase 2: strategy health badge (win rate regression warning).
- Phase 2: strategy journal (date-stamped notes log per strategy).
- Phase 2: "best conditions" auto-tag from trade data.
- Phase 2: strategy comparison view.
- Phase 2: strategy score / composite ranking.
- Phase 2: pre-trade checklist prompt with response metadata on trade.
- Phase 2: strategy "last used" recency ring.
- Phase 2: strategy clone.
- Phase 2: linked trades drill-down from stats panel.
- Phase 2: strategy import from pasted notes (Claude extraction).
- Phase 2: market session tags (London / NY / Asia / Overlap).
- Phase 2: strategy streak tracker (consecutive wins/losses).
- Phase 2: confidence × strategy heatmap in stats panel.
- Phase 2: AI analysis engine + strategy performance dashboard.

---

## Final Behavior Deltas (Update After Implementation)

_To be filled in after implementation is complete._
