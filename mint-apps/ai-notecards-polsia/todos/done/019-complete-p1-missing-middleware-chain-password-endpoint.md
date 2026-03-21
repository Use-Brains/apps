---
status: pending
priority: p1
issue_id: "019"
tags: [code-review, plan-review, security, phase-6]
dependencies: []
---

# Phase 6: Missing Middleware Chain in Password Endpoint Code

## Problem Statement

The plan's PATCH `/api/account/password` code only chains the `authenticate` middleware. The existing endpoint uses `authenticate, requireXHR, requireActiveUser, passwordLimiter`. Dropping these removes CSRF protection (`requireXHR`), soft-delete/revocation checks (`requireActiveUser`), and rate limiting (`passwordLimiter`). A password change endpoint without rate limiting is brute-forceable, and without `requireXHR` it is vulnerable to CSRF attacks.

## Findings

- **Security Sentinel** (HIGH): Flagged the missing CSRF and rate-limiting protections as a high-severity security gap
- **Pattern Recognition** (HIGH): Identified the middleware chain mismatch between plan code and existing implementation
- **Architecture Strategist** (LOW): Noted inconsistency with established middleware patterns

## Proposed Solutions

### Option A: Preserve full middleware chain (Recommended)

Update the plan's code example to include all four middleware functions in the correct order: `authenticate, requireXHR, requireActiveUser, passwordLimiter`.

- **Effort**: Small — one-line fix in the plan, then match during implementation
- **Risk**: None

### Option B: Document which middleware to keep

If the plan is meant to show only new code, add a comment or note that the existing middleware chain must be preserved.

- **Effort**: Small
- **Risk**: Implementer might still miss it if skimming

## Acceptance Criteria

- [ ] Plan code example for PATCH `/api/account/password` includes `authenticate, requireXHR, requireActiveUser, passwordLimiter`
- [ ] Implementation preserves all four middleware in the correct order
- [ ] Manual test confirms rate limiting is active on the password endpoint
- [ ] Manual test confirms non-XHR requests are rejected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Plan code examples must preserve existing middleware chains, not just show new logic |
