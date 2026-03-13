---
title: iOS Swift/SwiftUI Rewrite + BYOK Feature
type: feat
status: active
date: 2026-03-12
deepened: 2026-03-12 (round 1), 2026-03-12 (round 2)
reviewed: 2026-03-12 (7 agents — Security, Architecture, Performance, Data Integrity, Simplicity, SpecFlow, Migration), 2026-03-12 round 3 (5 agents — Security Sentinel, Architecture Strategist, Data Integrity Guardian, Spec Flow Analyzer, Code Simplicity Reviewer)
origin: docs/brainstorms/2026-03-12-ios-swift-rewrite-byok-brainstorm.md
---

# iOS Swift/SwiftUI Rewrite + BYOK Feature

## Enhancement Summary

**Deepened on:** 2026-03-12
**Sections enhanced:** 6 phases + system-wide impact
**Review agents used:** Security Sentinel, Architecture Strategist, Data Integrity Guardian, Performance Oracle, Code Simplicity Reviewer, Best Practices Researcher

### Critical Issues Discovered

1. **Listing-price mismatch attack** — Backend must verify that the IAP product tier matches the listing's actual price. Without this, a user could buy a `tier1` ($1) consumable and claim it was for a $5 listing.
2. **Account deletion FK violation** — `purchases.seller_id` references `users.id` with NO CASCADE. `DELETE FROM users` will fail for any user who has sold decks. Requires soft-delete strategy.
3. **`password_hash NOT NULL` blocks Sign in with Apple** — Users table has `password_hash TEXT NOT NULL`. Apple-only users have no password. Migration must `ALTER COLUMN password_hash DROP NOT NULL` and add `apple_user_id TEXT UNIQUE`.
4. **No refresh token = 7-day irrevocable JWT** — A compromised token grants 7 days of access with no revocation mechanism. Add refresh token flow.
5. **Immediate seller payouts enable refund fraud** — If sellers are paid immediately on purchase, a buyer can refund via Apple and the platform absorbs the loss. Add 7-14 day payout hold period.
6. **Consumable IAP retry loses listing context** — If the app crashes between `product.purchase()` and sending `listingId` to the backend, the transaction is orphaned. Must persist `listingId` before initiating purchase.
7. **Self-purchase not prevented** — Nothing stops a seller from buying their own deck to inflate purchase counts. Add server-side check.

### Key Simplifications

1. **Cut offline caching from v1** — Defer to v1.1. Reduces complexity significantly. Study mode requires network in v1.
2. **Cut admin iOS view** — Use existing web admin at `/admin/flags`. Saves building `AdminFlagsView.swift`.
3. **Cut liquid glass** — iOS 26 not publicly available. Design for iOS 17+ with standard SwiftUI. Add liquid glass in future update.
4. **Hardcode model list client-side** — Eliminate `GET /api/settings/models` endpoint. Ship a curated list of ~10 popular models. Update via app update.
5. **Eliminate `POST /api/settings/api-key/validate`** — Validate on first use during generation. One fewer endpoint.
6. **Merge `DELETE /api/settings/api-key` into `PUT` with null body** — One fewer endpoint.
7. **Merge `PUT /api/settings/model` into existing `PATCH /api/settings`** — Add `preferred_model` field to existing settings endpoint.
8. **Use plain class for APIClient** — Actor is overkill for URLSession (which is already thread-safe). Plain class with `@MainActor` where needed.
9. **Reduce Swift files from ~34 to ~27** — Merge small views, cut admin view, simplify structure.

### Performance Additions

1. **Request timeout on generate route** — 90s server-side, 120s iOS-side
2. **Cap input size for platform-key users** — ~30K chars for Free/Pro (BYOK unlimited)
3. **Per-provider timeouts** — Groq 30s, Gemini 45s, OpenRouter 80s. **Timeouts must layer correctly: iOS (120s) > server route (90s) > provider (80s)** — if provider timeout exceeds server timeout, server kills the connection first and user gets a generic 500 instead of a meaningful timeout error.
4. **Denormalize `card_count` on `marketplace_listings`** — Avoid `COUNT(*)` join on every browse query

## Enhancement Summary — Round 2

**Deepened on:** 2026-03-12
**Agents used:** Security Sentinel, Architecture Strategist, Data Integrity Guardian, Performance Oracle, Code Simplicity Reviewer, Data Migration Expert, SpecFlow Analyzer, TypeScript Reviewer, Pattern Recognition Specialist, BYOK/OpenRouter Researcher, StoreKit 2 Researcher, SwiftUI Patterns Researcher, Express Auth Researcher

### Critical Bugs Fixed

1. **`pending_iap_purchases` uses INTEGER/SERIAL but all existing PKs/FKs are UUID** — Migration will fail. Fixed: `id UUID DEFAULT gen_random_uuid()`, `user_id UUID`, `listing_id UUID`.
2. **`bcrypt.compare` on NULL `password_hash` throws** — SIWA users have no password. Login route must guard: `if (!user.password_hash) return res.status(401)`.
3. **`sanitizeUser()` / `USER_SELECT` not updated** — iOS will get incomplete user data. Must add: `preferred_model`, `apple_subscription_expires_at`, `apple_subscription_product_id`, `deleted_at`, `plan`.
4. **Backfill column `marketplace_listings.source_deck_id` doesn't exist** — Actual column is `deck_id` (from migration 003). Fixed in backfill query.
5. **`UNIQUE (user_id, listing_id, completed_at)` doesn't prevent duplicate pending rows** — PostgreSQL treats NULLs as distinct. Fixed: partial unique index `WHERE completed_at IS NULL`.
6. **`seller_payout_status DEFAULT 'pending'` on existing rows** — All existing Stripe purchases (already paid) would show as 'pending'. Added backfill: `UPDATE purchases SET seller_payout_status = 'paid' WHERE stripe_payment_intent_id IS NOT NULL`.
7. **Apple webhook body parsing conflicts with Stripe** — `express.raw()` blankets all `/webhooks` paths. Apple sends JWS-signed JSON (not raw body HMAC). Fixed: separate middleware paths.

### Auth Architecture Corrections

1. **Refresh token hashing: SHA-256, not bcrypt** — Refresh tokens are high-entropy (no brute-force risk). Bcrypt is ~300ms/compare, SHA-256 is ~0.01ms. Use `crypto.createHash('sha256')`.
2. **Refresh token expiry: 30-day absolute + 7-day inactivity** — 7-day flat is too short for mobile (users re-login weekly). 30-day ceiling with inactivity timeout is standard mobile pattern.
3. **Dual auth strategy** — Keep 7-day cookies for web client (no refresh flow). Add 15-min Bearer + refresh for iOS. Changing web to 15-min would break existing React client.
4. **`authenticateOptional` middleware needed** — For endpoints like `GET /api/marketplace/:id` that show different data for authenticated vs anonymous users.
5. **SIWA account-linking flow** — If Apple email matches existing email+password account, UNIQUE constraint causes 500. Need: lookup by `apple_user_id` first → if not found, lookup by **verified** email (`email_verified: true` in Apple identity token) → if email match exists, **require existing account password to confirm merge** (prevents hostile takeover) → link `apple_user_id` to existing account → return combined account. If Apple uses "Hide My Email" (relay address) and it doesn't match, create new account (user can link later from Settings).
6. **Apple credential revocation handler** — Apple sends revocation notification via App Store Server API. Must handle by logging user out server-side (invalidate refresh token).
7. **Refresh token family tracking** (technical review — 10s grace period is exploitable) — Each refresh token chain belongs to a "family" (stored as `refresh_token_family_id UUID` on the user). On refresh, issue new refresh token + update hash. If a rotated-out token is reused after the new one has been used, **invalidate the entire family** (force re-auth) — this detects token theft per RFC 6749 §10.4.
8. **Rate limiting on `POST /api/auth/refresh`** (technical review) — 10 req/min per IP, 5 req/min per token hash. Endpoint is unauthenticated by design, prime brute-force target. Refresh token entropy: `crypto.randomBytes(32)` (256 bits minimum). Use `crypto.timingSafeEqual` for hash comparison.
9. **APIClient concurrent 401 serialization** (technical review) — When access token expires, multiple in-flight requests may all get 401. Pattern: first 401 triggers refresh, all subsequent 401s during that refresh are queued (held in a serial `DispatchQueue` or `actor`) and retried with the new token after refresh completes. Without this, N concurrent 401s trigger N refresh calls, each rotating the token.

### iOS Architecture Corrections

