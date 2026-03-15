---
status: pending
priority: p3
issue_id: "066"
tags: [code-review, security, server, api]
dependencies: []
---

# sanitizeUser Returns Internal Fields (role, Stripe IDs) to Mobile Clients

## Problem Statement

`server/src/routes/auth.js`'s `sanitizeUser()` function returns fields that are internal implementation details, including:
- `role` — reveals which accounts are admins (client-side admin detection is a security smell)
- `stripe_customer_id` / `stripe_connect_account_id` — internal Stripe identifiers
- `connect_charges_enabled` / `connect_payouts_enabled` — internal Connect state fields
- `daily_generation_count` / `last_generation_date` — internal usage tracking
- `suspended` — internal moderation state

These are returned to all clients (web and mobile) via `/api/auth/me`, login, and signup. The mobile `User` type in `types/api.ts` does not expose most of these, so the data arrives but is silently ignored by TypeScript. The issue is not mobile-specific but the plan's type-layer fixes draw attention to it.

`role` is the most significant — exposing which accounts are admin-role to all clients creates an enumeration target.

Not scaffold-blocking, but should be addressed before any public beta.

## Findings

- **Security Sentinel (Review Round 3):** P2 — `role` and Stripe internal IDs should not be client-visible

Affected: `apps/ai-notecards/server/src/routes/auth.js` `sanitizeUser()` function

## Proposed Solutions

### Option A: Remove sensitive fields from sanitizeUser (Recommended)

Strip `role`, `stripe_customer_id`, `stripe_connect_account_id`, `connect_charges_enabled`, `connect_payouts_enabled`, `suspended` from the return value. Expose only what clients need: `id`, `email`, `displayName`, `plan`, `avatarUrl`, `studyScore`, `currentStreak`, `longestStreak`, `trialEndsAt`, `sellerTermsAccepted`, `stripeConnectOnboarded` (boolean, not the ID), `createdAt`.

**Pros:** Reduces information surface; admin accounts not enumerable by clients
**Cons:** May break web app code that reads these fields from context
**Effort:** Small — audit web app first to find any references
**Risk:** Medium — need to verify no web client code depends on `role` or Stripe IDs

## Acceptance Criteria

- [ ] `sanitizeUser()` does not return `role`
- [ ] `sanitizeUser()` does not return raw Stripe customer/connect account IDs
- [ ] Web app audit complete — no client code broken by removal
- [ ] Mobile `User` type in `types/api.ts` matches sanitized server response exactly
