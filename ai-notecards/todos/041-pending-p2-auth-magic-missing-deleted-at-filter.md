---
status: pending
priority: p2
issue_id: "041"
tags: [code-review, security, auth, pre-existing-bug]
dependencies: []
---

# Pre-existing Bug: auth-magic.js Missing deleted_at IS NULL Filter

## Problem Statement

`auth-magic.js:115` queries `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1` without a `deleted_at IS NULL` filter. A soft-deleted user can log in via magic link, bypassing account deletion. This is a pre-existing bug, not introduced by the pre-launch blockers plan.

## Findings

- **Security Sentinel (Round 2):** MEDIUM — soft-deleted users can authenticate

## Proposed Solutions

### Option A: Add deleted_at filter (Recommended)
```diff
- `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1`
+ `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1 AND deleted_at IS NULL`
```
**Pros:** Simple one-line fix, matches pattern used in other queries
**Cons:** None
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] `auth-magic.js` user lookup includes `deleted_at IS NULL`
- [ ] Soft-deleted users cannot log in via magic link
