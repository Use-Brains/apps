# Feature Brief: Feature Integration Framework Rollout

## Metadata
- Date: 2026-03-10
- Owner: codex
- Risk Lane: B
- Target platform for feature QA: iOS

## Problem
Feature additions were ad hoc and lacked a consistent integration contract for testing, risk classification, and release readiness.

## User Outcome
New features are integrated with predictable quality gates and lower regression risk.

## Scope In
- Process docs and templates for feature intake and release checks.
- Lane-based verification scripts.
- CI contract checks for Lane B/C PRs.
- Integration test scaffolding and smoke flow scaffolding.

## Scope Out
- Full E2E suite beyond smoke coverage.
- Production branch protection configuration in GitHub settings.
- Automated device farm execution for Maestro.

## Impacted Files
- `docs/feature-process/feature-integration-framework.md`
- `docs/feature-briefs/_template.md`
- `docs/feature-process/release-checklist.md`
- `scripts/verify-lane.mjs`
- `scripts/validate-pr-body.mjs`
- `.github/workflows/feature-integration-gates.yml`
- `.github/pull_request_template.md`

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
- Trade form schema validation tests.

### Integration
- Query filter operation tests.
- Trade payload mapping/derived metric tests.

### Smoke E2E
- Scaffolded Maestro lane-C smoke flow sequence.

### Manual Acceptance
- Review docs, scripts, and CI contract alignment.

## Rollback Plan
Revert the framework rollout commit to return to prior workflow.

## Known Risks
- Maestro execution still depends on local CLI/device setup.
- Network-restricted environments cannot install dependencies for verification.

## Deferred Work
- Add CI device farm execution for Maestro.
- Enforce branch protection required checks in GitHub settings.

## Final Behavior Deltas (Update After Implementation)
- Added lane-based integration framework with docs, scripts, CI checks, tests, and smoke flow scaffolding.
