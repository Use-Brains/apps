---
status: pending
priority: p1
issue_id: "020"
tags: [code-review, plan-review, security, consistency, phase-6]
dependencies: []
---

# Phase 6: Token Revocation Missing `- INTERVAL '1 second'` Offset and Split Into 2 Queries

## Problem Statement

The existing password change at `account.js:122` uses a single atomic query: `UPDATE users SET password_hash = $1, token_revoked_at = NOW() - INTERVAL '1 second' WHERE id = $2`. The plan splits this into two separate UPDATE queries and uses `NOW()` without the 1-second offset. This creates two problems:

1. **Race window**: Between the two queries, the password is updated but tokens are not yet revoked. A concurrent request with the old token could authenticate successfully against the new password hash.
2. **Fresh JWT invalidation**: Using exact `NOW()` as the revocation timestamp means a JWT issued at the same second (e.g., the fresh token returned in the same response) would have `iat` equal to `token_revoked_at`, failing the `iat > token_revoked_at` check and immediately invalidating the user's new session.

## Findings

- **Pattern Recognition** (MEDIUM x2): Identified both the split-query issue and the missing interval offset as separate findings that compound
- **Architecture Strategist** (LOW): Noted deviation from established single-query pattern

## Proposed Solutions

### Option A: Single atomic query with 1-second offset (Recommended)

Match the existing pattern exactly:

```sql
UPDATE users SET password_hash = $1, token_revoked_at = NOW() - INTERVAL '1 second' WHERE id = $2
```

- **Effort**: Small — fix the plan's SQL, single query instead of two
- **Risk**: None — this is the battle-tested existing pattern

### Option B: Transaction wrapping the two queries

Wrap both UPDATEs in a transaction and add the interval offset.

- **Effort**: Medium — more code for no benefit
- **Risk**: Unnecessary complexity over Option A

## Acceptance Criteria

- [ ] Password change uses a single UPDATE query setting both `password_hash` and `token_revoked_at`
- [ ] `token_revoked_at` uses `NOW() - INTERVAL '1 second'` offset
- [ ] Fresh JWT issued after password change is not immediately invalidated
- [ ] No race window exists between password update and token revocation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Plan rewrites must preserve atomic query patterns — splitting queries introduces race conditions |
