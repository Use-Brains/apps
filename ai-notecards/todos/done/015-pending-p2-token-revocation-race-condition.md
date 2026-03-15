---
status: pending
priority: p2
issue_id: "015"
tags: [code-review, security]
dependencies: ["001"]
---

# Password Change: token_revoked_at Race Condition

## Problem Statement

The password change handler sets `token_revoked_at = NOW()` then immediately calls `setTokenCookie` to re-issue a JWT. If both happen in the same second, the new token's `iat` equals `token_revoked_at`, and the `>` comparison in the middleware would reject the new session.

## Findings

- **Security Sentinel** (C2): CRITICAL — new session could be immediately invalid

## Proposed Solutions

### Option A: Use 1-second buffer (Recommended)

```sql
SET token_revoked_at = NOW() - INTERVAL '1 second'
```

- **Pros**: Simple, guarantees new token is valid
- **Cons**: 1-second window where old tokens still work (acceptable)
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Password change does not invalidate the user's current session
- [ ] Old sessions from before the password change are rejected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | JWT iat is in seconds, DB is microsecond-precise |