1. **`TransactionObserver` must be on `@main` App struct** — Not in a View. StoreKit requires persistent listener across app lifecycle.
2. **`Router` class per tab with `NavigationPath`** — Each tab gets its own `@Observable Router` holding a `NavigationPath`. Avoids cross-tab navigation state conflicts.
3. **`NWPathMonitor` in `@Observable` class for offline detection** — Show clear offline state. Wrap in `NetworkMonitor` observable.
4. **Two `SignedDataVerifier` instances** — One for production, one for sandbox. Sandbox transactions arrive even in production (TestFlight, reviewer devices).
5. **Stripe Connect onboarding** — Use `ASWebAuthenticationSession` (NOT `SFSafariViewController` — doesn't reliably support custom URL scheme redirects). Register custom URL scheme `ainotecards://`.

### Performance Improvements

1. **Batch card inserts** — `purchase.js` and `generate.js` each do 30 sequential INSERT queries. Use single multi-row INSERT: `INSERT INTO cards (deck_id, front, back) VALUES ($1,$2,$3), ($4,$5,$6)...`. Saves ~400ms on Supabase.
2. **Consolidate user queries** — `checkTrialExpiry` + `checkGenerationLimits` + BYOK key fetch = 3 DB queries per generation. Consolidate to 1 query returning plan, generation count, trial expiry, and encrypted key.
3. **`express.json({ limit: '500kb' })` on generate route** — Express default is 100KB, blocks 200K BYOK input. Apply limit only on `/api/generate`.
4. **Missing indexes** — Add: `apple_original_transaction_id`, `deleted_at` (partial, WHERE NOT NULL), `seller_payout_status`, `pending_iap_purchases(user_id)`.

### Key Simplification Candidates (from Simplicity Reviewer)

1. **Consider cutting `pending_iap_purchases` table** — Use `UserDefaults` on iOS to store listing context instead. Simpler, avoids the UUID bug entirely. Trade-off: no server-side recovery if user switches devices mid-purchase (unlikely for v1).
2. **Consider 24h JWT with no refresh tokens** — Dramatically simpler auth. Trade-off: 24h window if token compromised. Acceptable for v1 if HTTPS-only.
3. **Cut `card_count` denormalization** — `COUNT(*)` with proper index is fast enough for v1 volume. Add later if marketplace grows.
4. **Manual payouts instead of cron** — Developer is sole admin. Manual trigger via web admin is simpler than building cron infrastructure for v1.
5. **Drop key versioning prefix for v1** — Just use `iv:authTag:ciphertext`. Add `v2:` prefix when you actually rotate keys. YAGNI.

### BYOK Clarification

- **BYOK Pro without stored API key = error, NOT fallback** — If backend falls back to platform keys (Groq/Gemini), user gets unlimited generations at $5/mo instead of $9/mo. Revenue exploit. Return `{ error: 'byok_key_required' }` directing to settings.
- **OpenRouter error mapping**: 401 → invalid key, 402 → insufficient credits, 429 → rate limited (surface to user), 502 → provider down (retry with different model suggestion).
- **Add subscription cancellation warning before account deletion** — "You have an active Pro subscription. Deleting your account does not cancel your Apple subscription. Please cancel in Settings > Apple ID first."

## Enhancement Summary — Round 3 (Pre-Implementation Technical Review)

**Reviewed on:** 2026-03-12
**Agents used:** Security Sentinel, Architecture Strategist, Data Integrity Guardian, Spec Flow Analyzer, Code Simplicity Reviewer (5-agent parallel compound review against full plan + codebase)

### Simplifications Adopted (eliminate clusters of critical issues)

1. **24h JWT — cut refresh tokens entirely** — The refresh token system (SHA-256, rotation, family tracking, rate limiting, concurrent 401 serialization) is ~200+ lines of infrastructure. A 24h JWT over HTTPS is standard for mobile apps at this scale. Add a single `token_revoked_at TIMESTAMPTZ` column on users as a kill switch (reject tokens issued before it). On logout, password reset, or account deletion, set `token_revoked_at = NOW()`. **Eliminates:** password reset session invalidation, suspended user refresh bypass, single-device session limitation, rate limiting infrastructure dependency, missing refresh_token_hash index.
   - **Columns removed from migration 005:** `refresh_token_hash`, `refresh_token_expires_at`, `refresh_token_last_used_at`, `refresh_token_family_id`
   - **Column added:** `token_revoked_at TIMESTAMPTZ`
   - **Endpoints removed:** `POST /api/auth/refresh`
   - **iOS impact:** `APIClient` no longer needs 401-serialized-refresh logic. On 401 → route to login. `AuthManager` stores single JWT in Keychain, auto-login checks expiry locally.

2. **Cut `pending_iap_purchases` table — use UserDefaults** — Persist `listingId` in UserDefaults before initiating StoreKit purchase. On crash recovery, `Transaction.updates` reads `listingId` from UserDefaults. "Switches devices mid-purchase" is astronomically unlikely for v1. **Eliminates:** missing recovery endpoint, multiple-pending-same-tier ambiguity, UUID-type bug, 1 table + 1 endpoint + 1 index from migration.
   - **Table removed from migration 005:** `pending_iap_purchases` (and its partial unique index)
   - **Endpoint removed:** `POST /api/iap/pending-purchase`
   - **iOS addition:** `UserDefaults.standard.set(listingId, forKey: "pendingPurchase_\(productId)")` before `product.purchase()`, clear on successful verification.

3. **Simplify SIWA to create-only (no account linking in v1)** — Lookup by `apple_user_id` → if found, login. If not found, create new account. No email-matching, no password-confirmed merge, no `POST /api/auth/apple/link`. If a user has both a SIWA account and an email+password account, they exist as separate accounts. Account linking is v1.1 when a user actually reports the problem. **Eliminates:** SIWA account-linking race condition (high-severity security flaw), entire linking flow complexity.
   - **Endpoint removed:** `POST /api/auth/apple/link`
   - **Simplified:** `POST /api/auth/apple` — verify identity token → lookup by `apple_user_id` → login or create.

4. **Cut forgot-password from v1** — SIWA is the primary iOS auth path. Email+password users who forget their password can contact the developer directly or use SIWA to create a new account. Defer to v1.1. **Eliminates:** transactional email service dependency (`EMAIL_API_KEY`), reset token columns, email template, hosted reset page, rate limit gap on forgot-password, undefined SIWA-only user behavior for password reset.
   - **Columns removed from migration 005:** `reset_token_hash`, `reset_token_expires_at`
   - **Endpoints removed:** `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
   - **Dependency removed:** Transactional email service (Resend/Postmark/SendGrid)

5. **Additional simplifications adopted:** Cut `card_count` denormalization (COUNT(*) is fast at v1 scale), drop key versioning prefix (store `iv:authTag:ciphertext`, add `v2:` when you actually rotate keys), manual payouts (no cron — developer triggers via web admin or SQL), cut `NetworkMonitor.swift` (handle URLSession errors reactively), cut per-tab `Router.swift` (use `@State NavigationPath`), defer grace period handling to v1.1 (`subscription_grace_period_ends_at` column removed), defer Apple credential revocation handler to v1.1.
   - **Column removed from migration 005:** `subscription_grace_period_ends_at`
   - **Files removed from iOS structure:** `NetworkMonitor.swift`, `Router.swift`
   - **Encryption format:** `iv:authTag:ciphertext` (no version prefix)

### Critical Bugs Fixed (would break the app)

1. **`/api/auth/me` returns 200 with `{ user: null }` instead of 401 — breaks iOS auth** — The existing endpoint bypasses `authenticate` middleware and returns `{ user: null }` on failure (for React's `AuthContext`). iOS expects 401 to detect expired tokens. **Fix:** When request has `Authorization: Bearer` header, return 401 on invalid/expired token. When request has cookie, keep existing `{ user: null }` behavior for web compatibility.

2. **`VALIDATE CONSTRAINT` inside single-transaction migrator defeats `NOT VALID` pattern** — The migrator wraps each migration in `BEGIN`/`COMMIT`. Both `ADD CONSTRAINT NOT VALID` and `VALIDATE CONSTRAINT` in the same transaction holds `ACCESS EXCLUSIVE` lock for the full scan. **Fix:** Move `VALIDATE CONSTRAINT` to a separate migration file `005b_validate_plan_check.sql`.

3. **`fulfillPurchase()` hardcodes Stripe idempotency — IAP purchases will fail** — Existing function uses `ON CONFLICT (stripe_payment_intent_id) DO NOTHING`. For IAP purchases, `stripe_payment_intent_id` is NULL. **Fix:** Add `paymentSource` parameter to `fulfillPurchase()` that switches between `ON CONFLICT (stripe_payment_intent_id)` and `ON CONFLICT (apple_iap_transaction_id)` paths.

4. **Express body parser ordering — per-route 500KB limit won't work** — Global `express.json({ limit: '1mb' })` on line 31 of `index.js` parses the body before route-specific middleware. **Fix:** Remove global body parser. Apply `express.json({ limit: '500kb' })` on `/api/generate` and `express.json({ limit: '100kb' })` on all other routes via router-level middleware.

5. **Buyers cannot delete purchased decks (FK violation)** — `purchases.deck_id REFERENCES decks(id)` with default RESTRICT. **Fix in migration 005:** `ALTER TABLE purchases ALTER COLUMN deck_id DROP NOT NULL` + add `ON DELETE SET NULL` by dropping and re-adding the FK constraint. When a buyer deletes a purchased deck, the purchase record persists (audit trail) but `deck_id` becomes NULL.

6. **Existing SQL injection in `purchase.js` batch insert dead code** — Lines 177-189 interpolate `newDeckId` directly into SQL string. **Fix:** Clean up dead code and use parameterized multi-row INSERT during the batch insert refactor.

### Security Fixes

1. **No server-side input length validation on generate route** — Any HTTP client can send 500KB of text to platform AI providers (Groq/Gemini), running up costs. **Fix:** Add in generate route handler: reject if `input.length > 30000` for Free/Pro/Trial, `input.length > 200000` for BYOK Pro. Enforce server-side regardless of client.

2. **`source_text` stores unbounded user input, not scrubbed on deletion** — BYOK users can send 200K of text stored as `source_text TEXT`. Not anonymized during soft-delete (PII risk from user-pasted notes). **Fix:** (a) Truncate `source_text` to 5000 chars on storage (enough for context display, not full input), (b) scrub `decks.source_text` to NULL during account deletion alongside other PII.

3. **SIWA nonce — use signed nonce instead of server-side Map** — In-memory Map with no eviction is a DoS vector. **Fix:** Use HMAC-based signed nonce: `HMAC(timestamp + random, server_secret)`. Server verifies by recomputing HMAC — no storage needed, no memory exhaustion risk. Reject nonces older than 5 minutes by checking timestamp.

4. **Marketplace detail endpoint exposes removed listings** — `GET /api/marketplace/:id` has no status filter. Listings removed for policy violations remain accessible via direct URL. **Fix:** Add `AND ml.status != 'removed'` to the listing detail query.

5. **`authenticate` middleware must check `deleted_at IS NULL`** — Soft-deleted users with valid JWTs (up to 24h window) can still hit authenticated endpoints. **Fix:** Add `deleted_at IS NULL` check in authenticate middleware query. Also add to `/api/auth/me` direct query.

6. **Price change between IAP initiation and verification** — Seller changes listing price between buyer's purchase and backend verification. **Fix:** Store `expectedPriceCents` in UserDefaults alongside `listingId` before purchase. At verification time, pass `expectedPriceCents` to backend. Backend validates: if `listing.price_cents != expectedPriceCents`, reject with descriptive error ("Listing price changed, please try again"). Also: prevent seller from changing price while any active purchase is in-flight (or accept if `iap_price >= listing.price_cents`).

7. **Out-of-order Apple webhook processing** — Apple doesn't guarantee notification order. **Fix:** Store `signedDate` from each processed notification alongside `notificationUUID` in a `processed_apple_notifications` table. Before processing, check: (a) `notificationUUID` not already processed (idempotency), (b) for state-changing notifications (EXPIRED, DID_RENEW, REFUND), compare `signedDate` against user's `last_apple_notification_date` — reject if older than last processed.

8. **Apple webhook idempotency** — No dedup mechanism specified. **Fix:** Create `processed_apple_notifications` table: `id UUID PK, notification_uuid TEXT UNIQUE NOT NULL, notification_type TEXT, signed_date TIMESTAMPTZ, processed_at TIMESTAMPTZ DEFAULT NOW()`. Add to migration 005. Check `ON CONFLICT (notification_uuid) DO NOTHING` before processing.

9. **`display_name` and `apple_user_id` missing from account deletion anonymization** — **Fix:** Add to soft-delete: `display_name = NULL`, `apple_user_id = NULL`.

10. **`requirePlan('pro')` in 4 seller routes does not include `byok_pro`** — Lines 17, 129, 215, 292 of `seller.js`. **Fix:** Update all four to `requirePlan('pro', 'byok_pro')`.

### Spec Flow Fixes

1. **Trial-to-IAP transition must clear `trial_ends_at`** — Without this, `checkTrialExpiry` middleware fires unnecessary UPDATEs after subscription expires. **Fix:** `POST /api/iap/verify` sets `trial_ends_at = NULL` when upgrading plan.

2. **`EXPIRED` webhook must clean up Apple-specific columns** — **Fix:** On `EXPIRED`, set `apple_subscription_product_id = NULL`, `apple_subscription_expires_at = NULL`. Keep `apple_original_transaction_id` for resubscription reconciliation.

3. **Dual subscription state (Stripe + Apple) needs handling** — No constraint prevents a user having both `stripe_subscription_id` and `apple_original_transaction_id`. **Fix:** Add comment in migration documenting that both can coexist during transition. `POST /api/iap/verify` should cancel Stripe subscription if one exists (call `stripe.subscriptions.cancel()`). `checkTrialExpiry` should prefer Apple subscription state when both exist.

4. **`REFUND` notification for marketplace purchases** — **Fix:** On consumable refund: set `purchases.seller_payout_status = 'refunded'` if payout is still pending. Do NOT revoke buyer's deck access (they already have a copy, revoking creates poor UX). Track refund-to-purchase ratio per buyer to detect abuse patterns.

5. **Deleted seller name shows as anonymized email in marketplace** — **Fix:** Marketplace queries should `COALESCE(u.display_name, 'Deleted User')` for seller name display.

6. **Split auth.js before it becomes a monolith** — Adding SIWA, logout token revocation, and account deletion to the existing 143-line file pushes it to ~350+ lines. **Fix:** Split into `auth.js` (login/signup/logout/me), `auth-apple.js` (SIWA endpoint), `auth-account.js` (account deletion). Follow existing pattern of focused route files.

7. **Add API version endpoint for iOS force-update** — **Fix:** Extend `GET /api/health` response to include `{ minClientVersion: "1.0.0" }`. iOS checks on launch and shows force-update alert if below minimum.

8. **Establish backend error code constants** — The plan introduces structured error codes (`byok_key_required`, etc.) but existing codebase uses free-form strings. **Fix:** Create `server/src/constants/errors.js` exporting all error codes. iOS `APIError` enum mirrors these codes. Prevents string-matching drift.

## Overview

Replace the React web frontend with a native iOS app built in Swift/SwiftUI, while keeping the existing Express/Node.js backend. Add a BYOK (Bring Your Own Key) subscription tier where users provide their own OpenRouter API key for unlimited AI generations at a reduced price. All payments (subscriptions and marketplace purchases) go through Apple IAP in v1, with TODOs/placeholders for v2 Stripe Direct.

## Problem Statement / Motivation

The app needs App Store distribution for discoverability and a premium native feel (liquid glass, SF Symbols, haptics, system theme integration) that web/hybrid frameworks can't deliver. BYOK unlocks a new revenue tier that reduces platform AI costs while giving power users unlimited generations and model choice.

## Key Decisions (from brainstorm)

All decisions below were made during brainstorming (see brainstorm: `docs/brainstorms/2026-03-12-ios-swift-rewrite-byok-brainstorm.md`).

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Platform | Native Swift/SwiftUI | Premium native feel; Android later as separate Kotlin app |
| BYOK architecture | Server-side (encrypted in DB) | Tier enforcement, prompt secrecy, fits existing middleware |
| BYOK provider | OpenRouter | Stateless, 100+ models, user picks their model |
| Payments (v1) | Apple IAP only | Cleanest App Store approval path, single subscription system |
| Payments (v2) | Stripe Direct (TODOs in v1) | Discounted pricing, better margins for platform and users |
| Marketplace split | 50/50 seller/platform | Platform's 50% covers Apple's cut + operational costs |
| Marketplace IAP type | Consumable (server-managed entitlements) | See "Marketplace IAP Architecture" below |
| Deck purchases | Buy once, keep forever | Users expect purchased content to persist |
| Ratings | 1-5 stars, no written reviews | Simple, aggregated as 1.0-5.0 average |
| Admin | Single admin (developer) | Multi-admin is v2 |
| Auth | Email+password + Sign in with Apple | Apple requires SIWA when offering third-party auth |

### Marketplace IAP Architecture (Resolved from SpecFlow)

Non-consumable IAPs require pre-registered product IDs in App Store Connect — you can't create one per deck dynamically. **Solution: Use consumable IAPs with server-managed entitlements.**

- Register 5 consumable product IDs, one per price tier: `com.ainotecards.deck.tier1` ($1) through `com.ainotecards.deck.tier5` ($5)
- When a user purchases, the consumable is "consumed" immediately
- The backend records the purchase and copies the deck to the buyer's library (existing fulfillment logic)
- Purchase records in the `purchases` table are the source of truth — not StoreKit entitlements
- Deck access is server-managed: the backend knows who bought what
- This avoids the non-consumable restore problem (buyer refunds, restores on new device, gets deck free)

### Tier Structure

| Tier | Price | Generations/day | AI Provider | Marketplace |
|------|-------|-----------------|-------------|-------------|
| Free | $0 | 1 | App's keys (Groq/Gemini) | Buy only |
| Trial | $0 (7 days) | 10 | App's keys (Groq/Gemini) | Buy only |
| Pro | $9/mo | 10 | App's keys (Groq/Gemini) | Buy + Sell |
| BYOK Pro | $5/mo | Unlimited | User's OpenRouter key | Buy + Sell |

### Apple Small Business Program

Platform qualifies for **15% commission** (not 30%) on all IAP since revenue is under $1M. This improves marketplace economics significantly:

**$5 deck example:**
- Apple takes $0.75 (15%)
- Platform receives $4.25
- Platform pays seller $2.50 (50% of gross)
- Platform nets $1.75

Enroll immediately after creating the Apple Developer account.

## Proposed Solution

### Architecture

```
┌─────────────────────┐     HTTPS + Bearer JWT     ┌──────────────────────┐
│   iOS App (Swift)   │ ◄─────────────────────────► │  Express API Server  │
│                     │                             │                      │
│  SwiftUI Views      │                             │  Auth Middleware      │
│  @Observable VMs    │                             │  Plan Middleware      │
│  StoreKit Manager   │     App Store Server API    │  AI Service           │
│  Keychain Manager   │                             │  IAP Verification     │
│  API Client (class) │                             │  Encryption Module    │
│  Auth Manager       │                             │  Stripe Connect       │
└─────────────────────┘                             └──────────────────────┘
         │                                                    │
         │ StoreKit 2                                         │
         ▼                                                    ▼
┌─────────────────────┐                             ┌──────────────────────┐
│    App Store        │ ──── Server Notifications ──►│    PostgreSQL        │
│    (Apple IAP)      │          V2                  │    (Supabase)        │
└─────────────────────┘                             └──────────────────────┘
                                                              │
                                                    ┌──────────────────────┐
                                                    │   Stripe Connect     │
                                                    │   (Seller Payouts)   │
                                                    └──────────────────────┘
```

### SwiftUI App Structure

> **Simplified from original 34 files to ~25** (round 3). Admin moderation uses existing web UI. Offline caching deferred to v1.1. APIClient is a plain class. NetworkMonitor and Router eliminated.

```
AINotecards/
├── AINotecards.swift                 # @main App entry, environment injection, TransactionObserver
├── Models/
│   ├── User.swift                    # User, AuthResponse
│   ├── Deck.swift                    # Deck, Card
│   ├── StudySession.swift
│   ├── MarketplaceListing.swift
│   └── APIError.swift                # Enum mirroring server/src/constants/errors.js
├── Services/
│   ├── AuthManager.swift             # @Observable, 24h JWT lifecycle, Keychain storage
│   ├── APIClient.swift               # Plain class, URLSession, Bearer token injection
│   ├── StoreKitManager.swift         # @Observable, products, purchases, entitlements
│   └── KeychainManager.swift         # Wrapper around Security framework
├── Views/
│   ├── Auth/
│   │   ├── LoginView.swift
│   │   ├── SignupView.swift
│   │   └── SignInWithAppleButton.swift
│   ├── Home/
│   │   ├── HomeView.swift            # Tab bar container
│   │   └── DashboardView.swift       # Deck list, trial banner, study score
│   ├── Generate/
│   │   └── GenerateView.swift        # Notes input, generate button, loading
│   ├── Deck/
│   │   └── DeckDetailView.swift      # Card list, edit, delete (CardEditView merged in)
│   ├── Study/
│   │   └── StudyView.swift           # Card flip, known/unknown, session summary (CardFlipView merged in)
│   ├── Marketplace/
│   │   ├── MarketplaceView.swift     # Browse, search, filter
│   │   ├── ListingDetailView.swift   # Preview, purchase, flag, rate
│   │   └── ListDeckView.swift        # Create listing form
│   ├── Seller/
│   │   └── SellerDashboardView.swift # Earnings, listings, Connect onboarding (combined)
│   ├── Settings/
│   │   ├── SettingsView.swift        # Profile, subscription, BYOK, account deletion
│   │   ├── BYOKSettingsView.swift    # API key entry, model picker (hardcoded list)
│   │   └── SubscriptionView.swift    # SubscriptionStoreView wrapper
│   └── Shared/
│       ├── PaywallView.swift         # SubscriptionStoreView + marketing content
│       └── LoadingView.swift
└── Utilities/
    └── Constants.swift               # API base URL, product IDs, model list, etc.
```

## Technical Approach

### Implementation Phases

#### Phase 1: Foundation (Backend + iOS Project Setup)

**Backend changes to support iOS client:**

**1. Auth middleware — add Bearer token support + 24h JWT** *(round 3: simplified from refresh tokens)*
- File: `server/src/middleware/auth.js`
- Check `Authorization: Bearer <token>` header as fallback when no cookie present
- **Add `deleted_at IS NULL` check** (round 3 security fix) — soft-deleted users with valid JWTs (up to 24h) must be rejected
- **Add `token_revoked_at` check** (round 3) — reject tokens where `iat < token_revoked_at` (kill switch for logout/deletion/compromise)
- **CRITICAL: Fix `/api/auth/me` endpoint** — it bypasses middleware, reads cookies directly via `req.cookies.token`. Must also check Bearer header. **Round 3 fix:** When request has `Authorization: Bearer` header and token is invalid/expired, return **401** (iOS needs this to detect auth failure). When request has cookie, keep existing `{ user: null }` behavior (web compatibility).
- File: `server/src/routes/auth.js`
- Return `{ token, user }` in login/signup JSON responses (alongside setting cookie for web)
- **Guard `bcrypt.compare` against NULL `password_hash`** (round 2 finding): SIWA users have no password. Login route must check: `if (!user.password_hash) return res.status(401).json({ error: 'Use Sign in with Apple' })` before calling `bcrypt.compare`.
- **Update `sanitizeUser()` and `USER_SELECT`** (round 2 finding): Add new columns to user response: `preferred_model`, `apple_subscription_expires_at`, `apple_subscription_product_id`, `plan`. **Exclude `deleted_at` from client response** (technical review — leaks internal state, deleted users should never reach `/api/auth/me`).
- **Auth strategy** (round 3 — simplified from dual 15-min/7-day to unified 24h JWT):
  - **Both web and iOS:** 24-hour JWT. Web sets httpOnly cookie (existing pattern). iOS uses Bearer header.
  - **Kill switch:** `token_revoked_at TIMESTAMPTZ` on users. On logout or account deletion, set `token_revoked_at = NOW()`. Auth middleware rejects JWTs where `iat < token_revoked_at`.
  - `POST /api/auth/logout` — set `token_revoked_at = NOW()` (invalidates all sessions) + clear cookie for web
  - ~~`POST /api/auth/refresh`~~ — **Eliminated** (round 3 simplification). 24h JWT over HTTPS is standard for mobile at this scale. Blast radius of stolen JWT is "someone can see flashcards and generate cards" — not worth refresh token infrastructure.
  - iOS `APIClient`: On 401 → route to login screen. No refresh logic needed.
- **Add `authenticateOptional` middleware variant** — for endpoints that show different data for auth'd vs anon users (e.g., `GET /api/marketplace/:id` showing "purchased" badge)
- Add Sign in with Apple endpoint: `POST /api/auth/apple` — verify Apple identity token using `apple-signin-auth` npm package
  - **Nonce validation** (round 3 — HMAC-based, no server-side storage): Generate signed nonce: `HMAC(timestamp + random, server_secret)`. iOS sends nonce in ASAuthorization request. Backend verifies by recomputing HMAC from identity token's nonce — no Map/Redis storage, no memory exhaustion risk. Reject nonces older than 5 minutes by checking timestamp.
  - **CRITICAL: Persist Apple's response before calling backend** (technical review): Apple provides name/email ONLY on first authorization. If backend call fails, data is lost permanently. iOS must: (1) save Apple's response (name, email) to UserDefaults immediately, (2) call backend, (3) clear UserDefaults on success. On failure, retry using saved data.
  - **Simplified SIWA flow** (round 3 — account linking deferred to v1.1):
    1. Lookup by `apple_user_id` → if found, login to that account
    2. If not found → create new user with `apple_user_id`, Apple's email (or relay), and Apple's name
    3. No email-matching, no account linking, no `POST /api/auth/apple/link` — if SIWA email matches existing email+password account, two accounts coexist. Merging is a v1.1 feature.
  - ~~**Apple credential revocation**~~ — Deferred to v1.1. Deleted/expired sessions naturally expire within 24h.
- ~~**Forgot-password flow**~~ — **Deferred to v1.1** (round 3 simplification). SIWA is primary iOS auth. Email+password users who forget can contact developer directly. Eliminates: transactional email dependency, `EMAIL_API_KEY`, reset token columns, hosted reset page.
- **Split auth routes** (round 3 — prevent 500-line monolith): `auth.js` (login/signup/logout/me), `auth-apple.js` (SIWA endpoint), `auth-account.js` (account deletion)
- **Create error code constants** (round 3): `server/src/constants/errors.js` exporting all structured error codes (`byok_key_required`, `byok_key_invalid`, etc.). iOS `APIError` enum mirrors these. Prevents string-matching drift.
- Add account deletion endpoint: `DELETE /api/auth/account` (in `auth-account.js`):
  - **CRITICAL (data integrity finding):** `purchases.seller_id` has NO CASCADE. Cannot hard-delete users who have sold decks.
  - Strategy: **Soft-delete for all users** (round 2 finding — `purchases.buyer_id ON DELETE CASCADE` would destroy seller payout audit trail). Set `users.deleted_at = NOW()`, set `users.token_revoked_at = NOW()` (invalidate all JWTs), anonymize PII (email → `deleted-{uuid}@deleted`, name → NULL, **display_name → NULL**, **apple_user_id → NULL**), null out sensitive fields (API key, tokens). **Scrub `decks.source_text` to NULL** for the deleted user (round 3 — may contain PII from user-pasted notes).
  - Delist all active marketplace listings for deleted sellers
  - Cancel pending payouts for deleted sellers (`seller_payout_status = 'refunded'`). **Exception:** payouts past hold period but not yet transferred should still be executed (round 3 — otherwise platform keeps money owed to seller).
  - **Subscription cancellation warning** (round 2 finding): Before deletion, check if user has active Apple subscription → show warning: "Deleting your account does not cancel your Apple subscription. Please cancel in Settings > Apple ID first." Do NOT auto-cancel — Apple IAP subscriptions can only be cancelled by the user.
  - Apple requires account deletion to complete within a "reasonable time" — the soft-delete satisfies this since PII is removed immediately

**2. Database migration (005)**
- File: `server/src/db/migrations/005_byok_and_iap.sql`

```sql
-- BYOK columns
ALTER TABLE users ADD COLUMN openrouter_api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN preferred_model TEXT;

-- Apple IAP columns
ALTER TABLE users ADD COLUMN apple_original_transaction_id TEXT;
ALTER TABLE users ADD COLUMN apple_subscription_product_id TEXT;
ALTER TABLE users ADD COLUMN apple_subscription_expires_at TIMESTAMPTZ;

-- Sign in with Apple support (security finding)
ALTER TABLE users ADD COLUMN apple_user_id TEXT UNIQUE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;  -- Apple-only users have no password

-- Soft-delete support (data integrity finding — purchases.seller_id has NO CASCADE)
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Token revocation kill switch (round 3 — replaces refresh tokens, simpler)
-- On logout/deletion/compromise: set token_revoked_at = NOW(), all JWTs issued before are rejected
ALTER TABLE users ADD COLUMN token_revoked_at TIMESTAMPTZ;

-- Plan CHECK constraint update (add 'byok_pro')
-- Use NOT VALID to avoid table scan under ACCESS EXCLUSIVE lock
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'trial', 'pro', 'byok_pro')) NOT VALID;
-- NOTE: VALIDATE CONSTRAINT moved to 005b_validate_plan_check.sql (round 3 fix —
-- running VALIDATE in same transaction as ADD CONSTRAINT defeats NOT VALID pattern)

