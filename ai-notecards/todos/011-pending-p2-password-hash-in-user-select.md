---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, architecture, pattern-recognition]
dependencies: []
---

# `password_hash` Needed in USER_SELECT for `has_password` Derivation

## Problem Statement

The plan adds `has_password: !!user.password_hash` to `sanitizeUser`. But `password_hash` is not in `USER_SELECT` — it's only selected in the login route. Without it, `has_password` will always be `false` for `/api/auth/me` responses, hiding the password change form from all users.

## Findings

- **Architecture Strategist** (#3.1): Must-fix — `has_password` will silently be wrong
- **Pattern Recognition** (#10): Adding hash to USER_SELECT works (stripped by sanitizeUser) but violates minimum-select principle

## Proposed Solutions

### Option A: Add SQL alias to USER_SELECT (Recommended)

```sql
(password_hash IS NOT NULL) AS has_password
```

Add this expression to `USER_SELECT`. No raw hash leaves the database.

- **Pros**: Clean, no hash in app memory, no sanitizeUser derivation needed
- **Cons**: Slightly more complex SELECT
- **Effort**: Small
- **Risk**: None

### Option B: Add `password_hash` to USER_SELECT

Let `sanitizeUser` derive `has_password` from it. The hash is stripped by the allowlist.

- **Pros**: Simpler SQL
- **Cons**: Hash flows through app memory unnecessarily
- **Effort**: Small
- **Risk**: None (allowlist prevents exposure)

## Acceptance Criteria

- [ ] `has_password` is correctly `true` for users with passwords
- [ ] `has_password` is correctly `false` for Google-only users
- [ ] Raw `password_hash` never reaches the client

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | SQL alias approach is cleanest |
