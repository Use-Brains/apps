---
status: pending
priority: p2
issue_id: "029"
tags: [code-review, plan-review, simplicity, scope]
dependencies: []
---

# Scope Question: Should Sentry (Phase 4) and Email Verification (Phase 5) Be Deferred?

## Problem Statement

Two full phases of the pre-launch plan may be premature for an app with zero users at launch:

**Phase 4 (Sentry):** Adds 2 dependencies, ~25KB bundle size, requires a Sentry account, 3 env vars, and client + server integration. At launch with zero users, `console.error` plus server logs are sufficient for error tracking. Sentry becomes valuable at scale but adds complexity and cost from day one.

**Phase 5 (Email Verification):** All current users are already verified (small test group). The email verification middleware would never trigger for existing users. The 2-line `USER_SELECT` change to include `email_verified` is fine, but the full middleware + banner implementation is YAGNI (You Aren't Gonna Need It) until there is a meaningful volume of unverified signups.

## Findings

- **Code Simplicity Reviewer** (HIGH x2): Flagged both phases as unnecessary pre-launch complexity, recommending deferral to post-launch when real usage data can justify the investment

## Proposed Solutions

### Option A: Defer both to post-launch (Recommended)

- Skip Phase 4 (Sentry) entirely. Keep `console.error` for now. Add Sentry when there are enough users to warrant it.
- For Phase 5, keep only the `USER_SELECT` addition (`email_verified` field). Defer the middleware and banner to post-launch.
- This removes ~2 phases of work from the pre-launch plan.

- **Effort**: Negative — reduces total effort
- **Risk**: Low — both features are additive and can be bolted on later without refactoring

### Option B: Trim but keep

- Phase 4: Add Sentry to server only (skip client ErrorBoundary integration). Server errors are more critical at launch.
- Phase 5: Add the field to USER_SELECT only. No middleware or banner.

- **Effort**: Small — much less than full phases
- **Risk**: None

### Option C: Keep as-is

Implement both phases fully as planned.

- **Effort**: As estimated in plan
- **Risk**: Over-engineering for launch, delayed ship date

## Acceptance Criteria

- [ ] Decision documented: keep, trim, or defer each phase
- [ ] If deferred, phases are moved to a post-launch backlog with trigger conditions (e.g., "Add Sentry when DAU > 100")
- [ ] If trimmed, the reduced scope is clearly specified
- [ ] Pre-launch timeline is updated to reflect the decision

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Pre-launch plans should be scrutinized for YAGNI — features with zero current users may not justify their complexity |
