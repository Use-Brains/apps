---
status: pending
priority: p1
issue_id: "042"
tags: [code-review, security, csrf, auth, marketplace-operations]
dependencies: ["006"]
---

# Apply `requireXHR` + `requireActiveUser` to All Unprotected Routes

## Problem Statement

14 state-changing endpoints lack CSRF protection (`requireXHR`) and critical routes lack `requireActiveUser`, allowing deleted/suspended users to manipulate billing and marketplace state. A malicious page can cancel subscriptions, create listings, suspend users, or delist content via cross-origin form submissions because the cookie-based JWT auth attaches automatically.

This extends todo 006 (extract `requireXHR` to shared middleware) — once extracted, apply it everywhere.

## Findings

- **Security Sentinel (P1-1, P1-2, P1-4)**: Confirmed 14 endpoints missing `requireXHR`. Stripe/seller/admin routes also missing `requireActiveUser`, meaning suspended/deleted users retain full access until JWT expires.
- **Pattern Recognition (P1)**: Count is 14, not 13 — plan missed `PATCH /settings/` profile update.
- **Code Simplicity**: Confirmed as highest security ROI fix.

**Endpoints missing `requireXHR`:**
- `stripe.js`: POST `/checkout`, POST `/cancel`
- `seller.js`: POST `/listings`, PATCH `/listings/:id`, DELETE `/listings/:id`, POST `/listings/:id/relist`, POST `/accept-terms`, POST `/onboard`
- `marketplace.js`: POST `/:id/flag`, POST `/:id/purchase`
- `ratings.js`: POST `/`
- `admin.js`: PATCH `/flags/:id`, PATCH `/users/:id/suspend`
- `settings.js`: PATCH `/` (profile update)

**Routes missing `requireActiveUser`:**
- `stripe.js`: POST `/checkout`, POST `/cancel` (+ new `/portal`)
- `seller.js`: All routes (suspended seller can create listings, relist removed content)
- `admin.js`: All routes (revoked admin retains powers)

## Proposed Solutions

### Option A: Batch fix (Recommended)

After todo 006 extracts `requireXHR` to shared middleware, add it to all 14 endpoints. Add `requireActiveUser` to stripe, seller, and admin routes. One-line change per route.

- **Pros**: Comprehensive fix, low risk, client already sends header
- **Cons**: None
- **Effort**: Small (30 minutes)
- **Risk**: None — client `api.js` already sends `X-Requested-With` on all requests

## Acceptance Criteria

- [ ] All 14 `POST`/`PATCH`/`DELETE` endpoints have `requireXHR`
- [ ] All stripe routes have `requireActiveUser`
- [ ] All seller routes have `requireActiveUser`
- [ ] All admin routes have `requireActiveUser`
- [ ] Middleware order: `requireXHR` → `authenticate` → `requireActiveUser` → rate limiter

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Security + Pattern Recognition agents both flagged independently |