-- Purchases table: add iap_transaction_id for Apple IAP purchases
ALTER TABLE purchases ADD COLUMN apple_iap_transaction_id TEXT;
ALTER TABLE purchases ALTER COLUMN stripe_payment_intent_id DROP NOT NULL;
-- Exactly one of stripe or apple must be set (XOR — prevents ambiguous payment source)
ALTER TABLE purchases ADD CONSTRAINT purchases_payment_source_check
  CHECK (
    (stripe_payment_intent_id IS NOT NULL AND apple_iap_transaction_id IS NULL)
    OR (stripe_payment_intent_id IS NULL AND apple_iap_transaction_id IS NOT NULL)
  );
ALTER TABLE purchases ADD CONSTRAINT purchases_apple_unique UNIQUE (apple_iap_transaction_id);

-- Seller payout hold (security finding — prevent refund fraud)
ALTER TABLE purchases ADD COLUMN seller_payout_eligible_at TIMESTAMPTZ;
ALTER TABLE purchases ADD COLUMN seller_payout_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (seller_payout_status IN ('pending', 'eligible', 'paid', 'refunded'));

-- MANDATORY BACKFILLS (NOT optional — must run in migration, not as comments)
-- Backfill existing Stripe purchases as 'paid' (they were already settled — without this,
-- payout processing will attempt duplicate Stripe Connect transfers for historical purchases)
UPDATE purchases SET seller_payout_status = 'paid' WHERE stripe_payment_intent_id IS NOT NULL;

