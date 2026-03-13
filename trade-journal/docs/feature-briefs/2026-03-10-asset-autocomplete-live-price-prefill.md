# Feature Brief: Asset Autocomplete + Live Price Prefill

## Metadata
- Date: 2026-03-10
- Owner: kashane
- Risk Lane: B
- Target platform for feature QA: iOS

## Problem
Trade entry currently requires manual symbol and price typing, which slows users down and causes avoidable input friction.

## User Outcome
Users can quickly pick symbols from curated major-market suggestions and get a live price prefilled at selection time to reduce manual entry.

## Scope In
- Finite curated asset universe across major crypto, stocks, forex, and futures symbols.
- Symbol autocomplete suggestions ranked by relevance and popularity.
- Alias normalization for common quote bases (e.g., `BTC/USDT`, `BTC/USDC` -> `BTC/USD`).
- On asset selection, fetch current market price and prefill:
  - `entry_price` for open trades.
  - `exit_price` for closed trades.
- Keep field editable after prefill.

## Scope Out
- Server-side market data proxy.
- Broker-specific or user-custom watchlist import.
- Historical candle lookup/backfill.
- Guaranteed real-time pricing SLA.

## Impacted Files
- `src/components/TradeForm.tsx`
- `src/features/assets/catalog.ts`
- `src/features/assets/quotes.ts`
- `__tests__/unit/asset-catalog.test.ts`
- `__tests__/unit/asset-quotes.test.ts`

## Data/Schema/Auth Impact
- Schema changes: no
- Auth/security changes: no
- PnL/business logic changes: no

## Gate Plan
- Required lane gates:
  - [x] Feature brief complete
  - [x] Unit tests
  - [x] Integration tests
  - [ ] Maestro smoke flow (Lane C)
  - [ ] Manual smoke/sanity
  - [ ] Rollback steps (Lane C)
  - [ ] Human sign-off (Lane C)

## Test Plan
### Unit
- Alias normalization resolves crypto base variants to canonical symbols.
- Suggestions rank exact/starts-with/popularity correctly.
- Quote parser handles valid/missing/failed responses.

### Integration
- Existing integration suite remains passing (no schema or persistence changes).

### Smoke E2E
- N/A for Lane B.

### Manual Acceptance
- Typing `BTC` surfaces `BTC/USD` at top suggestions.
- Typing `BTC/USDT` resolves to canonical `BTC/USD` after selection/blur.
- Selecting an open trade symbol pre-fills `entry_price`.
- Selecting a closed trade symbol pre-fills `exit_price`.
- User can overwrite prefilled value before save.

## Rollback Plan
Revert this feature commit to remove catalog/suggestion/price-prefill behavior and restore manual symbol+price entry.

## Known Risks
- Public quote endpoint availability/rate limits may occasionally prevent prefill.
- Prefill timing depends on network latency and may appear after symbol selection delay.

## Deferred Work
- Provider abstraction with fallback quote sources.
- Per-user recent assets and personalized ranking.
- Better offline behavior/caching for quote lookups.

## Final Behavior Deltas (Update After Implementation)
- Added curated asset catalog for major crypto, stocks, forex, futures, and options underlyings.
- Added symbol suggestions in trade entry with popularity-aware ranking and class context.
- Added canonical symbol resolution on blur/selection (including `BTC/USDT` and `BTC/USDC` -> `BTC/USD`).
- Added live quote lookup on symbol selection and prefill behavior:
  - Open trades prefill `entry_price`.
  - Closed trades prefill `exit_price`.
- Added unit coverage for catalog matching/ranking and quote parsing fallback behavior.
