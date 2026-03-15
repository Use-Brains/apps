---
status: complete
priority: p1
issue_id: "034"
tags: [code-review, plan-review, security, auth, phase-5]
dependencies: []
---

# Phase 5: token_revoked_at Missing from USER_SELECT — /me Revocation Check Broken

## Problem Statement

The `USER_SELECT` constant at `auth.js:11-16` does not include `token_revoked_at`. The `/me` endpoint at `auth.js:158` checks `user.token_revoked_at` (from `SELECT ${USER_SELECT}`), but since the column isn't selected, it's always `undefined`. This means `undefined && ...` is falsy, so the revocation check silently passes. A user whose token was revoked (e.g., after password change) can still appear logged in via `/me`.

The `authenticate` middleware does its own query for `token_revoked_at` so protected routes work, but `/me` bypasses `authenticate` (it's a public endpoint).

## Findings

- **Security Sentinel (Round 2):** HIGH — token revocation on `/me` is non-functional

## Resolution

Added `token_revoked_at` to the Phase 5 USER_SELECT diff. Added explanatory note about why it's needed. Ensured `sanitizeUser` does NOT expose it to the client (server-side use only).