-- Round 3: pending_iap_purchases table REMOVED — use UserDefaults on iOS instead.
-- Listing context persisted client-side before purchase, read on crash recovery.

-- Apple webhook idempotency (round 3 fix — was unspecified, risk of double-processing)
CREATE TABLE processed_apple_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_uuid TEXT UNIQUE NOT NULL,
  notification_type TEXT NOT NULL,
  signed_date TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fix purchases.deck_id FK to allow buyer deck deletion (round 3 — default RESTRICT blocks DELETE)
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_deck_id_fkey;
ALTER TABLE purchases ALTER COLUMN deck_id DROP NOT NULL;
ALTER TABLE purchases ADD CONSTRAINT purchases_deck_id_fkey
  FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE SET NULL;

-- Indexes for new columns
CREATE INDEX idx_users_apple_original_txn ON users (apple_original_transaction_id) WHERE apple_original_transaction_id IS NOT NULL;
CREATE INDEX idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_purchases_payout_status ON purchases (seller_payout_status) WHERE seller_payout_status = 'pending';

-- Add separate migration file: 005b_validate_plan_check.sql
-- Contents: ALTER TABLE users VALIDATE CONSTRAINT users_plan_check;
```

**3. Encryption module**
- File: `server/src/services/encryption.js`
- AES-256-GCM using Node.js `crypto` module
- **No key versioning prefix in v1** (round 3 simplification): format is `iv:authTag:ciphertext`. Add `v2:` prefix when you actually rotate keys — any value without a `v` prefix is v1.
- **AAD (Additional Authenticated Data)**: bind ciphertext to user ID so encrypted key can't be copy-pasted between user rows
- `encrypt(plaintext, userId)` → returns `iv:authTag:ciphertext`
- `decrypt(encrypted, userId)` → returns plaintext (AAD mismatch = throw)
- New env var: `ENCRYPTION_KEY` (32-byte hex string)
- Never log decrypted values

**4. iOS Xcode project setup**
- Create `ios/` directory in project root
- New Xcode project: `AINotecards`, SwiftUI lifecycle, iOS 17+ deployment target
- Configure StoreKit Configuration file for testing (`.storekit`)
- Register IAP products in App Store Connect:
  - **CRITICAL: Pro and BYOK Pro MUST be in the same subscription group** (technical review — without this, users can hold two active subscriptions simultaneously, and tier switching doesn't work). Create subscription group "AI Notecards Pro" with both products.
  - `com.ainotecards.pro.monthly` (auto-renewable, $9/mo) — Level 1 in subscription group
  - `com.ainotecards.byokpro.monthly` (auto-renewable, $5/mo) — Level 2 in subscription group (downgrade from Pro, upgrade from nothing)
  - `com.ainotecards.deck.tier1` through `com.ainotecards.deck.tier5` (consumables, $1-$5)
- Set up `KeychainManager.swift` — wrapper around Security framework
  - Store: JWT token, refresh token, OpenRouter API key (local cache)
  - Use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
  - `kSecAttrSynchronizable: false` (no iCloud sync of tokens/keys)
- Set up `APIClient.swift` — **plain class** (not actor — URLSession is already thread-safe)
  - Inject Bearer token from AuthManager
  - 401 → attempt refresh token → retry once → fail to login screen
  - Typed `APIError` enum
  - Generic `request<T: Decodable>` method
  - **Per-route timeouts**: 120s for `/api/generate`, 30s for everything else
- Set up `AuthManager.swift` — @Observable class
  - 24h JWT lifecycle, stored in Keychain
  - Login, signup, Sign in with Apple, logout, account deletion
  - Auto-login on app launch: check JWT expiry locally, if expired → route to login
  - On 401 from any API call → route to login (no refresh flow)
- ~~`NetworkMonitor.swift`~~ — **Eliminated** (round 3 simplification). Handle `URLError.notConnectedToInternet` reactively from URLSession failures. Show error inline ("No internet connection") rather than a persistent banner.
- **`TransactionObserver` on `@main` App struct** (round 2 finding — NOT in a View):
  - `Transaction.updates` listener must persist across entire app lifecycle
  - Start in `AINotecards.swift` `init()`, not in any SwiftUI View's `.task` modifier
  - Handles unfinished transactions, subscription changes, revocations
  - **Must wait for auth to complete before attempting purchase recovery** (round 3 — if app crashed mid-purchase, auth may not be ready when `Transaction.updates` fires)
- ~~**Navigation: `Router` class per tab**~~ — **Simplified** (round 3). Use `@State var path = NavigationPath()` directly in each tab's view. No separate `Router.swift` file. Sufficient for v1's simple list → detail navigation.
- **Register custom URL scheme `ainotecards://`** — needed for:
  - Stripe Connect onboarding return
  - Handle via `.onOpenURL` modifier on root view
