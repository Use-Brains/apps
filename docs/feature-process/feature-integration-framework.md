# Trade-Journal Feature Integration Framework

## Purpose
This framework makes feature delivery consistent, low-regression, and fast enough for a solo developer.

## Operating Model
- Process rigor: pragmatic guardrails.
- AI autonomy: AI builds and tests; human signs off before release.
- Test depth: unit + integration + smoke E2E.
- Intake: one-page feature brief required before coding.
- QA scope: primary platform per feature; weekly cross-platform check.
- Tradeoff rule: quality and regression safety over speed.

## Feature Intake Contract
Every feature starts as:
- `docs/feature-briefs/YYYY-MM-DD-<feature>.md`

A brief is required before implementation.

## Risk Lanes
### Lane A (Low Risk)
- UI copy/layout updates only.
- No schema, data-flow, or business logic changes.

Required gates:
- Feature brief completed.
- Manual sanity check completed.
- Targeted unit test only if logic is touched.

### Lane B (Medium Risk)
- Hook/query/form/state changes.
- No database migration.

Required gates:
- Feature brief completed.
- Unit tests pass.
- Integration tests pass.
- Manual smoke check completed.

### Lane C (High Risk)
- Schema/auth/storage/PnL logic/critical journal flow changes.

Required gates:
- Feature brief completed.
- Unit tests pass.
- Integration tests pass.
- Maestro smoke flow executed.
- Rollback steps documented.
- Human sign-off recorded.

## Automatic Lane Escalation
A feature is automatically Lane C if it touches:
- `supabase/migrations/**`
- `src/lib/supabase.ts`
- `src/hooks/use-auth.ts`
- `src/hooks/use-images.ts`
- `src/utils/pnl.ts`
- `src/types/trades.ts`

## Definition Of Done
All features must satisfy:
- Required lane gates passed.
- Feature brief updated with final behavior deltas.
- Known risks and deferred work documented.
- Human acceptance check completed.

## AI vs Human Responsibilities
### AI-owned
- Draft feature brief from prompt and codebase context.
- Implement and refactor code.
- Add/update unit and integration tests.
- Run local verification commands.
- Run Maestro smoke flows and report output.

### Human-owned
- Final UX/product acceptance.
- Financial correctness sign-off for PnL behavior.
- Release decision and migration approval.

## Local Commands
- `npm run verify:baseline`
- `npm run verify:lane:a`
- `npm run verify:lane:b`
- `npm run verify:lane:c`

## CI Enforcement (Phase 2)
CI enforces lane contracts for pull requests:
- PR body must include feature brief reference and risk lane.
- Lane B/C PRs must pass automated checks (`verify:lane:b`).
- Lane C PRs must include smoke evidence, rollback plan, and human sign-off fields.

## Success Criteria (6 Weeks)
- Regression rate from new features trends down.
- Throughput does not materially degrade.
- 100% of merged features include brief + lane + gate evidence.
- Quality-first rule is followed when tradeoffs occur.
