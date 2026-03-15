---
status: pending
priority: p1
issue_id: "044"
tags: [code-review, security, auth, middleware]
dependencies: []
---

# Missing requireActiveUser on Duplicate Endpoint and Deck Mutations

## Problem Statement

The `authenticate` middleware only verifies the JWT — it does not check `deleted_at`, `suspended`, or `token_revoked_at`. The heavier `requireActiveUser` middleware is opt-in. The plan's duplicate endpoint middleware chain (`requireXHR, authenticate, checkTrialExpiry, saveLimiter`) omits `requireActiveUser`. Several existing card mutation endpoints also lack it.

A suspended or soft-deleted user with a valid JWT can duplicate decks, rename decks, and mutate cards.

## Findings

- **Security Sentinel:** CRITICAL — suspended/deleted users can create content
- **Architecture Strategist:** Verified gap
- **Data Integrity Guardian:** HIGH — duplicate endpoint missing requireActiveUser
- **Pattern Recognition:** Confirmed pre-existing gap on card mutations

## Proposed Solutions

### Option A: Add requireActiveUser to all mutation endpoints (Recommended)
Add `requireActiveUser` to the middleware chain for:
- **New:** `POST /api/decks/:id/duplicate`
- **Existing:** `PATCH /api/decks/:id` (rename, line 165)
- **Existing:** `DELETE /api/decks/:id` (delete, line 189)
- **Existing:** `POST /api/decks/:id/cards` (add card, line 206)
- **Existing:** `PATCH /api/decks/:deckId/cards/:cardId` (edit card, line 237)
- **Existing:** `DELETE /api/decks/:deckId/cards/:cardId` (delete card, line 266)

**Pros:** Comprehensive fix, consistent security posture
**Cons:** Slightly more middleware per request (negligible)
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] Suspended users cannot call any deck/card mutation endpoint
- [ ] Soft-deleted users cannot call any deck/card mutation endpoint
- [ ] `requireActiveUser` is in the middleware chain for all 6 endpoints listed above