- **Stripe Connect onboarding: use `ASWebAuthenticationSession`, NOT `SFSafariViewController`** (technical review — SFSafariViewController does not reliably redirect via custom URL schemes). `ASWebAuthenticationSession` explicitly supports custom scheme callbacks and presents the correct system UI. Set `callbackURLScheme: "ainotecards"`. The session completes when Stripe redirects to `ainotecards://stripe-connect/return`.

**Success criteria:**
- [ ] Backend accepts both cookie and Bearer token auth (including `/api/auth/me` with correct 401 vs `{ user: null }` behavior)
- [ ] 24h JWT works for both web and iOS (kill switch via `token_revoked_at` verified)
- [ ] `deleted_at IS NULL` check in authenticate middleware prevents soft-deleted user access
- [ ] Web client still works with cookies (no regression — test login, generate, marketplace, settings)
- [ ] Sign in with Apple endpoint works (users created without password, no account linking in v1)
- [ ] Account deletion works (soft-delete, PII anonymized including `display_name`/`apple_user_id`/`source_text`)
- [ ] Migration 005 + 005b run cleanly
- [ ] Encryption module encrypts/decrypts correctly with AAD (no version prefix)
- [ ] Error code constants file created, used in all new endpoints
- [ ] iOS app builds and runs
- [ ] Can sign up, log in, and log out from iOS app
- [ ] JWT stored securely in Keychain
- [ ] Logout sets `token_revoked_at`, invalidating all sessions

#### Phase 2: Core Features (Generation + Study + Decks)

**1. Generation flow**
- `GenerateView.swift` — text input, title field, generate button
- Input validation:
  - Min 10 chars (client-side)
  - **Free/Pro users: max ~30K chars** (performance finding — platform pays for these tokens, cap to control costs)
  - **BYOK users: max 200K chars** (user pays, let them go bigger)
- Loading state with activity indicator ("Generating your flashcards...")
- Call `POST /api/generate` with Bearer token
- **iOS timeout: 120s** for generation requests (longer than default 30s)
- Handle errors: rate limit (show paywall), AI failure (show retry), network (show offline message)
- On success: navigate to new deck
- **Backend addition**: Add server-side request timeout of 90s on `/api/generate` route. Add per-provider timeouts: Groq 30s, Gemini 45s, OpenRouter 80s. **Timeout layering: iOS (120s) > server (90s) > provider (80s).**
- **Backend addition** (round 3 — security fix): **Server-side input length validation**: reject if `input.length > 30000` for Free/Pro/Trial, `input.length > 200000` for BYOK Pro. Must be enforced server-side regardless of client behavior (any HTTP client can bypass iOS limits).
- **Backend addition** (round 3 — security fix): **Truncate `source_text` to 5000 chars on storage** — the `decks` table stores full user input indefinitely. 5000 chars is enough for display context; don't store the full 200K BYOK input.
- **Backend addition** (round 2 + round 3 fix): Set per-route body parser limits. **Round 3 fix: remove global `express.json()` from `index.js` line 31** — it parses at 1MB before route-specific middleware runs, defeating per-route limits. Instead: apply `express.json({ limit: '500kb' })` on `/api/generate` router, `express.json({ limit: '100kb' })` on all other API routes, keep `express.raw()` on `/webhooks/stripe-connect` only.
- **Backend addition** (round 2): Batch card inserts — `generate.js` does 30 sequential INSERTs. Use single multi-row INSERT: `INSERT INTO cards (deck_id, front, back) VALUES ($1,$2,$3), ($4,$5,$6)...`. Saves ~400ms on Supabase.
- **Backend addition** (round 2): Consolidate user queries — `checkTrialExpiry` + `checkGenerationLimits` + BYOK key fetch = 3 DB queries per generation. Merge into 1 query returning plan, generation count, trial expiry, and encrypted key.

**2. Deck management**
- `DashboardView.swift` — list of user's decks with card count, creation date
- Pull-to-refresh to sync from backend
- **No offline caching in v1** (simplification — defer to v1.1). All views require network.
- `DeckDetailView.swift` — view all cards, edit card text (front/back), add card, delete card, delete deck
- Existing endpoints: `GET /api/decks`, `GET /api/decks/:id`, `PATCH /api/decks/:id`, `DELETE /api/decks/:id`, `POST /api/decks/:id/cards`, `PATCH /api/decks/:deckId/cards/:cardId`, `DELETE /api/decks/:deckId/cards/:cardId`

**3. Study mode**
- `StudyView.swift` — card flip animation (3D rotation), tap to flip
- Mark known/unknown buttons
- Progress indicator (card X of Y)
- Session summary at end (score, percentage)
- Haptic feedback on flip and on completion
- Call `POST /api/study` to start, `PATCH /api/study/:id` to complete
- After studying a purchased deck: prompt for 1-5 star rating

**4. Navigation structure**
- `NavigationStack` with `NavigationPath` for programmatic navigation
- Tab bar: Home | Generate | Marketplace | Settings
- `@Environment(\.colorScheme)` for light/dark theme adaptation

**Success criteria:**
- [ ] Can generate flashcard decks from pasted notes
- [ ] Input size caps enforced (30K for Free/Pro, 200K for BYOK)
- [ ] Server-side request timeout (90s) and per-provider timeouts work
- [ ] Can view, edit, and delete decks and individual cards
- [ ] Study mode works with card flip animation and haptics
- [ ] Study sessions are tracked and study score increments
- [ ] Pull-to-refresh syncs from backend
- [ ] Navigation feels native and fluid

#### Phase 3: BYOK

**1. Backend — BYOK endpoints (simplified)**
- File: `server/src/routes/settings.js` (extend existing)
- `PUT /api/settings/api-key` — encrypt with AES-256-GCM (with AAD), store in `users.openrouter_api_key_encrypted`. Send `null` body to remove key (eliminates separate DELETE endpoint).
- ~~`POST /api/settings/api-key/validate`~~ — **Eliminated.** Key is validated on first generation attempt. If invalid, return `byok_key_invalid` error and user is directed to settings.
- ~~`PUT /api/settings/model`~~ — **Merged into existing `PATCH /api/settings`.** Add `preferred_model` as optional field.
- ~~`GET /api/settings/models`~~ — **Eliminated.** Hardcode curated list of ~10 popular models in `Constants.swift` (e.g., `claude-sonnet-4-5`, `gpt-4o`, `llama-3.3-70b`). Update via app update.

**2. Backend — AI service update**
- File: `server/src/services/ai.js`
- Add OpenRouter as third provider
- When user has `plan = 'byok_pro'` and has stored key: decrypt key, use OpenRouter with user's key and preferred model
- When user is Free/Pro: existing Groq/Gemini flow (no change)
- **CRITICAL (round 2 — revenue exploit prevention):** When user is `byok_pro` but has NO stored key, return `{ error: 'byok_key_required', message: 'Please add your OpenRouter API key in Settings' }`. Do **NOT** fall back to platform keys — this would give $5/mo users unlimited generations using platform's Groq/Gemini keys instead of $9/mo Pro.
- Error handling — map OpenRouter HTTP errors to user-facing messages:
  - `401` → `{ error: 'byok_key_invalid', message: 'Your OpenRouter API key is invalid. Check Settings.' }`
  - `402` → `{ error: 'byok_insufficient_credits', message: 'Your OpenRouter account has insufficient credits.' }`
  - `429` → `{ error: 'byok_rate_limited', message: 'Rate limited by OpenRouter. Try again in a moment.' }`
  - `502` → `{ error: 'byok_provider_down', message: 'The AI model is temporarily unavailable. Try a different model.' }`

