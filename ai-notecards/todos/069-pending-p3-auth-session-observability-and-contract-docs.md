---
status: pending
priority: p3
issue_id: "069"
tags: [code-review, auth, documentation, observability, mobile]
dependencies: []
---

# Document native auth session contract and observability

Add lightweight documentation and observability guidance for the new iOS auth session model so future auth changes do not drift silently.

## Problem Statement

The step 2 auth plan now defines a dual-mode auth contract: web keeps cookie sessions while native iOS uses `X-Client-Platform: ios-native` plus `{ accessToken, refreshToken, user }` responses. The plan also distinguishes provider cancellations, offline refresh failures, and authoritative refresh rejections. These decisions are now in the plan, but there is no dedicated follow-up item to document the final contract and define the minimum observability signals once implementation lands.

Without that follow-up, future auth work can accidentally break:
- native/web response branching
- refresh rotation error handling
- provider cancellation analytics/noise boundaries
- debugging of session-loss incidents in production

## Findings

- Second technical review of `docs/plans/2026-03-15-feat-ios-auth-and-apple-sign-in-plan.md` found the implementation plan is strong enough to proceed, but the final auth contract and monitoring expectations should be captured after implementation.
- The plan now introduces several non-obvious decisions: explicit native header signaling, crash-safe token persistence, read-only offline fallback on network refresh failures, and biometric-gated identity rendering.
- These are not large enough to block implementation, but they are exactly the kind of rules that drift if not documented after the code lands.

## Proposed Solutions

### Option 1: Update app docs only

**Approach:** After implementing step 2, update `mobile/CLAUDE.md` and any adjacent auth docs with the native session contract and expected flows.

**Pros:**
- Fastest path
- Keeps documentation close to the code

**Cons:**
- No explicit observability checklist
- Easier to miss production-debugging needs

**Effort:** 30-45 minutes

**Risk:** Low

---

### Option 2: Add docs + observability checklist

**Approach:** Document the native auth contract in `mobile/CLAUDE.md` and add a short checklist covering refresh failures, provider cancellations, session revocations, and biometric gate behavior.

**Pros:**
- Best balance of effort and long-term clarity
- Helps future debugging and review passes
- Makes regressions easier to detect

**Cons:**
- Slightly more work than docs-only

**Effort:** 45-75 minutes

**Risk:** Low

---

### Option 3: Create a dedicated auth runbook

**Approach:** Add a separate auth runbook covering response contracts, token lifecycle, edge cases, and operational debugging steps.

**Pros:**
- Most comprehensive
- Best for long-term operational maturity

**Cons:**
- More overhead than the current stage likely needs
- Could be overkill before the auth flow stabilizes

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

**Affected files:**
- `apps/ai-notecards/docs/plans/2026-03-15-feat-ios-auth-and-apple-sign-in-plan.md`
- `apps/ai-notecards/mobile/CLAUDE.md`
- Potential future docs if a runbook is created

**Related components:**
- Mobile auth provider
- Server auth routes
- Refresh-token lifecycle
- Biometric gate behavior

**Database changes:**
- None required for this follow-up

## Resources

- **Plan:** `apps/ai-notecards/docs/plans/2026-03-15-feat-ios-auth-and-apple-sign-in-plan.md`
- **Brainstorm:** `apps/ai-notecards/docs/brainstorms/2026-03-15-ios-auth-and-apple-sign-in-brainstorm.md`
- **Related solution:** `apps/ai-notecards/docs/solutions/auth-implementation-guide.md`

## Acceptance Criteria

- [ ] Final native auth response contract is documented in the appropriate project doc
- [ ] Refresh-token lifecycle and failure modes are documented
- [ ] Provider cancellation vs real auth failure behavior is documented
- [ ] Minimum observability signals/checks are documented for future debugging
- [ ] Documentation is updated after implementation reflects the final code, not just the plan

## Work Log

### 2026-03-15 - Second Technical Review Follow-up

**By:** Codex

**Actions:**
- Performed a second technical review of the step 2 iOS auth plan
- Found no new blocking P1 findings
- Folded new P2 findings directly into the plan
- Created this P3 todo for post-implementation contract and observability documentation

**Learnings:**
- The highest-risk auth decisions are now explicit in the plan
- The remaining gap is long-term clarity and debugging readiness, not implementation correctness

## Notes

- This is intentionally P3 because it should not block implementation of step 2.
- Prefer Option 2 unless the auth implementation grows materially more complex during execution.
