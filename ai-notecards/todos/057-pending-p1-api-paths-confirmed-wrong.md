---
status: pending
priority: p1
issue_id: "057"
tags: [code-review, mobile, scaffold-blocking, api]
dependencies: []
---

# Mobile API Paths Confirmed Wrong — All Google/Magic-Link Auth and Study Will 404

## Problem Statement

Three API paths in `mobile/src/lib/api.ts` are wrong and will produce 404 responses. This is confirmed by reading `server/src/index.js` directly — no verification step needed. The mobile paths were modeled after server route file names rather than Express mount paths.

The plan contains incorrect guidance: its "Research Insights" section cites `/api/auth-magic/request` as possibly correct; the actual server mounts at `/api/auth/magic-link`. The executor must read `server/src/index.js` lines 86–98 as the authoritative source and ignore the plan's inline path suggestions.

## Findings

- **Architecture Strategist (Review Round 3):** P1-A — confirmed against `server/src/index.js`
- **Security Sentinel (Review Round 3):** P2 — all three paths confirmed mismatched via server index + web client cross-reference
- **Simplicity Reviewer (Review Round 3):** confirms paths ARE wrong; plan's "verify first" language is misleading

Server mounts (authoritative):
```
app.use('/api/auth/magic-link', authMagicRoutes);  → /api/auth/magic-link/request, /api/auth/magic-link/verify
app.use('/api/auth/google', authGoogleRoutes);     → /api/auth/google
app.use('/api/study', studyRoutes);                → POST /api/study (not /study/start)
```

Web client confirms (`client/src/lib/api.js` lines 34, 37–38, 72):
- `/auth/google` (not `/auth-google`)
- `/auth/magic-link/request` (not `/auth-magic/request`)
- `/auth/magic-link/verify` (not `/auth-magic/verify`)
- `/study` POST (not `/study/start`)

## Proposed Solutions

### Option A: Direct fix (Recommended)

In `mobile/src/lib/api.ts`:

| Line | Current | Fix |
|------|---------|-----|
| 84 | `/auth-google` | `/auth/google` |
| 88 | `/auth-magic/request` | `/auth/magic-link/request` |
| 89 | `/auth-magic/verify` | `/auth/magic-link/verify` |
| 114 | `/study/start` | `/study` |

**Pros:** Four character substitutions; zero architecture change; web client cross-reference confirms each fix
**Cons:** None
**Effort:** Small
**Risk:** None — replacing wrong paths with correct paths

## Acceptance Criteria

- [ ] `api.authGoogle()` calls `POST /auth/google`
- [ ] `api.requestMagicLink()` calls `POST /auth/magic-link/request`
- [ ] `api.verifyMagicLink()` calls `POST /auth/magic-link/verify`
- [ ] `api.startSession()` calls `POST /study` (not `/study/start`)
- [ ] Web client `client/src/lib/api.js` used as cross-reference for each path