**3. Backend — Plan middleware update**
- File: `server/src/middleware/plan.js`
- Add `byok_pro` to plan enum
- `byok_pro` users: skip `checkGenerationLimits` (unlimited generations)
- Add basic rate limiting for BYOK (e.g., max 60 requests/hour to prevent abuse — backend still has to process and store)
- `requirePlan` accepts `byok_pro` alongside `pro` for seller features
- **CRITICAL (round 3):** Update ALL 4 existing `requirePlan('pro')` calls in `seller.js` (lines 17, 129, 215, 292) to `requirePlan('pro', 'byok_pro')` — easy to miss

**4. iOS — BYOK settings UI (simplified)**
- `BYOKSettingsView.swift`
- Requires BYOK Pro subscription (show paywall if not subscribed)
- API key input field (SecureField, paste support)
- "Save Key" → calls `PUT /api/settings/api-key` (validation happens on first generation, not upfront)
- Show masked key if stored (last 4 chars: `sk-or-...xxxx`)
- "Remove Key" → calls `PUT /api/settings/api-key` with null body
- Model picker: **hardcoded curated list from `Constants.swift`**, grouped by provider (~10 models)
- In-app guidance: link to OpenRouter key creation page, explain different model costs/capabilities
- Store key locally in Keychain as cache (so we can show masked version without backend call)

**Success criteria:**
- [ ] Can enter, validate, save, and delete OpenRouter API key
- [ ] Key is encrypted at rest in database (verify with direct DB query)
- [ ] BYOK Pro users get unlimited generations using their own key and chosen model
- [ ] Clear error messages when key is invalid or has no credits
- [ ] Model picker shows available models
- [ ] Free/Pro users see BYOK as locked with upgrade prompt

#### Phase 4: Subscriptions (Apple IAP)

**1. StoreKit 2 integration (iOS)**
- `StoreKitManager.swift` — @Observable class
- Load products on init: `Product.products(for: productIDs)`
- `SubscriptionStoreView` for paywall with custom marketing content
- `Transaction.updates` listener started at app launch (in `AINotecards.swift`)
- `Transaction.currentEntitlements` checked at launch to rebuild subscription state
- Set `appAccountToken` to user's backend UUID on purchase (for server reconciliation)
- On successful purchase: send transaction ID to backend for verification
- Handle `.pending`, `.userCancelled` states
- Always call `transaction.finish()` after granting access
- Restore purchases button in Settings (uses `AppStore.sync()`)

**2. Backend — Apple IAP verification**
- Install: `npm install @apple/app-store-server-library apple-signin-auth`
- File: `server/src/routes/iap.js`
- **Two `SignedDataVerifier` instances** (round 2 finding): one for production, one for sandbox. Sandbox transactions arrive even in production (TestFlight, reviewer devices). Check production first, fall back to sandbox.
- `POST /api/iap/verify` — receives `transactionId` and `originalTransactionId` from iOS app
  - Use `SignedDataVerifier` to verify JWS transaction (try production, then sandbox)
  - **Verify `appAccountToken` matches authenticated user's UUID** (security finding — prevents token replay across accounts)
  - Check product ID to determine tier (pro vs byok_pro)
  - Update user's plan, store `apple_original_transaction_id` and `apple_subscription_expires_at`
  - Return updated user object
- `POST /api/iap/verify-purchase` — for marketplace consumable purchases
  - Verify transaction, extract product ID (tier1-tier5)
  - **Verify `appAccountToken` matches authenticated user**
  - **CRITICAL: Verify IAP product tier matches listing's actual `price_cents`** (security finding — prevents buying $1 tier for a $5 listing)
  - **Check `pending_iap_purchases` table for listing context** (security finding — prevents orphaned transactions if app crashes between purchase and verification)
  - **Self-purchase prevention**: reject if `listing.seller_id === req.user.id`
  - Run existing purchase fulfillment (copy deck to buyer)
  - Record `apple_iap_transaction_id` in purchases table
  - **Set `seller_payout_eligible_at = NOW() + INTERVAL '14 days'`** (security finding — hold period prevents refund fraud)

**3. Backend — App Store Server Notifications V2**
- File: `server/src/routes/iap.js`
- `POST /webhooks/apple` — receives signed notifications from Apple
  - **Body parsing** (round 2 finding): Apple sends JSON with JWS-signed payload (NOT raw body HMAC like Stripe). Must use `express.json()` for this route, not `express.raw()`. Fix: in `server/src/index.js`, apply `express.raw()` only to `/webhooks/stripe-connect`, not all `/webhooks/*` paths.
  - Use `SignedDataVerifier` to decode and verify `signedPayload` (verify nested signed data too — `signedTransactionInfo` and `signedRenewalInfo` inside notifications are also JWS)
  - **Idempotency + ordering** (round 3 fix — was unspecified): Before processing, check `processed_apple_notifications` table by `notificationUUID`. If already exists → return 200 (skip). For state-changing notifications, compare `signedDate` against user's `last_apple_notification_date` (new column or derive from table) — reject if `signedDate` is older than last processed for this user (handles out-of-order delivery, which Apple does not guarantee).
  - Handle notification types:
    - `SUBSCRIBED` (INITIAL_BUY, RESUBSCRIBE) → upgrade plan, **clear `trial_ends_at = NULL`** (round 3 — prevents stale trial checks later)
    - `SUBSCRIBED` (UPGRADE) → immediate plan change (e.g., BYOK Pro → Pro). **Both products are in same subscription group, so Apple handles proration automatically.**
    - `SUBSCRIBED` (DOWNGRADE) → plan change takes effect at next renewal period end. Log intent, no immediate action.
    - `DID_RENEW` → extend subscription expiry
    - `DID_CHANGE_RENEWAL_STATUS` (AUTO_RENEW_DISABLED) → log, no immediate action
    - `EXPIRED` → downgrade to free, **clear `apple_subscription_product_id = NULL`, `apple_subscription_expires_at = NULL`** (round 3 — prevents stale middleware checks). Delist marketplace listings. Keep encrypted BYOK key in DB (user can resubscribe and reuse).
    - ~~`DID_FAIL_TO_RENEW` (GRACE_PERIOD) → set `subscription_grace_period_ends_at`~~ — **Deferred to v1.1** (round 3 simplification). For v1, subscription simply expires when Apple gives up retrying billing.
    - `REFUND` → For subscriptions: downgrade to free. For marketplace consumables: set `purchases.seller_payout_status = 'refunded'` if payout still pending. **Do NOT revoke buyer's deck access** (they already have a copy; revoking creates poor UX). Track refund-to-purchase ratio per buyer to detect abuse. (round 3 — was underspecified)
    - `REVOKE` → revoke access, downgrade to free
  - **Also handle:** If user has existing Stripe subscription when Apple subscription activates, cancel Stripe subscription (`stripe.subscriptions.cancel()`) to prevent dual subscription state. (round 3 — was unspecified)
  - Insert into `processed_apple_notifications` after successful processing
  - Return HTTP 200 to acknowledge
- New env vars: `APPLE_BUNDLE_ID`, `APPLE_KEY_ID`, `APPLE_ISSUER_ID`, `APPLE_IAP_KEY` (path to .p8 file)

**4. iOS — Paywall trigger points**
- Generation limit reached → show PaywallView
- Attempt to list deck on marketplace (requires Pro/BYOK Pro) → show PaywallView
- BYOK settings (requires BYOK Pro) → show PaywallView
- Trial expiry banner on dashboard → link to PaywallView
- Settings → "Manage Subscription" → link to Apple subscription management

**5. Backend — Plan middleware update for Apple IAP**
- `checkTrialExpiry` — also check `apple_subscription_expires_at` for Apple-sourced subscriptions
- Source of truth: for Apple subscriptions, the backend's stored expiry date (updated by webhooks) is authoritative

**Success criteria:**
- [ ] Can purchase Pro and BYOK Pro subscriptions via Apple IAP
- [ ] Backend correctly verifies transactions and upgrades plan
- [ ] App Store Server Notifications update subscription state
- [ ] Subscription state persists across app restarts
- [ ] Restore purchases works on new device
- [ ] Paywall shown at correct trigger points
- [ ] Grace period handling works (user keeps access during billing retry)
- [ ] Cancellation flows through correctly (access until period end, then downgrade)

#### Phase 5: Marketplace

**1. Browse and search (iOS)**
- `MarketplaceView.swift` — list/grid of marketplace listings
- Category filter (horizontal scroll chips)
- Search bar (full-text search via existing `GET /api/marketplace?search=`)
- Sort: popular, newest, rating, price
- Cursor-based pagination (load more on scroll)
- `ListingDetailView.swift` — title, description, card preview (first 3 cards), price, rating, card count
- Purchase button → triggers consumable IAP for matching price tier
- Flag button → `POST /api/marketplace/:id/flag`
- Rating display (stars + average)

**2. Marketplace purchases (iOS)**
- Map listing `price_cents` to product ID: `100→tier1, 200→tier2, 300→tier3, 400→tier4, 500→tier5`
- Purchase flow (round 3 — uses UserDefaults instead of `pending_iap_purchases` table):
  1. User taps "Purchase $X"
  2. **Persist intent to UserDefaults**: `UserDefaults.standard.set(["listingId": listingId, "priceCents": priceCents], forKey: "pendingPurchase_\(productId)")` — crash recovery context stored client-side
  3. StoreKitManager initiates `product.purchase(options: [.appAccountToken(userUUID)])`
  4. On success: send `transactionId` + `listingId` + `expectedPriceCents` to `POST /api/iap/verify-purchase`
  5. Backend verifies transaction, **validates `expectedPriceCents` matches listing's current `price_cents`** (round 3 security fix — prevents price-change-during-purchase exploit), runs fulfillment (copy deck), records purchase
  6. Call `transaction.finish()`
  7. Clear UserDefaults entry for this purchase
  8. Navigate to purchased deck
- **Recovery on app launch**: `Transaction.updates` listener checks for unfinished transactions → read `listingId` + `priceCents` from UserDefaults → re-send to backend. **Must wait for auth to complete first** (round 3 — auth may not be ready when `Transaction.updates` fires on launch).

