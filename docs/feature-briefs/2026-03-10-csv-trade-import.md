# Feature Brief: CSV Trade Import v1

## Metadata
- Date: 2026-03-10
- Owner: kashane
- Risk Lane: B
- Target platform for feature QA: iOS

## Problem
Users currently must enter trades manually one by one. This is slow for users migrating from broker exports or spreadsheet journals.

## User Outcome
Users can import CSV trade data quickly with deterministic mapping, review potential duplicates, and safely merge data with minimal manual work.

## Scope In
- CSV file picking from Journal and Settings entry points.
- Header detection with headerless fallback.
- Deterministic column matching and manual mapping.
- Row normalization and schema-compatible validation.
- Duplicate conflict review with import/skip/replace.
- Batched writes and import result reporting.

## Scope Out
- Schema migrations.
- AI-assisted mapping in runtime path.
- Broker-specific custom parser modules.
- Background server-side import jobs.

## Impacted Files
- `app/(tabs)/journal/import.tsx`
- `app/(tabs)/journal/_layout.tsx`
- `app/(tabs)/journal/index.tsx`
- `app/(tabs)/settings.tsx`
- `src/hooks/use-trade-import.ts`
- `src/features/import/*`
- `src/components/import/*`

## Data/Schema/Auth Impact
- Schema changes: no
- Auth/security changes: no
- PnL/business logic changes: no

## Gate Plan
- Required lane gates:
  - [x] Feature brief complete
  - [ ] Unit tests
  - [ ] Integration tests
  - [ ] Maestro smoke flow (Lane C)
  - [ ] Manual smoke/sanity
  - [ ] Rollback steps (Lane C)
  - [ ] Human sign-off (Lane C)

## Test Plan
### Unit
- Header detection with/without headers.
- Matcher scoring and mapping thresholds.
- Date parser timezone handling.
- Row normalization defaults and validation.
- Duplicate identity key generation.

### Integration
- CSV pipeline from parse -> map -> normalize -> preview conflicts.
- Executor conflict resolution outcomes and batch error handling.

### Smoke E2E
- N/A for Lane B.

### Manual Acceptance
- Import from Journal and Settings.
- Headerless CSV manual mapping flow.
- Duplicate review with import/skip/replace.
- Result summary correctness.

## Rollback Plan
Revert the import feature commit and remove import entry points from Journal and Settings.

## Known Risks
- Very large CSV files may still produce long preview times on low-memory devices.
- Timezone parsing for ambiguous date strings may differ from some broker-specific assumptions.

## Deferred Work
- Paid AI mapping fallback for low-confidence imports.
- Downloadable error report export.

## Final Behavior Deltas (Update After Implementation)
- Added deterministic CSV import flow with manual mapping fallback, duplicate conflict review, and batch persistence.
