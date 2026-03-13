# Feature Brief: Journal Time-Based Views Refactor

## Metadata
- Date: 2026-03-10
- Owner: kashane
- Risk Lane: B
- Target platform for feature QA: iOS

## Problem
The Journal screen only supports a single list presentation and does not provide first-class navigation by day/week/month/year. Users cannot quickly change temporal context and review performance/trades by period.

## User Outcome
Users can switch the Journal between Daily, Weekly, Monthly, and Yearly views, scroll periods horizontally, and see both summary stats and chronological trade details for the selected period.

## Scope In
- Add top-level Journal view switcher for `Daily`, `Weekly`, `Monthly`, `Yearly`.
- Add second-row horizontal period scroller that changes options based on selected view:
  - Daily: days
  - Weekly: numbered weeks
  - Monthly: months
  - Yearly: years
- Drive Journal trade queries and stats queries from selected period date range.
- Show period summary stats and period trade list with ascending chronological order.

## Scope Out
- New backend endpoints or schema changes.
- Pagination/infinite loading redesign.
- Custom week-start locale preferences.
- Replacing trade card visual design beyond layout needs for this feature.

## Impacted Files
- `app/(tabs)/journal/index.tsx`
- `src/utils/journal-periods.ts`
- `src/components/JournalViewTabs.tsx`
- `src/components/JournalPeriodScroller.tsx`
- `__tests__/unit/journal-periods.test.ts`

## Data/Schema/Auth Impact
- Schema changes: no
- Auth/security changes: no
- PnL/business logic changes: no

## Gate Plan
- Required lane gates:
  - [x] Feature brief complete
  - [ ] Unit tests
  - [x] Integration tests
  - [ ] Maestro smoke flow (Lane C)
  - [ ] Manual smoke/sanity
  - [ ] Rollback steps (Lane C)
  - [ ] Human sign-off (Lane C)

## Test Plan
### Unit
- Verify period key/range generation for daily/weekly/monthly/yearly behavior.
- Verify period option lists include selected period for each view.

### Integration
- Run existing integration suite to detect regressions in trade query filtering.

### Smoke E2E
- N/A for Lane B.

### Manual Acceptance
- Confirm tab switching updates period scroller mode correctly.
- Confirm selecting day/week/month/year updates stats and trades for that period.
- Confirm trades are displayed in ascending `entry_date` order.
- Confirm empty state appears when selected period has no trades.

## Rollback Plan
Revert the Journal time-views refactor commit to restore previous Journal layout and filtering behavior.

## Known Risks
- Week numbering is ISO-based (Monday start), which may differ from user expectation in some locales.
- Range boundaries are computed locally and converted to ISO timestamps, so timezone edge cases near midnight can surface if trade timestamps are near period cutoffs.

## Deferred Work
- Persist selected view/period across app restarts.
- Add explicit previous/next controls in addition to horizontal scrolling.
- Add automated UI tests for tab and period selection interactions.

## Final Behavior Deltas (Update After Implementation)
- Added four Journal modes (Daily, Weekly, Monthly, Yearly).
- Added horizontal, mode-aware period scroller and period header label.
- Switched stats/trades queries to selected period date range filters.
- Updated trade rendering to chronological ascending order.
- Removed in-body import/filter controls from Journal header stack in favor of the new 4-component structure.
- Added unit coverage for journal period generation utilities.