**3. Backend — Marketplace purchase via IAP**
- File: `server/src/routes/iap.js` (extend)
- `POST /api/iap/verify-purchase` body: `{ transactionId, listingId, expectedPriceCents }`
  - Verify Apple transaction
  - Extract price from product ID tier
  - **Validate `expectedPriceCents` matches `listing.price_cents`** (round 3 security fix — seller may change price between buyer's IAP and verification). If mismatch, reject with `{ error: 'listing_price_changed' }`.
  - Check listing exists and is active
  - **Call forked `fulfillPurchase()`** (round 3 fix — existing function hardcodes `ON CONFLICT (stripe_payment_intent_id)`). Pass `{ paymentSource: 'apple', appleIapTransactionId }`. Function uses `ON CONFLICT (apple_iap_transaction_id) DO NOTHING` for IAP path.
  - Record purchase with `apple_iap_transaction_id`
  - Calculate seller payout: 50% of gross price. Store as `platform_fee_cents` in purchase record.
  - **Do NOT execute Stripe Connect transfer immediately** — set `seller_payout_eligible_at = NOW() + INTERVAL '14 days'`
- Idempotent via `ON CONFLICT (apple_iap_transaction_id) DO NOTHING`
- **Batch card inserts** (round 2, same as generate route): `purchase.js` currently does 30 sequential INSERTs. Use single multi-row INSERT. **Also fix existing SQL injection** in dead code at lines 177-189 (interpolates `newDeckId` into SQL string — use parameterized query).

**4. Seller flow (iOS)**
- `SellerDashboardView.swift` — earnings, listing stats, payout history
- Stripe Connect onboarding via `ASWebAuthenticationSession` (technical review — `SFSafariViewController` does not reliably support custom URL scheme redirects). Existing `POST /api/seller/onboard` returns URL. Set `callbackURLScheme: "ainotecards"`, handle return URL to verify Connect status.
- Connect return handling via custom URL scheme (`ainotecards://stripe-connect/return`)
- `ListDeckView.swift` — select deck, fill title/description/category/tags/price, submit
- Manage listings: delist, relist, edit
- Existing endpoints all work as-is

**5. Backend — Seller payout updates (with hold period)**
- File: `server/src/services/purchase.js` (extend)
- **Decouple purchase fulfillment from seller payout** (architecture finding — buyer gets deck immediately, seller gets paid after hold period)
- When purchase source is Apple IAP:
  - Calculate seller payout = `price_cents * 0.50` (50% of gross)
  - Platform fee = `price_cents * 0.50` (absorbs Apple's 15% from this share)
  - **Set `seller_payout_eligible_at = NOW() + INTERVAL '14 days'`** — hold period prevents refund fraud
  - **Do NOT execute Stripe Connect transfer immediately**
- **Payout processing** (daily cron or manual trigger):
  - Query purchases where `seller_payout_status = 'pending' AND seller_payout_eligible_at <= NOW()`
  - Execute Stripe Connect transfer to seller's connected account
  - Update `seller_payout_status = 'paid'`
- **Refund handling**: if Apple sends REFUND notification before `seller_payout_eligible_at`, set `seller_payout_status = 'refunded'` — no transfer needed
- Handle Stripe transfer failures gracefully (retry, alert admin)

**6. Ratings (iOS)**
- After completing study session on a purchased deck: show star rating modal
- 1-5 tappable stars, submit via `POST /api/ratings`
- Existing backend handles atomic average update

**7. Admin**
- ~~`AdminFlagsView.swift`~~ — **Eliminated** (simplification). Use existing web admin at `/admin/flags` instead.
- Admin endpoints remain unchanged — iOS app does not need admin UI in v1.
- If admin access is needed on mobile, use Safari on the phone to access the web admin.

**8. Backend — Marketplace security fixes (round 3)**
- **Fix `GET /api/marketplace/:id`**: Add `AND ml.status != 'removed'` filter — currently exposes listings removed for policy violations via direct URL.
- **Fix seller name display for deleted sellers**: All marketplace queries showing seller name should use `COALESCE(u.display_name, 'Deleted User')` instead of raw `u.display_name`.
- **Fix `express.raw()` scope**: In `index.js`, change `app.use('/webhooks', express.raw(...))` to `app.use('/webhooks/stripe-connect', express.raw(...))` — Apple webhook at `/webhooks/apple` needs `express.json()`.
- **Add API version to health endpoint**: Extend `GET /api/health` response to include `{ minClientVersion: "1.0.0" }`. iOS checks on launch and shows force-update alert if below minimum.

**TODO/Placeholders for v2:**
```swift
// TODO: v2 — Add external payment link option for marketplace purchases
// When Apple allows or when implementing Stripe Direct:
// - Show "Pay with Card" option alongside IAP
// - Link to Stripe Checkout hosted page
// - Saves user ~15% (no Apple commission)
// See brainstorm: docs/brainstorms/2026-03-12-ios-swift-rewrite-byok-brainstorm.md
```

**Success criteria:**
- [ ] Can browse, search, and filter marketplace listings
- [ ] Can purchase decks via consumable IAP
- [ ] Purchased decks appear in user's library
- [ ] Sellers receive payouts via Stripe Connect
- [ ] Can create, edit, delist, and relist marketplace listings
- [ ] Ratings work (star display, submission, average updates)
- [ ] Content flagging works
- [ ] Admin moderation queue works
- [ ] v2 TODOs placed in payment-related code

#### Phase 6: Polish and App Store Submission

**1. iOS native design**
- System light/dark theme via `@Environment(\.colorScheme)`
- Warm parchment color palette adapted for both modes
- SF Symbols throughout (replace any web icon usage)
- Haptic feedback: card flip (light impact), generation complete (success notification), purchase (success)
- Smooth animations: card flip (3D rotateY), list transitions, loading states
- ~~Liquid glass effects~~ — **Deferred** (iOS 26 not publicly available). Design with standard SwiftUI for iOS 17+. Add liquid glass as progressive enhancement when iOS 26 ships.
- Dynamic Type support (accessibility)

**2. ~~Offline support~~ → Deferred to v1.1**
- **v1: All features require network.** Show clear offline state when no connectivity.
- **v1.1: Add SwiftData caching** for decks/cards, enable offline study mode.
- This significantly reduces v1 complexity (no sync logic, no conflict resolution, no stale data handling).

**3. App Store compliance**
- Privacy Policy and Terms of Service (hosted URLs, linked in app)
- Account deletion in Settings (calls `DELETE /api/auth/account`)
- Restore purchases button in Settings
- `SKStoreReviewController` prompts at moments of delight (after first successful study session, after 5th generation)
- App Tracking Transparency: not required if no tracking SDKs (confirm during implementation)
- Content reporting mechanism (flag button on marketplace listings — already implemented)

**4. App Store Connect setup**
- App name, subtitle, keywords (100 chars, no duplicates across fields, singular forms)
- Screenshots (iPhone 15 Pro Max + iPhone SE sizes minimum)
- App Preview video (optional, 15-30 seconds)
- Privacy labels (data collected: email, name, payment info, usage data)
- Age rating
- Review notes for Apple (explain BYOK, explain marketplace, explain seller payouts)

**5. TestFlight**
- Internal testing first (developer only)
- External TestFlight with 20-50 beta testers
- Watch for crashes, paywall friction, IAP issues
- Collect feedback before App Store submission

**Success criteria:**
- [ ] App looks and feels native with consistent design language
- [ ] Light and dark mode work correctly
- [ ] Clear offline state shown when no connectivity (no crash, graceful handling)
- [ ] Account deletion works end-to-end (soft-delete for ALL users)
- [ ] Restore purchases works
- [ ] TestFlight beta complete with no critical issues
- [ ] App Store submission approved

## System-Wide Impact

### Interaction Graph

- iOS purchase → StoreKit 2 → App Store Server Notification V2 → `POST /webhooks/apple` → plan upgrade in DB → next API call from iOS gets new tier permissions
- BYOK key save → `PUT /api/settings/api-key` → encrypt with AES-256-GCM → store in `users` table → next `POST /api/generate` → decrypt key → call OpenRouter
- Marketplace IAP purchase → consumable product → `POST /api/iap/verify-purchase` → verify transaction → copy deck (existing fulfillment) → Stripe Connect transfer to seller
- Seller onboard → `POST /api/seller/onboard` → ASWebAuthenticationSession → Stripe Connect → webhook → `connect_charges_enabled = true`

### Error Propagation

- **OpenRouter API failure (BYOK)**: `ai.js` catches, returns `{ error: 'byok_key_invalid' }` → iOS shows "Your API key may be invalid or out of credits" → user directed to BYOK settings
- **Apple IAP verification failure**: Backend returns 400 → iOS does NOT call `transaction.finish()` → transaction retried on next launch
- **Stripe Connect transfer failure**: Logged, admin alerted. Seller payout retried. Purchase still completed (buyer has deck).
- **Decryption failure** (corrupted key): Caught in `ai.js`, returns `{ error: 'byok_key_required' }` → user prompted to re-enter key. **INVARIANT: `plan === 'byok_pro'` must ALWAYS result in either (a) valid decrypted key used with OpenRouter, or (b) request rejected. NEVER fall through to Groq/Gemini fallback for byok_pro users — this is a revenue exploit.**

### State Lifecycle Risks

- **Partial IAP fulfillment**: Transaction verified but deck copy fails mid-transaction → database transaction rollback prevents partial state. Transaction not finished, so StoreKit retries.
- **Subscription webhook arrives before client**: Backend updates plan → next iOS API call sees new tier. No conflict — backend is source of truth.
- **BYOK key update during active generation**: Generation uses key decrypted at request start. New key takes effect on next request. No conflict.
- **App crash between IAP purchase and backend verification** (deepened): `pending_iap_purchases` table + `Transaction.updates` on next launch enables recovery. The listing context is preserved server-side.
- **Seller deletion with existing purchases** (deepened): Soft-delete preserves FK integrity. Purchases still reference the (anonymized) seller row. Pending payouts for deleted sellers should be cancelled.
- **Refund after seller payout** (deepened): 14-day hold period means most refunds are caught before payout. If payout already sent, platform absorbs the loss (tracked for abuse patterns).

### API Surface Parity

All existing web endpoints remain unchanged. iOS app calls the same endpoints with Bearer token instead of cookies. New endpoints added for IAP and BYOK only.

| New Endpoint | Purpose |
|---|---|
| `POST /api/auth/apple` | Sign in with Apple (HMAC-nonce validated, create-only in v1) |
| `DELETE /api/auth/account` | Account deletion (soft-delete, PII scrub, token revocation) |
| `PUT /api/settings/api-key` | Store or remove BYOK key (null body = remove) |
| `PATCH /api/settings` | Extended — now accepts `preferred_model` field |
| `POST /api/iap/verify` | Verify subscription purchase |
| `POST /api/iap/verify-purchase` | Verify marketplace purchase (with price-tier + price-change validation) |
| `POST /webhooks/apple` | App Store Server Notifications V2 (with idempotency + ordering) |

**Endpoints eliminated (rounds 1-3 simplification):**
- ~~`DELETE /api/settings/api-key`~~ → merged into `PUT` with null body
- ~~`POST /api/settings/api-key/validate`~~ → validate on first generation attempt
- ~~`PUT /api/settings/model`~~ → merged into existing `PATCH /api/settings`
- ~~`GET /api/settings/models`~~ → hardcoded client-side
- ~~`POST /api/auth/apple/link`~~ → account linking deferred to v1.1 (round 3)
- ~~`POST /api/auth/refresh`~~ → replaced by 24h JWT + `token_revoked_at` kill switch (round 3)
- ~~`POST /api/auth/forgot-password`~~ → deferred to v1.1 (round 3)
- ~~`POST /api/auth/reset-password`~~ → deferred to v1.1 (round 3)
- ~~`POST /api/iap/pending-purchase`~~ → replaced by UserDefaults client-side storage (round 3)

## Acceptance Criteria

### Functional Requirements

- [ ] Native iOS app with SwiftUI, deployed to App Store
- [ ] All core features working (generation, study, auth, tiers, BYOK, marketplace, seller, ratings, native polish)
- [ ] Apple IAP for all subscriptions and marketplace purchases
- [ ] BYOK users can set their own OpenRouter key and choose model
- [ ] BYOK users get unlimited generations
- [ ] Marketplace 50/50 split with Stripe Connect payouts to sellers (manual trigger)
- [ ] Existing web frontend and backend continue working (no regressions — test login, generate, marketplace, settings)
- [ ] Sign in with Apple supported (create-only in v1, no account linking)
- [ ] ~~Forgot password / password reset flow~~ → Deferred to v1.1
- [ ] Account deletion supported (soft-delete, PII scrub including `source_text`/`display_name`/`apple_user_id`)
- [ ] Restore purchases supported
- [ ] Pro ↔ BYOK Pro subscription switching works (same subscription group)
- [ ] v2 TODOs/placeholders for Stripe Direct payments in codebase

### Non-Functional Requirements

- [ ] iOS 17+ deployment target
- [ ] Light/dark mode support
- [ ] ~~Offline study mode~~ → Deferred to v1.1
- [ ] Haptic feedback on key interactions
- [ ] SF Symbols used throughout
- [ ] BYOK keys encrypted at rest (AES-256-GCM with AAD, no version prefix)
- [ ] 24h JWT stored in iOS Keychain, `token_revoked_at` kill switch on server
- [ ] `deleted_at IS NULL` checked in authenticate middleware
- [ ] All IAP transactions verified server-side with `appAccountToken` validation (dual verifier: prod + sandbox)
- [ ] Pro + BYOK Pro in same subscription group with correct level ordering
- [ ] ~~Grace period billing warning~~ → Deferred to v1.1
- [ ] BYOK without key returns error, does NOT fall back to platform keys (invariant enforced)
- [ ] Self-purchase prevention on marketplace
- [ ] 14-day seller payout hold period (manual payout trigger)
- [ ] Generation request timeouts (90s server, 120s iOS, per-provider)
- [ ] Server-side input length validation (30K Free/Pro, 200K BYOK)
- [ ] `source_text` truncated to 5000 chars on storage
- [ ] Apple webhook idempotency via `processed_apple_notifications` table
- [ ] Apple webhook ordering via `signedDate` comparison
- [ ] Marketplace detail endpoint filters `status != 'removed'`
- [ ] Error code constants shared between backend and iOS

### Quality Gates

- [ ] TestFlight beta with 20+ testers, no critical bugs
- [ ] Backend tests pass with new endpoints
- [ ] StoreKit tested in Sandbox environment (both prod and sandbox verifiers)
- [ ] IAP refund flow tested (before and after payout hold period)
- [ ] BYOK encryption/decryption tested with edge cases
- [ ] SIWA tested (new user creation, first-auth data persistence via UserDefaults)
- [ ] ~~Forgot-password flow~~ → Deferred to v1.1
- [ ] ~~Refresh token family tracking~~ → Eliminated (24h JWT)
- [ ] Migration 005 + 005b tested against existing data (backfills, FK changes, constraint validation)
- [ ] Backfill verification: no existing Stripe purchases show 'pending' payout status
- [ ] Subscription group: Pro ↔ BYOK Pro upgrade/downgrade tested in Sandbox
- [ ] ~~Grace period billing banner~~ → Deferred to v1.1
- [ ] Web client regression test (still works with 7-day cookies after auth changes)
- [ ] ASWebAuthenticationSession tested for Stripe Connect onboarding flow

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|---|---|---|
| Apple Developer Account ($99/year) | Required | Needed for App Store Connect, IAP, SIWA |
| Apple Small Business Program enrollment | Required | Apply immediately for 15% commission |
| App Store Connect IAP product setup | Required | 2 subscriptions + 5 consumables |
| App Store Server Notifications V2 URL | Required | HTTPS endpoint on backend |
| `.p8` signing key from App Store Connect | Required | For server-side IAP verification |
| `@apple/app-store-server-library` npm package | Required | Server-side JWS verification |
| `apple-signin-auth` npm package | Required | SIWA identity token verification |
| ~~Transactional email service~~ | ~~Required~~ | ~~Deferred to v1.1 with forgot-password (round 3)~~ |
| ~~`EMAIL_API_KEY` env var~~ | ~~Required~~ | ~~Deferred to v1.1 (round 3)~~ |
| `ENCRYPTION_KEY` env var | Required | 32-byte hex for AES-256-GCM |
| Stripe Connect (existing) | Ready | Already implemented for web |
| Express backend (existing) | Ready | All core endpoints exist |
| PostgreSQL (existing) | Ready | New migration needed |

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| App Store rejection (IAP compliance) | Medium | High | Follow Apple guidelines precisely, include clear review notes, TestFlight first |
| StoreKit 2 edge cases (grace period, family sharing, ask to buy) | Medium | Medium | Test thoroughly in Sandbox, handle all Transaction states |
| Marketplace consumable IAP rejected by Apple Review | Low | High | Consumable with server-managed entitlements is a common pattern (used by Roblox, gaming apps). Backup: explore Apple's Advanced Commerce API |
| BYOK key security breach | Low | High | AES-256-GCM, encryption key in env var (not in code), never log decrypted keys |
| OpenRouter API changes | Low | Low | OpenRouter uses OpenAI-compatible API; changes are rare and backwards-compatible |
| Liquid glass unavailable (iOS 26 not shipped) | Medium | Low | Design for iOS 17+ first, add liquid glass as progressive enhancement |
| ~~Refresh token theft~~ | ~~Low~~ | ~~High~~ | Eliminated — 24h JWT with `token_revoked_at` kill switch (round 3) |
| ~~SIWA hostile account takeover~~ | ~~Low~~ | ~~High~~ | Eliminated — SIWA is create-only in v1, no account linking (round 3) |
| Apple pays platform ~45 days out but sellers expect 14-day payout | Medium | Medium | Manual payouts from platform Stripe balance; document cash flow constraint |
| Subscription group misconfiguration (dual active subscriptions) | Low | High | Both products in same group; test upgrade/downgrade in Sandbox before launch |
| Out-of-order Apple webhooks cause incorrect state | Medium | High | `signedDate` comparison + `processed_apple_notifications` dedup table (round 3) |
| Price change during marketplace purchase | Low | Medium | `expectedPriceCents` validated at verification time (round 3) |

## Future Considerations (Not in v1)

- **v1.1: Offline caching** — SwiftData for decks/cards, offline study mode, sync on reconnect
- **v1.1: Liquid glass** — iOS 26 design language, progressive enhancement
- **v1.1: iOS admin view** — `AdminFlagsView.swift` for on-device moderation
- **v1.1: SIWA account linking** — email-match with password-confirmed merge for existing accounts
- **v1.1: Forgot-password flow** — transactional email, reset tokens, hosted reset page
- **v1.1: Refresh tokens** — if 24h JWT proves too short, add refresh flow with family tracking
- **v1.1: Grace period handling** — `subscription_grace_period_ends_at`, billing warning banner
- **v1.1: Apple credential revocation** — server-to-server revocation handler
- **v2: Stripe Direct payments** — discounted subscriptions ($7.99/$3.99) and marketplace purchases via Stripe Payment Links. TODOs placed in v1 code.
- **v2: Android app** — Kotlin/Jetpack Compose hitting same Express API. No code sharing with iOS.
- **v2: Multi-admin/moderator roles** — additional admin accounts with role-based permissions
- **v2: Push notifications** — sale notifications for sellers, study reminders
- **v2: Widgets** — iOS home screen widget showing study streak or due decks
- **v2: Share decks via link** — free deck sharing outside marketplace
- **v2: Dynamic model list** — fetch from OpenRouter API instead of hardcoded list

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-12-ios-swift-rewrite-byok-brainstorm.md](docs/brainstorms/2026-03-12-ios-swift-rewrite-byok-brainstorm.md) — Key decisions carried forward: native Swift over cross-platform, server-side BYOK with AES encryption, Apple IAP only for v1, 50/50 marketplace split, consumable IAP for deck purchases

### Internal References

- AI service (Groq/Gemini): `server/src/services/ai.js`
- Auth middleware: `server/src/middleware/auth.js`
- Plan middleware: `server/src/middleware/plan.js`
- Purchase fulfillment: `server/src/services/purchase.js`
- Stripe routes: `server/src/routes/stripe.js`
- Seller routes: `server/src/routes/seller.js`
- Database migrations: `server/src/db/migrations/001-004`
- Project conventions: `CLAUDE.md`
- Indie iOS playbook: `apps/research/indie-ios-app-playbook.md`
- iOS marketplace breakdown: `apps/research/ios-app-marketplace-breakdown.md`

### External References

- [StoreKit 2 Documentation](https://developer.apple.com/storekit/)
- [App Store Server Notifications V2](https://developer.apple.com/documentation/appstoreservernotifications)
- [@apple/app-store-server-library (npm)](https://www.npmjs.com/package/@apple/app-store-server-library)
- [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [OpenRouter API](https://openrouter.ai/docs)
- [Node.js crypto — AES-256-GCM](https://nodejs.org/api/crypto.html)
