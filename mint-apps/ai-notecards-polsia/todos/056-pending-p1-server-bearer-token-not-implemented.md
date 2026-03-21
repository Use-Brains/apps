---
status: pending
priority: p1
issue_id: "056"
tags: [code-review, security, auth, mobile, scaffold-blocking]
dependencies: []
---

# Server Does Not Accept Bearer Tokens — All Mobile Auth Requests Will Fail

## Problem Statement

The mobile app sends `Authorization: Bearer <token>` on every authenticated request. The Express server's `authenticate` middleware reads tokens exclusively from cookies (`req.cookies?.token`) and has no Bearer token parsing. Every authenticated mobile request will return `401 Authentication required`. The mobile app is non-functional against the current server.

Additionally, `requireXHR` CSRF middleware requires `X-Requested-With: XMLHttpRequest` — a header that React Native `fetch` does not send. All state-changing endpoints (decks, study, settings, marketplace, seller, stripe) return `403 Forbidden` from mobile.

This is scaffold-blocking. No auth flow or CRUD operation can be tested until this server-side change is made.

## Findings

- **Security Sentinel (Review Round 3):** P1 — server `authenticate` middleware: `const token = req.cookies?.token` — zero Bearer token support
- **Architecture Strategist (Review Round 3):** P1-C — the brainstorm explicitly planned a one-line server middleware update as part of mobile setup; it was not implemented
- **Security Sentinel:** P2 — `requireXHR` blocks all mobile mutations; native apps are not vulnerable to CSRF so this guard must be bypassed for Bearer-authenticated requests

Reference: `apps/ai-notecards/server/src/middleware/auth.js`
Reference: `apps/ai-notecards/server/src/middleware/csrf.js`
Reference: Brainstorm §5 (API Integration): "The backend needs a small update: `const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')`"

## Proposed Solutions

### Option A: Extend auth middleware + bypass CSRF for Bearer requests (Recommended)

**`server/src/middleware/auth.js`:**
```js
const token = req.cookies?.token
  || req.headers.authorization?.replace('Bearer ', '');
```

**`server/src/middleware/csrf.js`:**
```js
// In requireXHR: bypass if request is Bearer-authenticated (native app)
if (req.headers.authorization?.startsWith('Bearer ')) return next();
```

**Pros:** Minimal diff; web app unchanged; mobile unblocked; matches brainstorm spec exactly
**Cons:** Requires server PR before any mobile auth testing
**Effort:** Small (2 lines changed)
**Risk:** Low — additive change, existing cookie path unchanged

### Option B: Mobile-specific API prefix

Route all mobile requests to `/api/mobile/*` with separate middleware chain.

**Pros:** Clean separation
**Cons:** Significant refactor; not in brainstorm plan; duplicates route definitions
**Effort:** Large
**Risk:** High

## Acceptance Criteria

- [ ] `server/src/middleware/auth.js` reads token from `Authorization: Bearer` header when no cookie present
- [ ] `server/src/middleware/csrf.js` bypasses `requireXHR` check when request has valid Bearer token
- [ ] `GET /api/auth/me` returns 200 with valid Bearer token
- [ ] `POST /api/decks` (or any state-changing endpoint) returns 2xx from mobile with valid Bearer token
- [ ] Existing web app cookie-based auth unchanged (no regression)
