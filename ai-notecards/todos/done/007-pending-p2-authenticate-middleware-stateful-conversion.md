---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, performance, architecture, security]
dependencies: ["001"]
---

# Authenticate Middleware: Stateless to Stateful Conversion

## Problem Statement

The current `authenticate` middleware does zero database lookups — it only verifies the JWT. The plan adds `SELECT * FROM users` on every authenticated request to check `deleted_at` and `token_revoked_at`. This adds a DB round-trip to every API call, competing with the 12-connection pool.

## Findings

- **Performance Oracle** (#3): CRITICAL — do not add DB query to every request
- **Data Integrity Guardian** (#3): CRITICAL — uses `SELECT *` which is wasteful
- **Architecture Strategist** (#3.2): Correct but incomplete — acknowledged as fundamental change
- **Security Sentinel** (C1): Necessary but deployment order matters

## Proposed Solutions

### Option A: Selective DB check — only in `/me` and sensitive operations (Recommended)

Keep `authenticate` stateless for most requests. Add a `requireActiveUser` middleware that does the DB check, applied only to:
- `GET /api/auth/me` (already queries the user)
- `PATCH /api/settings/password`
- `DELETE /api/settings/account`
- `GET /api/settings/export`

- **Pros**: No performance regression for regular API calls, targeted protection
- **Cons**: Deleted users can briefly access non-sensitive endpoints until their cookie expires
- **Effort**: Small
- **Risk**: Low — deleted user viewing their own decks briefly is acceptable

### Option B: DB check on every request but select only 2 columns

```sql
SELECT deleted_at, token_revoked_at FROM users WHERE id = $1
```

- **Pros**: Complete coverage
- **Cons**: DB query on every authenticated request
- **Effort**: Small
- **Risk**: Medium — pool pressure at scale

## Acceptance Criteria

- [ ] Deleted users cannot access sensitive endpoints
- [ ] Password-changed users with old tokens are rejected on sensitive endpoints
- [ ] Regular API calls (decks, study, marketplace) have no added latency

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Performance vs security tradeoff |
