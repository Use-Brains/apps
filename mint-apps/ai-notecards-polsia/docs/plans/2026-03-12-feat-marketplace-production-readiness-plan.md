---
title: 'feat: Deck Marketplace, Tier Restructure, and Production Readiness'
type: feat
status: completed
date: 2026-03-12
origin: docs/brainstorms/2026-03-12-marketplace-and-production-brainstorm.md
deepened: 2026-03-12
---

<!-- FINISHED -->

# Deck Marketplace, Tier Restructure, and Production Readiness

## Enhancement Summary

**Deepened on:** 2026-03-12 (2 rounds) | **Scope refined:** 2026-03-12 (BYOK, moderation, email deferred to v2)
**Research agents used:** Security Sentinel, Architecture Strategist, Performance Oracle, Data Integrity Guardian, Spec Flow Analyzer, Frontend Design Skill, Stripe Connect Docs Researcher, Supabase Best Practices Researcher, Marketplace UX Researcher, Code Simplicity Reviewer, Trial/Subscription Lifecycle, Supabase Migration & Deployment

> Research from Encryption Best Practices and Content Moderation Deep-Dive agents is preserved in v2 reference sections below.

### Key Improvements (v1 scope)

1. **Webhook security** — Stripe signature verification mandatory, raw body parsing before JSON parser, two separate endpoints (platform + Connect)
2. **Database schema hardened** — `NUMERIC(3,2)` for ratings, atomic SQL updates for counters, CHECK/NOT NULL constraints, full-text search via `tsvector`, composite partial indexes
3. **Architecture restructured** — purchase logic extracted to `services/purchase.js`, list/delist in `seller.js`, versioned migration system (Phase 0 prerequisite)
4. **Performance** — cursor-based pagination, Supavisor session mode pooling (cap 12), HTTP caching headers
5. **Spec flow gaps resolved** — Q5/Q6 contradiction clarified (purchase = copy, listing = live preview), free/trial permissions specified, refund policy statement required
6. **UI design system** — editorial luxury aesthetic with DM Serif Display + Outfit + JetBrains Mono, warm parchment palette, skeleton loading states
7. **MVP scope simplified** — BYOK tier, automated moderation, and email service deferred to v2 (~80 files, down from ~112)
8. **Trial/subscription lifecycle** — state machine mapped (trial→free, trial→pro, cancel, payment failure→downgrade), request-time tier enforcement
9. **Production deployment** — Railway + Cloudflare Pages + Supabase (~$30/mo at launch). Connection pooling, Sentry monitoring, security hardening.

### Key Considerations

- Supabase free tier pauses after 7 days — upgrade to Pro ($25/mo) before launch
- Two separate Stripe webhook endpoints (platform + Connect), each with its own signing secret
- `express.raw()` required on webhook routes BEFORE JSON parser — signature verification breaks otherwise
- Copy-on-purchase: read source data outside write transaction to avoid lock contention
- Stripe `missing_payment_method: 'cancel'` auto-cancels when trial ends without payment method
- `cancel_at_period_end: true` for voluntary cancellation (preserves access through billing period)
- Supabase session mode pooler (port 5432) for Express; transaction mode breaks `SET` commands
- RLS not needed — all DB access goes through Express middleware with auth checks
- _v2: separate `user_api_keys` table for BYOK encryption, OpenAI Moderation API for automated content filtering, NCMEC/DMCA registration_

---

## MVP Scope Decisions (2026-03-12)

The following simplifications are applied for v1. The original deep-dive research is preserved in this document as reference for v2.

| Decision                  | v1 (this plan)                                                                       | v2 (future)                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **Tiers**                 | Two tiers: Free ($0, 1 gen/day, 10 decks) + Pro ($9/mo, 10 gen/day, unlimited decks) | Add BYOK tier ($5/mo, unlimited gen with user's own API keys)                                     |
| **Content moderation**    | Simple "Report" button + `suspended` boolean on users. Manual review via admin page. | 3-layer pipeline: `obscenity` → `decancer` → OpenAI Moderation API with category-aware allowlists |
| **Seller badges**         | Deferred                                                                             | New → Verified badge system                                                                       |
| **Flag abuse prevention** | Simple one-flag-per-user-per-listing                                                 | False-flag penalties, 30-day bans                                                                 |
| **Rating revision**       | One-time rating after first completion                                               | Revise on subsequent completions                                                                  |
| **Webhook processing**    | Direct idempotent handlers (no Redis/BullMQ)                                         | Queue-based single-writer via BullMQ if scale requires                                            |
| **Email service**         | Deferred — TODO placeholders in code                                                 | Trial reminders, dunning emails, email verification via SendGrid/Resend                           |
| **BYOK encryption**       | Deferred — no `encryption.js`, no key columns on users                               | AES-256-GCM with versioned keyring, HMAC blind index                                              |
| **Supabase**              | Project exists (upgrade to Pro before launch). Connection strings in `server/.env`.  | Same                                                                                              |

**Estimated file count with simplifications: ~80 files** (down from ~112).

---

## Overview

Transform AI Notecards from a local dev project into a production-ready, revenue-generating SaaS with two major additions: (1) migrate to Supabase for production hosting with a Free/Pro tier structure, and (2) build a full marketplace where Pro users buy and sell flashcard decks via Stripe Connect.

This plan carries forward decisions from the [brainstorm](docs/brainstorms/2026-03-12-marketplace-and-production-brainstorm.md), resolves open questions from SpecFlow analysis, and applies MVP scope simplifications (BYOK deferred, moderation simplified, email deferred).

## Problem Statement / Motivation

The app currently runs on localhost with a local PostgreSQL database — it cannot serve real users. There is no way for users to share or monetize the decks they create. These changes unlock the app's core revenue model: subscriptions (Free/Pro tiers) + marketplace commission (50/50 split via Stripe Connect).

## Key Decisions Carried Forward from Brainstorm

1. **Supabase** for production Postgres (connection string swap, no code changes)
2. **Two tiers (v1)**: Free ($0, 1 gen/day, 10 decks) + Pro ($9/mo, 10 gen/day, unlimited). _BYOK tier deferred to v2._
3. **7-day Pro trial** for all signups
4. **Stripe Connect Express** for seller payouts — 50/50 split, immediate payouts
5. **Copy-on-purchase** — buyer gets a snapshot, can edit freely, cannot resell
6. **13 categories + free-text tags** — no subcategories at launch
7. **Encouraged rating** after completing a purchased deck (1-5 stars, skippable)
8. **Study Score** = total decks completed (simple count, public on profiles)
9. **Manual moderation (v1)** — Report button + admin review. _3-layer automated pipeline deferred to v2._
10. **25/30 soft/hard card cap** enforced via AI prompt
11. **$1-$5 whole-dollar pricing** set by sellers
12. **No refunds** — 10% card preview + ratings = buyer protection
13. **No email service (v1)** — email verification, trial reminders, and dunning emails deferred. TODO placeholders in code.

### Research Insights: Scope & Simplification Opportunities

**The code simplicity review challenged several decisions. Consider before implementation:**

- **BYOK tier adds ~15-20% of total complexity** (encryption service, key management, provider validation, HMAC blind index, key rotation). If LLM cost management isn't validated as a user need, consider launching with two tiers (Free + Pro $8-10/mo) and adding BYOK later. This is the single largest complexity reduction available.
- **Automated moderation can be replaced by manual review at MVP scale.** A "Report" button that emails you + a `suspended` boolean on users covers the same ground with ~8 fewer files. Add automation when volume exceeds manual review capacity.
- **Seller badges** (New → Verified) solve a scale problem you don't have yet. Defer until you have enough sellers that discovery is a real problem.
- **Flag abuse prevention** (false-flag penalties, 30-day bans) is solving for problems that require significant user volume to manifest. A simple "Report" button is sufficient at launch.
- **Rating revision on subsequent completions** adds complexity. One-time rating after first completion is simpler for MVP.
- **Downgrade cron** can be replaced by checking subscription status on each authenticated request, which is both simpler and more responsive.

**If all simplifications are applied, the estimated file count drops from ~112 to ~80.**

**Decision (2026-03-12): All simplifications ACCEPTED for v1. BYOK deferred, moderation simplified to Report+suspend, seller badges deferred, flag abuse prevention deferred, rating revision deferred, downgrade via request-time check (no cron). See "MVP Scope Decisions" table above.**

## Resolved SpecFlow Gaps

The following critical questions were surfaced during flow analysis and are resolved here:

| #   | Question                                    | Resolution                                                                                                                                                                                |
| --- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Who absorbs Stripe fees on $1 sales?        | Platform absorbs from its 30% cut. At $1 the platform loses ~$0.03 per sale — acceptable at low volume as user acquisition cost. Revisit if $1 sales exceed 30% of transactions.          |
| Q2  | How is trial tracked/enforced?              | `trial_ends_at` column on `users`. Checked on every authenticated request (no cron — request-time check auto-downgrades). Trial users cannot sell, so no listing delist needed on expiry. |
| Q3  | Can trial users sell?                       | **No.** Selling requires a paid Pro subscription. Trial users get marketplace buy access and full Pro generation limits, but cannot list decks. Prevents free-rider exploit.              |
| Q4  | Free-tier 10-deck limit vs purchased decks? | **Purchased decks are exempt** from the 10-deck limit. The limit only applies to generated/manually-created decks. Free users can buy unlimited marketplace decks.                        |
| Q5  | What fields are copied on purchase?         | Copy: `title`, all `cards` (front, back, position). Exclude: `source_text`, `description`, `category`, `tags`. Set `origin = 'purchased'`, `purchased_from_listing_id`.                   |
| Q6  | Is marketplace listing live or frozen?      | **Live view** — listing reflects current deck state. v1: re-run basic validation on edits. _v2: re-run automated moderation filter on significant edits._                                 |
| Q7  | Can buyers purchase same deck twice?        | **No.** Block with "You already own this deck" message. Show link to their existing copy.                                                                                                 |
| Q8  | Can users update their rating?              | v1: **No** — one-time rating after first completion. _v2: allow revision on subsequent completions._                                                                                      |
| Q9  | BYOK key failure handling?                  | _Deferred to v2._ Show clear error: "Your [Provider] API key is no longer valid" with link to Settings. Fall back to platform keys with no-BYOK limits (10/day) until key is fixed.       |
| Q10 | Profanity filter vs medical/science terms?  | _Deferred to v2 (automated moderation)._ Category-aware allowlists will relax filters for Medical, Science categories.                                                                    |
| Q11 | Repeated content flags consequences?        | v1: admin manually suspends sellers based on reports. _v2: automated thresholds (3 upheld = review, 5 upheld = auto-suspend)._                                                            |
| Q12 | Seller dashboard scope?                     | Minimal: total earnings, per-deck breakdown, last 30 days trend, payout status from Stripe.                                                                                               |
| Q13 | Forced rating or encouraged?                | **Strongly encouraged** — prominent modal after deck completion, small "Skip" link. Avoids app store rejection risk.                                                                      |
| Q14 | Default marketplace sort?                   | "Most Popular" (purchase count) default. Alternatives: Newest, Highest Rated, Price Low/High.                                                                                             |
| Q15 | Empty category handling?                    | Show all 13 categories. Empty ones display "Be the first to publish in [Category]" prompt.                                                                                                |
| Q16 | Listing mutability + moderation?            | Listings are live. v1: re-run basic validation on edits. _v2: re-run programmatic filter on edits; auto-delist if filter fails._                                                          |
| Q17 | Pro downgrade + BYOK keys?                  | _Deferred to v2._ On downgrade: BYOK keys retained but inactive. On re-subscribe to BYOK tier, keys reactivate. No deletion.                                                              |
| Q18 | Duplicate title detection scope?            | **Per-category**, not global. Multiple sellers can have "Biology 101" but not two from the same seller in the same category.                                                              |
| Q19 | Flag abuse prevention?                      | v1: each user can flag each listing once (UNIQUE constraint). _v2: rate limit (5/day/user), false-flag penalty (3+ dismissed = 30-day flagging ban)._                                     |
| Q20 | Email verification?                         | _Deferred to v2 (requires email service)._ Will be required before Stripe Connect onboarding. v1: rely on Stripe's own KYC during Connect onboarding.                                     |

### Research Insights: Additional Spec Gaps Discovered

**Critical gaps requiring resolution before implementation:**

| #   | Gap                                                                                                                                  | Recommended Resolution                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q21 | **Q5 vs Q6 contradiction**: Q5 says purchase creates a copy, Q6 says listing is a live view. These are architecturally incompatible. | **Clarification:** Purchase creates a **snapshot copy** (Q5 governs buyer's deck). The "live view" in Q6 applies only to the **marketplace listing preview page** — not to owned copies. Buyers get a frozen snapshot at time of purchase. |
| Q22 | **Can free-tier users purchase from the marketplace?**                                                                               | **Yes.** Free users can browse and purchase. Purchased decks are exempt from the 10-deck limit (Q4). This maximizes marketplace liquidity.                                                                                                 |
| Q23 | **Can free/trial users rate and flag?**                                                                                              | **Yes.** Any user who has purchased and completed a deck can rate it. Any authenticated user can flag content.                                                                                                                             |
| Q24 | **What happens to decks exceeding free-tier limit on downgrade?**                                                                    | Excess decks become **read-only** (viewable and studyable but not editable or generatable). No deletion.                                                                                                                                   |
| Q25 | **What constitutes "completing" a deck for the rating prompt?**                                                                      | All cards seen at least once in a study session (i.e., `completed_at IS NOT NULL` on `study_sessions`).                                                                                                                                    |
| Q26 | **Which cards are shown in the 10% preview?**                                                                                        | **First N cards in deck order** (by position). Not random, not seller-chosen. Buyers can judge content progression.                                                                                                                        |
| Q27 | **Is the subscription downgrade immediate or at billing period end?**                                                                | **End of billing period** (Stripe default). User retains Pro features for the remainder of their paid period.                                                                                                                              |
| Q28 | **Refund policy statement**                                                                                                          | "No refunds" must be explicitly stated and agreed to at checkout. Add a checkbox or notice before Stripe redirect: "Digital purchases are non-refundable." Required for legal defensibility.                                               |
| Q29 | **Trial expiry timing**                                                                                                              | Trial ends at the **exact signup timestamp + 7 days**, not at midnight. Checked at request time.                                                                                                                                           |
| Q30 | **Maximum listings per seller**                                                                                                      | **50 active listings** to prevent marketplace flooding.                                                                                                                                                                                    |
| Q31 | **Minimum card count for listing**                                                                                                   | **10 cards minimum** (raised from 5) to ensure buyer value at $1-$5 price points.                                                                                                                                                          |

### Research Insights: User Flow Permissions Matrix (v1 — 2-tier)

| Capability               | Free                 | Trial     | Pro                     |
| ------------------------ | -------------------- | --------- | ----------------------- |
| Browse marketplace       | Yes                  | Yes       | Yes                     |
| Purchase decks           | Yes                  | Yes       | Yes                     |
| Generate (platform keys) | 1/day                | 10/day    | 10/day                  |
| Deck storage limit       | 10 (excl. purchased) | Unlimited | Unlimited               |
| List decks for sale      | No                   | No        | Yes (if Stripe Connect) |
| Rate purchased decks     | Yes                  | Yes       | Yes                     |
| Report content           | Yes                  | Yes       | Yes                     |

_v2 adds: Pro BYOK tier with unlimited generation via user's own API keys, BYOK key management page._

## Technical Approach

### Architecture

The marketplace extends the existing Express + React architecture. No new services — all new functionality is additional Express routes, React pages, and Postgres tables.

**New server modules:**

- `server/src/routes/marketplace.js` — browse, search, list, delist, purchase
- `server/src/routes/seller.js` — Stripe Connect onboarding, earnings dashboard
- `server/src/routes/settings.js` — profile editing _(v2: BYOK key management)_
- `server/src/routes/ratings.js` — submit ratings
- `server/src/routes/admin.js` — reported content review queue
- `server/src/middleware/plan.js` — tier/limit checking middleware
- `server/src/services/purchase.js` — purchase orchestration (Stripe charge, deck copy, record creation)
- _(v2: `server/src/services/moderation.js` — 3-layer automated content filter)_
- _(v2: `server/src/services/encryption.js` — AES-256-GCM encrypt/decrypt for BYOK keys)_

**New client pages:**

- `client/src/pages/Marketplace.jsx` — category grid, search, browse
- `client/src/pages/MarketplaceDeck.jsx` — preview page with sample cards, buy button
- `client/src/pages/SellerDashboard.jsx` — earnings, listings management
- `client/src/pages/Settings.jsx` — profile _(v2: BYOK key management)_
- `client/src/pages/ListDeck.jsx` — listing form (category, tags, description, price)

**Modified files:**

- `server/src/db/migrate.js` — replaced by versioned migration runner (`migrator.js`)
- `server/src/routes/generate.js` — updated limits (1/day free, 10/day pro), use `plan.js` middleware
- `server/src/routes/stripe.js` — Connect onboarding, marketplace payments, additional webhooks
- `server/src/routes/auth.js` — expanded user fields, trial tracking
- `server/src/services/ai.js` — updated system prompt with 25/30 card limits. _v2: accept user API keys for BYOK._
- `server/src/middleware/auth.js` — trial expiry checking
- `server/src/index.js` — mount new routes, raw body parser for webhooks
- `client/src/App.jsx` — new routes
- `client/src/lib/api.js` — marketplace API methods
- `client/src/lib/AuthContext.jsx` — expanded user object (`study_score`, `plan`, `trial_ends_at`)
- `client/src/components/Navbar.jsx` — marketplace link, seller dashboard
- `client/src/pages/Pricing.jsx` — two tiers (Free + Pro $9/mo). _v2: add BYOK tier._
- `client/src/pages/Study.jsx` — rating prompt after completing purchased decks, Study Score increment
- `client/src/pages/Dashboard.jsx` — Study Score display, origin badges, purchased deck indicators

### Research Insights: Architecture Recommendations

**Must-do before implementation:**

1. **Implement versioned migrations.** The current single-script `migrate.js` uses `CREATE TABLE IF NOT EXISTS` which silently skips modifications to existing tables. Replace with sequential migration files (`001_initial.sql`, `002_marketplace.sql`, etc.) before Phase 1. This is a prerequisite for safely deploying schema changes to a production database with data.

2. **Extract purchase logic into `services/purchase.js`.** The purchase flow involves multi-service orchestration (Stripe charge, deck duplication in a transaction, purchase record, seller earnings). This should not live in `marketplace.js` — keep that file focused on read operations (browse, search, listing details).

3. **Move list/delist to `seller.js`.** These are seller-context write operations, not marketplace-browse operations. Mixing seller mutations with buyer reads in the same route file conflates two authorization contexts.

4. **Retrofit `generate.js` to use `plan.js` middleware.** The current inline tier-checking logic in `generate.js` (lines 16-42) must be replaced by the new `plan.js` middleware. Do not leave two parallel tier-enforcement mechanisms.

5. **Build Stripe webhook handler as a dispatcher.** The current webhook handler handles one event type. Connect adds 4-6 more. Use a dispatcher pattern:

   ```
   stripe.js (entry point) → handlers/checkout.js, handlers/connect.js
   ```

6. **Two separate webhook endpoints required.** Stripe Connect uses two webhook types with separate signing secrets:
   - Platform webhooks: `POST /webhooks/stripe` (e.g., `payment_intent.succeeded`)
   - Connect webhooks: `POST /webhooks/stripe-connect` (e.g., `account.updated`, `account.application.deauthorized`)

7. **Raw body parser for webhooks must come BEFORE JSON parser.** Express.js's `express.json()` breaks Stripe signature verification. Apply `express.raw({ type: 'application/json' })` on webhook routes, excluding them from global JSON parsing:

   ```javascript
   app.use((req, res, next) => {
     if (req.originalUrl.startsWith('/webhooks/')) {
       next(); // skip JSON parser
     } else {
       express.json()(req, res, next);
     }
   });
   ```

8. **Add request validation middleware.** With the API surface doubling, consider a lightweight schema validation approach (Zod or Joi) to keep route handlers focused on business logic.

### Database Schema Changes

#### ERD

```mermaid
erDiagram
    users ||--o{ decks : creates
    users ||--o{ study_sessions : studies
    users ||--o{ purchases : buys
    users ||--o{ ratings : rates
    users ||--o{ content_flags : reports
    decks ||--o{ cards : contains
    decks ||--o{ study_sessions : studied_in
    decks ||--o| marketplace_listings : listed_as
    marketplace_listings ||--o{ purchases : purchased_via
    marketplace_listings ||--o{ ratings : rated_on
    marketplace_listings ||--o{ content_flags : flagged_on
    marketplace_listings }o--|| marketplace_categories : belongs_to
    marketplace_listings ||--o{ listing_tags : tagged_with

    users {
        uuid id PK
        text email UK
        text password_hash
        text plan "free|trial|pro"
        timestamptz trial_ends_at
        text stripe_customer_id
        text stripe_subscription_id
        text stripe_connect_account_id
        boolean connect_charges_enabled
        boolean connect_payouts_enabled
        int daily_generation_count
        date last_generation_date
        int study_score
        boolean email_verified
        boolean suspended
        text suspended_reason
        text role "user|admin"
        timestamptz created_at
    }

    decks {
        uuid id PK
        uuid user_id FK
        text title
        text source_text
        text origin "generated|purchased"
        uuid purchased_from_listing_id FK
        timestamptz created_at
        timestamptz updated_at
    }

    cards {
        uuid id PK
        uuid deck_id FK
        text front
        text back
        int position
        timestamptz created_at
    }

    marketplace_listings {
        uuid id PK
        uuid deck_id FK UK
        uuid seller_id FK
        uuid category_id FK
        text title "snapshot from deck at list time"
        text description
        int price_cents
        text status "active|delisted|removed"
        int purchase_count
        numeric average_rating "NUMERIC(3,2)"
        int rating_count
        tsvector search_vector "GENERATED"
        timestamptz created_at
        timestamptz updated_at
    }

    marketplace_categories {
        uuid id PK
        text name UK
        text slug UK
        int sort_order
    }

    listing_tags {
        uuid id PK
        uuid listing_id FK
        text tag
    }

    purchases {
        uuid id PK
        uuid buyer_id FK
        uuid seller_id FK "denormalized for dashboard queries"
        uuid listing_id FK
        uuid deck_id FK "buyer's copy"
        int price_cents
        int platform_fee_cents
        text stripe_payment_intent_id UK
        timestamptz created_at
    }

    ratings {
        uuid id PK
        uuid user_id FK
        uuid listing_id FK
        int stars "1-5"
        timestamptz created_at
        timestamptz updated_at
    }

    content_flags {
        uuid id PK
        uuid listing_id FK
        uuid reporter_id FK
        text reason
        text status "pending|upheld|dismissed"
        text admin_notes
        timestamptz created_at
        timestamptz resolved_at
    }

    study_sessions {
        uuid id PK
        uuid user_id FK
        uuid deck_id FK
        int total_cards
        int correct
        timestamptz started_at
        timestamptz completed_at
    }
```

#### New tables

- **`marketplace_categories`** — 13 seeded rows, immutable at launch
- **`marketplace_listings`** — one per listed deck, tracks status/stats
- **`listing_tags`** — up to 5 per listing, free-text
- **`purchases`** — records every sale with Stripe payment reference
- **`ratings`** — one per user per listing, unique constraint `(user_id, listing_id)`
- **`content_flags`** — moderation queue, one flag per user per listing

#### Modified tables

- **`users`** — add: `trial_ends_at`, `stripe_subscription_id`, `stripe_connect_account_id`, `connect_charges_enabled`, `connect_payouts_enabled`, `study_score`, `email_verified`, `suspended`, `suspended_reason`, `role`. Update `plan` to include 'trial'. _v2: add BYOK columns (`plan_variant`, `encrypted_groq_key`, `groq_key_hmac`, `encrypted_gemini_key`, `gemini_key_hmac`)_
- **`decks`** — add: `origin` (default `'generated'`), `purchased_from_listing_id`

### Research Insights: Database Schema Hardening

**Critical fixes (implement in migration):**

1. **Change `average_rating` from `float` to `NUMERIC(3,2)`.** Floating-point introduces cumulative rounding errors. After hundreds of ratings, the displayed average drifts from the true value. Use exact decimal arithmetic:

   ```sql
   average_rating NUMERIC(3,2) DEFAULT 0.00
   ```

2. **Add full-text search via generated `tsvector` column on `marketplace_listings`:**

   ```sql
   ALTER TABLE marketplace_listings
     ADD COLUMN search_vector tsvector
     GENERATED ALWAYS AS (
       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
       setweight(to_tsvector('english', coalesce(description, '')), 'B')
     ) STORED;
   CREATE INDEX idx_listings_search ON marketplace_listings USING GIN (search_vector);
   ```

   Tags can be folded into the vector via a trigger (concatenate tag names weighted as 'C'). Do not use `ILIKE` across a joined tag table — that is O(listings \* tags).

3. **Use atomic SQL updates for denormalized counters** to prevent lost updates under concurrent access:

   ```sql
   -- On new rating:
   UPDATE marketplace_listings
   SET rating_count = rating_count + 1,
       average_rating = ((average_rating * rating_count) + $new_stars) / (rating_count + 1)
   WHERE id = $listing_id;

   -- On purchase:
   UPDATE marketplace_listings
   SET purchase_count = purchase_count + 1
   WHERE id = $listing_id;
   ```

   Never use read-modify-write patterns on these columns.

4. **Add NOT NULL constraints** to all critical columns:
   - `marketplace_listings`: `price_cents`, `status`, `purchase_count DEFAULT 0`, `rating_count DEFAULT 0`, `average_rating DEFAULT 0.00`
   - `purchases`: `price_cents`, `platform_fee_cents`, `stripe_payment_intent_id`, `created_at`
   - `ratings`: `stars`
   - `content_flags`: `reason`, `status DEFAULT 'pending'`
   - `listing_tags`: `tag`

5. **Add CHECK constraints** for business rules:

   ```sql
   ALTER TABLE marketplace_listings
     ADD CONSTRAINT chk_price_range CHECK (price_cents BETWEEN 100 AND 500),
     ADD CONSTRAINT chk_status CHECK (status IN ('active', 'delisted', 'removed'));
   ALTER TABLE ratings
     ADD CONSTRAINT chk_stars_range CHECK (stars BETWEEN 1 AND 5);
   ALTER TABLE content_flags
     ADD CONSTRAINT chk_flag_status CHECK (status IN ('pending', 'upheld', 'dismissed'));
   ```

6. **Add uniqueness constraints:**
   - `UNIQUE(listing_id, tag)` on `listing_tags` — prevents duplicate tags on same listing
   - `UNIQUE(buyer_id, listing_id)` on `purchases` — prevents double-purchase at DB level (defense in depth beyond app-level check)

7. **Add composite partial indexes** for common query patterns:

   ```sql
   CREATE INDEX idx_listings_cat_popular ON marketplace_listings (category_id, purchase_count DESC) WHERE status = 'active';
   CREATE INDEX idx_listings_cat_newest ON marketplace_listings (category_id, created_at DESC) WHERE status = 'active';
   CREATE INDEX idx_listings_popular ON marketplace_listings (purchase_count DESC) WHERE status = 'active';
   CREATE INDEX idx_purchases_seller_date ON purchases (seller_id, created_at DESC);
   CREATE INDEX idx_purchases_buyer ON purchases (buyer_id);
   CREATE INDEX idx_ratings_listing ON ratings (listing_id);
   CREATE INDEX idx_flags_pending ON content_flags (listing_id, status) WHERE status = 'pending';
   ```

   Start with the top 4; add others based on actual query analytics from `pg_stat_user_indexes`.

8. **Origin column migration strategy**: Adding `origin DEFAULT 'generated'` will retroactively label all existing decks. If all existing decks are truly generated, this is fine. Otherwise, use a two-step migration: (1) add column as nullable, (2) backfill, (3) add NOT NULL + default.

### Research Insights: Encryption Implementation (v2 Reference)

> **This entire section is deferred to v2 (BYOK tier).** Preserved as reference for when BYOK is implemented.

**AES-256-GCM implementation requirements (for `services/encryption.js`):**

1. **Generate a fresh random 12-byte IV for every encryption** via `crypto.randomBytes(12)`. IV reuse with the same key is catastrophic — it allows key recovery and ciphertext forgery.

2. **Store IV, authTag, and keyVersion alongside ciphertext** (either as separate columns or as `iv:ciphertext:authTag` format). These are not secret — they are integrity parameters.

3. **Always verify the 16-byte auth tag on decryption** — without this, GCM is effectively reduced to AES-CTR with no integrity protection.

4. **Use a versioned keyring pattern** for key rotation readiness from day one:

   ```
   ENCRYPTION_KEYS="1:base64key1,2:base64key2"  # highest version is current
   HMAC_SECRET="base64secret"
   ```

   Store `key_version` alongside encrypted data. New encryptions use the latest version. Old data remains readable with old key versions in the keyring.

5. **Use separate keys for encryption and HMAC** — compromise of one does not compromise the other.

6. **HMAC blind index for uniqueness**: The database `WHERE blind_index = $1` query is not vulnerable to timing attacks (the blind index is already a one-way HMAC). Application-level comparisons must use `crypto.timingSafeEqual`.

7. **Hardcode provider validation URLs** (Groq: `https://api.groq.com/openai/v1/models`, Gemini: `https://generativelanguage.googleapis.com/v1beta/models?key=`). Never allow user input to influence the outbound request URL — this prevents SSRF.

8. **Rate-limit key submission attempts** (e.g., 5 per hour per user) to prevent key-spraying attacks.

9. **Consider a separate `user_api_keys` table** instead of columns on `users` to limit exposure surface and simplify access control.

10. **KMS progression path**: Environment variables are acceptable for MVP. Move to a secrets manager (AWS Secrets Manager, Doppler) when you have paying customers. The keyring abstraction makes this a drop-in upgrade.

### Implementation Phases

#### Phase 0: Migration Infrastructure (Prerequisite)

**Before any other work, replace the single-script migration with versioned migrations.**

**Tasks:**

- [x] Create `server/src/db/migrations/` directory
- [x] Convert existing `migrate.js` schema to `001_initial.sql`
- [x] Build a simple sequential migration runner that tracks applied migrations in a `schema_migrations` table
- [x] Configure two connection strings: `DATABASE_URL` (session mode, port 5432) for app queries, `DATABASE_URL_DIRECT` (direct connection) for migrations
- [x] Verify the runner works against both local PostgreSQL and Supabase

**Why this is Phase 0:** Every subsequent phase depends on reliable, repeatable schema changes. `CREATE TABLE IF NOT EXISTS` silently skips modifications to existing tables, making column additions impossible to deploy safely.

#### Phase 1: Production Database + Tier Restructure

Foundation work. No marketplace yet — just get the app production-ready with correct tiers (2-tier: Free + Pro).

**Tasks:**

- [x] Configure Supabase connection: update `server/.env` with `DATABASE_URL` (session mode, port 5432) and `DATABASE_URL_DIRECT` (direct connection for migrations). Get connection strings from Supabase dashboard.
- [x] **Upgrade Supabase to Pro ($25/mo) before launch** — free tier pauses after 7 days of inactivity
- [x] Configure connection pooling: use Supavisor session mode (port 5432), cap Express pool to 12 connections, add `ssl: { rejectUnauthorized: false }`
- [x] Write migration `002_tiers_and_marketplace_prep.sql`: add columns to `users` (`plan` update to include 'trial', `trial_ends_at`, `stripe_subscription_id`, `study_score`, `email_verified`, `stripe_connect_account_id`, `connect_charges_enabled`, `connect_payouts_enabled`, `suspended`, `suspended_reason`, `role DEFAULT 'user'`) and `decks` (`origin DEFAULT 'generated'`, `purchased_from_listing_id`)
- [x] Create `server/src/middleware/plan.js` — middleware that checks tier limits: generation counts (1/day free, 10/day pro/trial), deck limits (10 for free, exempt for purchased)
- [x] **Retrofit `server/src/routes/generate.js`** — remove inline tier-checking, use new `plan.js` middleware instead
- [x] Update `server/src/services/ai.js` — update system prompt with 25/30 card soft/hard cap and auto-split logic. _v2: accept optional user API keys parameter for BYOK._
- [x] Create `server/src/routes/settings.js` — profile fields (display name for seller profile). _v2: BYOK key CRUD._
- [x] Update `server/src/routes/auth.js` — return expanded user fields, set `trial_ends_at = NOW() + 7 days` on signup
- [x] Update `server/src/middleware/auth.js` — on every authenticated request, check if `trial_ends_at` has passed → auto-set `plan = 'free'`
- [x] Update `server/src/routes/stripe.js` — handle single Pro Price ID ($9/mo), handle `customer.subscription.deleted` webhook for downgrade. _v2: add BYOK price ID._
- [x] **Ensure Stripe webhook signature verification** — `stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret)` on every webhook handler. Reject requests that fail verification with 400.
- [x] Exclude webhook routes from global `express.json()` — use `express.raw({ type: 'application/json' })` on `/webhooks/*`
- [x] Update `client/src/lib/AuthContext.jsx` — expanded user object with `plan`, `trial_ends_at`, `study_score`
- [x] Create `client/src/pages/Settings.jsx` — profile settings. _v2: BYOK key input form._
- [x] Update `client/src/pages/Pricing.jsx` — two-tier pricing (Free + Pro $9/mo). _v2: add BYOK tier card._
- [x] Update `client/src/pages/Study.jsx` — increment study_score on session completion (API call)
- [x] Update `client/src/pages/Dashboard.jsx` — show Study Score, trial countdown banner
- [x] Add Study Score increment endpoint to `server/src/routes/study.js`
- [x] Verify migration runs on Supabase, seed categories
- [ ] <!-- TODO: Email service — trial reminder emails (Day 1, 4, 6, 7), email verification flow. Research email provider (SendGrid/Resend) separately. -->

**Success criteria:**

- App connects to Supabase in production via session mode pooler (port 5432)
- Two tiers enforced correctly (free 1/day, pro 10/day)
- Trial auto-expires after 7 days (exact timestamp check on each request)
- Study Score increments and displays
- Webhook signature verification on all Stripe handlers
- Raw body parsing on webhook routes (before JSON parser)

**Estimated scope:** ~30 files touched/created (reduced from ~40 by deferring BYOK)

#### Phase 2: Marketplace Core — Listings, Browse, Purchase

Build the marketplace browsing and purchasing flow. Sellers can list, buyers can browse and buy.

**Tasks:**

- [x] Write migration v3: create `marketplace_categories` (seed 13 rows), `marketplace_listings` (with `search_vector` generated column, `NUMERIC(3,2)` for `average_rating`, NOT NULL + CHECK constraints), `listing_tags` (with `UNIQUE(listing_id, tag)`), `purchases` (with `UNIQUE(buyer_id, listing_id)`) tables
- [x] Add composite partial indexes for browse queries (category+popular, category+newest — start with these two)
- [x] Create `server/src/routes/marketplace.js` (read-only operations):
  - `GET /api/marketplace` — browse listings with category filter, full-text search via `search_vector @@ plainto_tsquery()`, sort, cursor-based pagination
  - `GET /api/marketplace/categories` — list all categories with listing counts (cache with `Cache-Control: public, max-age=3600`)
  - `GET /api/marketplace/:listingId` — preview page data (deck info, first N sample cards at 10% rounded up, seller info, ratings)
- [x] Add listing management to `server/src/routes/seller.js` (or create if not yet existing):
  - `POST /api/seller/listings` — create listing (Pro paid users only, not trial, max 50 active): category, tags, description, price, deck_id (must be `origin: 'generated'`, min 10 cards)
  - `PATCH /api/seller/listings/:listingId` — update listing (re-runs validation). _v2: re-runs automated moderation filter._
  - `DELETE /api/seller/listings/:listingId` — delist (set status to `delisted`)
- [x] Add listing validation in `seller.js` (not a separate moderation service for v1):
  - Minimum 10 cards check
  - Empty field check (title, description required)
  - Per-category duplicate title check (same seller, same category)
  - Returns `{ valid: boolean, reason?: string }`
  - <!-- TODO v2: Extract to `services/moderation.js` with 3-layer pipeline (obscenity → decancer → OpenAI Moderation API). See Content Moderation Architecture section. -->
- [x] Create `server/src/services/purchase.js` — extracted purchase orchestration:
  - Check listing is `status: 'active'`
  - Check `charges_enabled` on seller's connected Stripe account
  - Check buyer doesn't already own (query `purchases` table)
  - Create Stripe Checkout Session with `application_fee_amount` (30%) and `transfer_data.destination`, idempotency key `pi_create_${userId}_${listingId}`
  - No cart — direct checkout for single items
- [x] Implement purchase webhook handler:
  - Use `INSERT INTO purchases ... ON CONFLICT (stripe_payment_intent_id) DO NOTHING RETURNING id` for idempotency
  - Only proceed with deck copy if RETURNING produced a row
  - Read source deck+cards OUTSIDE the write transaction (avoids lock contention on popular decks)
  - Batch INSERT all cards in a single statement (not 30 individual INSERTs)
  - Atomic increment of `purchase_count` in same transaction
  - Return HTTP 200 even when purchase already exists (prevents Stripe retry loop)
- [x] Add "non-refundable digital purchase" notice before Stripe redirect
- [x] Create `client/src/pages/Marketplace.jsx` — horizontal scrollable category pills, search bar (prominent, full-width), listing cards with category accent bar/price/rating/card count, skeleton loading states
- [x] Create `client/src/pages/MarketplaceDeck.jsx` — preview page: flippable sample cards (CSS `rotateY(180deg)` with `perspective(800px)`), seller profile (Study Score), buy button (or sticky bottom bar on mobile), "You already own this" state, "Owned" badge in search results
- [x] Create `client/src/pages/ListDeck.jsx` — form: select generated deck, choose category, add tags (chip-style input, max 5), write description (500 char max with counter), set price ($1-$5 dropdown), real-time earnings preview ("You earn $X.XX after 50% platform fee")
- [x] Update `client/src/components/Navbar.jsx` — add "Marketplace" link
- [x] Update `client/src/lib/api.js` — marketplace API methods
- [x] Update `client/src/App.jsx` — new routes for marketplace pages
- [x] Update `client/src/pages/Dashboard.jsx` — show `origin` badge on decks (generated vs purchased), "List on Marketplace" button on eligible generated decks

**Success criteria:**

- Sellers can list generated decks with category, tags, description, price (min 10 cards, max 50 listings)
- Basic listing validation (required fields, min cards, duplicate title check)
- Buyers can browse by category, full-text search, filter, sort
- Preview page shows first 10% of cards (rounded up) as flippable cards
- Purchase creates a copy in buyer's library via idempotent webhook handler
- Stripe payment processed with correct 50/50 split via destination charges
- Duplicate purchase blocked at both app and DB level
- Cursor-based pagination on browse results
- Skeleton loading states on browse and preview pages

**Estimated scope:** ~25 files touched/created

#### Phase 3: Stripe Connect + Seller Dashboard

Enable seller payouts via Stripe Connect and build the seller-facing dashboard.

**Tasks:**

- [x] Create `server/src/routes/seller.js` (extend if already created in Phase 2):
  - `POST /api/seller/onboard` — create Stripe Connect Express account (prefill email, business_url BEFORE first Account Link), generate account link with `collection_options: { fields: 'eventually_due' }`, return URL
  - `GET /api/seller/onboard/refresh` — regenerate expired account link (Account Links are single-use)
  - `GET /api/seller/onboard/return` — handle return redirect, **verify** `charges_enabled` AND `details_submitted` via API (return URL does NOT mean onboarding is complete)
  - `GET /api/seller/dashboard` — earnings summary using single optimized query:
    ```sql
    SELECT
      SUM(price_cents - platform_fee_cents) as total_earnings_cents,
      SUM(price_cents) as total_gross_cents,
      COUNT(*) as total_sales,
      SUM(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN price_cents - platform_fee_cents ELSE 0 END) as last_30_earnings_cents
    FROM purchases WHERE seller_id = $1;
    ```
  - `GET /api/seller/listings` — seller's own listings with stats
- [x] Add Connect webhook handling as **separate endpoint** `POST /webhooks/stripe-connect` with its own `STRIPE_CONNECT_WEBHOOK_SECRET`:
  - `account.updated` — update `connect_charges_enabled`, `connect_payouts_enabled` on user. If `requirements.currently_due` has items, notify seller.
  - `account.application.deauthorized` — mark seller as disconnected, delist all active listings, cancel pending orders, notify ops
- [x] Gate listing creation on `charges_enabled` (not `payouts_enabled` — payouts may take additional days but charges can be accepted immediately)
- [ ] <!-- TODO: Email verification before Connect onboarding. Requires email service (SendGrid/Resend). For v1, skip email verification gate — rely on Stripe's own KYC during Connect onboarding. Add `email_verified` column but don't enforce it yet. -->
- [x] Create `client/src/pages/SellerDashboard.jsx` — stat cards (total earnings, listings count, avg rating) with countUp animation, earnings bar chart (last 30 days), listing management table (delist/relist), Stripe Connect onboarding CTA if not connected
- [x] Defer seller badge logic to post-launch (simplification recommendation)
- [x] Add `STRIPE_CONNECT_WEBHOOK_SECRET` to `.env.example`
- [x] Add `seller_id` index on `purchases` table for dashboard query performance

**Success criteria:**

- Sellers can onboard with Stripe Connect Express
- Account Links regenerate on expiry/revisit (refresh URL works)
- Payouts flow automatically on purchase (destination charges)
- Seller dashboard shows earnings and listing performance
- Connect webhook handles account status changes and deauthorization
- `charges_enabled` checked before allowing Checkout Session creation
- _v2: Email verification gates Connect onboarding (requires email service)_

**Estimated scope:** ~15 files touched/created

### Research Insights: Stripe Connect Implementation Details

**Key patterns from Stripe docs research:**

1. **Prefill KYC before first Account Link** — after creating the first Account Link, you lose API access to read/update KYC fields on Express accounts. Prefill everything (name, email, business URL) at `stripe.accounts.create()` time.

2. **`charges_enabled` vs `payouts_enabled` timing** — these become true at different times. Gate your "accept payments" logic on `charges_enabled`, not `payouts_enabled`. Funds accumulate in the connected account until payouts are enabled.

3. **Idempotency key pattern** — use domain-meaningful keys: `pi_create_order_${orderId}` rather than random UUIDs. Stripe caches responses for 24 hours and validates parameter consistency.

4. **Skipped transfers** — if a connected account loses capabilities after a charge succeeds, Stripe silently skips the transfer. Monitor `charge.updated` to detect this (check if `transfer_data` exists but `transfer` is null).

5. **Testing** — use Stripe CLI with `--forward-connect-to` flag to test both platform and Connect webhooks simultaneously:

   ```bash
   stripe listen \
     --forward-to localhost:3000/webhooks/stripe \
     --forward-connect-to localhost:3000/webhooks/stripe-connect
   ```

6. **Fraud responsibility** — your platform is financially liable for losses from Express connected accounts. Implement basic fraud screening before enabling selling.

#### Phase 4: Ratings + Content Reporting (Simplified Moderation)

**v1 approach:** Simple Report button + `suspended` boolean on users + admin review page. No automated content filtering. _v2: 3-layer pipeline (obscenity → decancer → OpenAI Moderation API) with category-aware allowlists. See "Content Moderation Architecture" section below for full v2 design._

**Tasks:**

- [x] Write migration `004_ratings_and_flags.sql`: create `ratings` (with `UNIQUE(user_id, listing_id)`, `CHECK(stars BETWEEN 1 AND 5)`) and `content_flags` (with `CHECK(status IN ('pending', 'upheld', 'dismissed'))`, `UNIQUE(listing_id, reporter_id)`) tables
- [x] Create `server/src/routes/ratings.js`:
  - `POST /api/ratings` — submit rating (1-5 stars, must have completed the deck via `study_sessions`, one per user per listing). One-time only for v1. _v2: allow revision on subsequent completions._
  - `GET /api/ratings/listing/:listingId` — ratings for a listing
- [x] Update listing `average_rating` and `rating_count` using **atomic SQL** (not read-modify-write):
  ```sql
  UPDATE marketplace_listings
  SET rating_count = rating_count + 1,
      average_rating = ((average_rating * rating_count) + $stars) / (rating_count + 1)
  WHERE id = $listing_id;
  ```
- [x] Create `server/src/routes/admin.js`:
  - `GET /api/admin/flags` — list reported content (pending status)
  - `PATCH /api/admin/flags/:id` — resolve flag (uphold → delist listing + optionally suspend seller, or dismiss)
  - `GET /api/admin/users/:id/suspend` / `unsuspend` — toggle `suspended` boolean
  - Admin auth: `requireRole('admin')` middleware that checks `role` column on `users`, composed after `authenticate`
- [x] Add report endpoint: `POST /api/marketplace/:listingId/flag` — one per user per listing (UNIQUE constraint), require a reason category (Inappropriate/Misleading/Spam/Low Quality/Other)
- [x] Update `client/src/pages/Study.jsx` — after completing a purchased deck, show rating modal (prominent but skippable). Show "New" badge instead of star average when listing has fewer than 3 ratings.
- [x] Update `client/src/pages/MarketplaceDeck.jsx` — show ratings, add "Report" button with reason selection modal
- [x] Build simple admin page at `/admin/flags` (protected, admin-only) — list of reported content, approve/dismiss actions, link to suspend seller
- [ ] <!-- TODO v2: Implement 3-layer automated moderation pipeline. See "Content Moderation Architecture" section. Add `obscenity`, `decancer` npm packages. Integrate OpenAI Moderation API (free). Category-aware allowlists for Medical/Science/History. Run at listing creation, edit, and generation output. -->
- [ ] <!-- TODO v2: Flag abuse prevention — false-flag penalties (3+ dismissed = 30-day ban), rate limits (5 flags/day/user) -->

**Success criteria:**

- Users can rate purchased decks after first completion (one-time)
- Ratings update listing averages via atomic SQL (no lost updates)
- Users can report listings with reason categories
- Admin can review reports and suspend sellers
- Suspended sellers' listings are auto-delisted

**Estimated scope:** ~10 files touched/created

#### Phase 5: Polish, Edge Cases, and Launch Prep

**Tasks:**

- [x] Update AI system prompt in `server/src/services/ai.js` with 25/30 card limits:
  - "Generate a maximum of 25 cards. If the content warrants more, split into multiple focused decks of ~15 cards each, naming them as Part 1, Part 2, etc."
  - Backend validation: reject/split any AI response exceeding 30 cards
- [ ] <!-- TODO v2: Handle BYOK key failure gracefully: catch provider auth errors in `services/ai.js`, return specific error codes, frontend shows "Key invalid" with Settings link, fall back to platform keys with 10/day limit -->
- [x] Cursor-based pagination on marketplace browse and search (already implemented in Phase 2, verify)
- [x] Offset pagination on seller's listing management (acceptable since dataset is small — seller's own listings)
- [x] Extract shared UI components: Button, Input, Modal, Card — reduce Tailwind duplication across pages
- [x] Landing page update: add marketplace section to value prop
- [x] Mobile responsiveness pass on all new pages:
  - Single-column card layout on mobile (<640px)
  - Sticky bottom buy bar on MarketplaceDeck preview page
  - Horizontally swipeable sample cards on mobile
  - Filters behind "Filter" button that opens bottom sheet
  - All touch targets minimum 44x44 points
- [x] Skeleton loading screens for marketplace browse and preview pages (not spinners — spinners only for actions like payment processing)
- [x] Error states for empty search results ("No decks found, try browsing by category"), failed purchases, network errors
- [x] Pro downgrade handling: check subscription status on each authenticated request (simpler than cron), delist marketplace listings synchronously on detected downgrade. _v2: retain BYOK keys (inactive) on downgrade._
- [x] Stripe fee economics logging: track platform revenue per sale to monitor $1 sale losses
- [x] HTTP caching headers: `Cache-Control: public, max-age=60, stale-while-revalidate=300` on marketplace browse, `max-age=3600` on categories
- [x] Bootstrap 20-30 quality decks across top 5-6 categories before any public launch (cold start mitigation)
- [x] Update `CLAUDE.md` with marketplace conventions, new routes, new env vars
- [x] Update `README.md` with marketplace setup instructions

**Success criteria:**

- All edge cases from SpecFlow analysis handled
- Cursor-based pagination on marketplace browse
- Mobile-responsive marketplace with sticky buy bar
- Skeleton loading states throughout
- Graceful error handling with actionable empty states
- Production deployment checklist complete
- Cold start content bootstrapped

**Estimated scope:** ~20 files touched/created

## System-Wide Impact

### Interaction Graph

Purchase flow: Buyer clicks Buy → `POST /api/marketplace/:id/purchase` → `services/purchase.js` checks listing active + seller `charges_enabled` + not already owned → creates Stripe Checkout Session with `application_fee_amount` + `transfer_data.destination` + idempotency key → Stripe processes payment → `payment_intent.succeeded` webhook fires → handler uses `INSERT ... ON CONFLICT DO NOTHING RETURNING id` → if row returned: reads source deck+cards (outside transaction), then in single transaction: copies deck+cards via batch INSERT, creates `purchases` record, atomically increments `purchase_count` → responds HTTP 200 to Stripe (even if already processed).

Rating flow: User completes study session → `PATCH /api/study/:id` (complete session) → frontend checks if deck is `origin: 'purchased'` and listing has not been removed → shows rating modal (prominent, skippable) → `POST /api/ratings` → backend atomically updates `average_rating` and `rating_count` on listing via single SQL statement.

BYOK flow: _Deferred to v2._ User submits key → `POST /api/settings/keys` (rate-limited: 5/hour) → backend calls hardcoded provider URL to validate → computes HMAC blind index with separate `HMAC_SECRET`, checks uniqueness via DB query → encrypts with AES-256-GCM using `randomBytes(12)` IV, stores ciphertext + IV + authTag + keyVersion → on next generation, `services/ai.js` loads keyring, decrypts user's key with correct version, constructs per-request client.

### Error Propagation

- Stripe Connect webhook failures: Stripe retries with exponential backoff. Webhook handler must be idempotent — use `ON CONFLICT DO NOTHING` on unique `stripe_payment_intent_id` and check `RETURNING` row count. Always return HTTP 200, even for already-processed events.
- BYOK key revocation: AI service catches auth errors, returns specific error code (`BYOK_KEY_INVALID`). Generate route translates to user-facing message. Falls back to platform keys with tier limits. The fallback should require user acknowledgment (not silent).
- Copy-on-purchase failure (mid-transaction): Read source deck+cards outside the write transaction. Wrap only the writes (deck copy, card batch INSERT, purchase record, purchase_count increment) in a single transaction. If any INSERT fails, ROLLBACK. Stripe payment is already captured — implement a reconciliation job that checks for payments without corresponding deck copies and completes them retroactively. For MVP: retry once, then log for manual resolution.

### State Lifecycle Risks

- **Trial expiry race condition**: User starts generating during trial, trial expires mid-request. Resolution: check trial status at request start, not mid-generation. If valid at start, allow completion.
- **Concurrent purchase + delist**: Seller delists while buyer is mid-checkout. Resolution: use `SELECT ... FOR UPDATE` on the listing row in the purchase transaction. Check listing status — if delisted, abort and refund.
- **Rating on deleted listing**: Buyer has a copy of a removed deck. On completion, rating endpoint checks if listing still exists. If removed, skip rating prompt (no listing to attach it to).
- **Concurrent rating updates**: Use atomic SQL updates (not read-modify-write) on `average_rating` and `rating_count`. Schedule weekly reconciliation cron to recompute from source `ratings` table for high-activity listings.
- **Double purchase TOCTOU**: Two browser tabs, both pass "not already owned" check before either webhook fires. Mitigated by: `UNIQUE(buyer_id, listing_id)` on `purchases` table + `ON CONFLICT DO NOTHING` in webhook handler.

### API Surface Parity

All marketplace actions available via API routes (no UI-only features). This supports future mobile apps or third-party integrations.

## Content Moderation Architecture (v2 Reference — Deep Dive)

> **This entire section is deferred to v2.** v1 uses a simple Report button + admin review. Preserved as the design spec for when automated moderation is implemented.

### Design Goal: Family-Friendly (PG-Rated)

This app must not surface content that would be rated R in any context. Moderation covers: profanity, slurs, hate speech, racism, sexism, homophobia, violence, gore, sexual content, illegal activity, drug promotion, criminal behavior, self-harm, harassment, and exploitation. The system must be robust against evasion attempts (Unicode homoglyphs, leetspeak, zero-width characters).

### 3-Layer Moderation Pipeline

Content passes through all three layers sequentially. Any layer can reject. Applied at: listing creation, listing edit (title/description/card changes), and deck generation (AI prompt output).

**Layer 1: Local Profanity Filter (`obscenity` npm package)**

Fast, zero-latency, runs synchronously in-process. Catches obvious profanity and slurs.

```
npm install obscenity
```

- Pre-built English dataset covers profanity, slurs, and sexual terms
- Supports custom word additions for domain-specific terms
- Returns match positions for precise error messages ("Card 3 contains prohibited language")
- ~50μs per check — negligible performance impact

**Layer 2: Unicode Normalization (`decancer`)**

Before passing text to any filter, normalize Unicode to catch evasion attempts.

```
npm install decancer
```

- Rust-backed (WASM), extremely fast
- Handles: homoglyphs (Cyrillic а → Latin a), zalgo text, fullwidth characters, mathematical symbols (𝐇𝐞𝐥𝐥𝐨 → Hello), enclosed characters, leetspeak variations
- Apply before Layer 1 and Layer 3: `decancer.cure(text)` → normalized ASCII-equivalent
- Also apply NFKD Unicode normalization (`text.normalize('NFKD')`) as a secondary pass

**Layer 3: OpenAI Moderation API**

Semantic understanding layer. Catches context-dependent harm that keyword filters miss.

```
POST https://api.openai.com/v1/moderations
Model: omni-moderation-latest
Cost: FREE (no per-request charge)
Rate limit: 1000 RPM (more than sufficient for marketplace moderation)
```

**13 harm categories with custom thresholds (stricter than defaults for family-friendly):**

| Category                 | Default Threshold | Our Threshold | Rationale                               |
| ------------------------ | ----------------- | ------------- | --------------------------------------- |
| `sexual`                 | 0.5               | **0.3**       | Zero tolerance for sexual content       |
| `sexual/minors`          | 0.5               | **0.05**      | Near-zero tolerance — legal obligation  |
| `harassment`             | 0.5               | **0.4**       | Catch bullying in educational context   |
| `harassment/threatening` | 0.5               | **0.3**       | Lower bar for threats                   |
| `hate`                   | 0.5               | **0.3**       | Racism, sexism, homophobia              |
| `hate/threatening`       | 0.5               | **0.2**       | Very low tolerance                      |
| `illicit`                | 0.5               | **0.4**       | Illegal activity promotion              |
| `illicit/violent`        | 0.5               | **0.2**       | Violence + illegality                   |
| `self-harm`              | 0.5               | **0.3**       | Protect vulnerable users                |
| `self-harm/intent`       | 0.5               | **0.2**       | Very low tolerance                      |
| `self-harm/instructions` | 0.5               | **0.2**       | Very low tolerance                      |
| `violence`               | 0.5               | **0.4**       | Allow historical context, block graphic |
| `violence/graphic`       | 0.5               | **0.2**       | Near-zero tolerance for gore            |

**Implementation pattern:**

```javascript
// services/moderation.js
const { cure } = require('decancer');
const { RegExpMatcher, englishDataset, englishRecommendedTransformers } = require('obscenity');

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers
});

const THRESHOLDS = {
  sexual: 0.3,
  'sexual/minors': 0.05,
  hate: 0.3,
  'hate/threatening': 0.2,
  'violence/graphic': 0.2
  // ... all 13 categories
};

async function moderateContent(text, category) {
  // Step 1: Normalize Unicode
  const normalized = cure(text).toString().normalize('NFKD');

  // Step 2: Local profanity check
  if (matcher.hasMatch(normalized)) {
    const matches = matcher.getAllMatches(normalized);
    // Check category-aware allowlist before rejecting
    if (!isAllowlisted(matches, category)) {
      return { passed: false, reason: 'profanity', matches };
    }
  }

  // Step 3: OpenAI Moderation API
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'omni-moderation-latest', input: normalized })
  });

  const result = await response.json();
  const scores = result.results[0].category_scores;

  // Check each category against our stricter thresholds
  for (const [category, threshold] of Object.entries(THRESHOLDS)) {
    if (scores[category] >= threshold) {
      return { passed: false, reason: category, score: scores[category] };
    }
  }

  return { passed: true };
}
```

### Category-Aware Allowlists

Educational content legitimately contains terms that trigger filters. Allowlists are scoped by marketplace category:

| Category         | Allowlisted Terms (examples)                                              |
| ---------------- | ------------------------------------------------------------------------- |
| Medical / Health | anatomical terms, disease names, drug names (pharmaceutical), symptoms    |
| Science          | chemical compounds, biological processes, genetic terminology             |
| History          | historical violence terminology (in educational context), war terminology |
| Languages        | foreign words that phonetically match English profanity                   |
| Psychology       | clinical terms for conditions, behavioral terminology                     |

**Implementation:** Allowlist is a `Map<category, Set<string>>` loaded from a JSON config file. When Layer 1 finds a match, check if all matched terms appear in the allowlist for the deck's category. If so, skip to Layer 3 (which understands context).

### Moderation Lifecycle Points

| Event                        | What's Moderated                                               | Action on Failure                                                  |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Deck generation (AI output)  | All card fronts + backs                                        | Re-generate with stricter prompt (one retry), then fail with error |
| List for sale (initial)      | Title, description, all cards, tags                            | Block listing, show specific rejection reason                      |
| Edit listed deck             | Changed fields only (title, description, added/modified cards) | Auto-delist, notify seller with reason, seller can fix and relist  |
| User-reported content        | Full deck re-scan                                              | Queue for human review if automated check passes                   |
| Periodic sweep (weekly cron) | All active listings                                            | Flag for review if thresholds have been updated                    |

### Human Review Queue

For content that automated systems are uncertain about (scores near thresholds) or that users report:

- `moderation_queue` table: `id`, `listing_id`, `reporter_id` (null for automated), `reason`, `automated_scores` (JSONB), `status` (pending/approved/rejected), `reviewer_notes`, `created_at`, `reviewed_at`
- Admin page at `/admin/moderation` — shows queue sorted by severity (highest scores first)
- Actions: Approve (clear flag), Reject (delist + notify seller), Suspend seller (if pattern of violations)
- All decisions logged for audit trail

### Legal Requirements

**CSAM (Child Sexual Abuse Material):**

- Detection is a legal obligation under US law (18 U.S.C. § 2258A)
- If CSAM is detected or reported, you are legally required to report to NCMEC (National Center for Missing & Exploited Children) via their CyberTipline
- Do NOT delete the content before reporting — preserve evidence
- OpenAI Moderation API's `sexual/minors` category provides automated detection; our 0.05 threshold is intentionally very low
- Register as an Electronic Service Provider with NCMEC before launch

**DMCA:**

- Register a DMCA agent with the US Copyright Office ($6 fee)
- Add DMCA takedown contact to Terms of Service
- Implement takedown-and-notice procedure: remove content on valid notice, notify seller, allow counter-notice

**Apple App Store (if future iOS app):**

- Guideline 1.2 requires UGC apps to have: content filtering, offensive content reporting mechanism, ability to block abusive users
- All three are covered by this architecture

### False Positive Handling

- Rejection messages must be specific: "Your deck was not approved because card 7 contains content flagged as [category]"
- Sellers can edit and resubmit immediately (no cooldown on first rejection)
- If seller believes it's a false positive, they can request human review (button on rejection screen)
- Human review overrides automated decisions — add term to allowlist if pattern recurs

## Trial & Subscription Lifecycle (Deep Dive)

### State Machine

```
                    ┌─────────────────┐
                    │   SIGNUP        │
                    │ (trial starts)  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   TRIAL         │
                    │ plan: 'trial'   │
                    │ 7 days, 10/day  │
                    └──┬──────────┬───┘
                       │          │
              No payment     Subscribes
              method         during trial
                       │          │
              ┌────────▼───┐  ┌───▼──────────┐
              │   FREE     │  │   PRO        │
              │ plan:'free'│  │ plan: 'pro'  │
              │ 1 gen/day  │  │ $9/mo        │
              └──────┬─────┘  └───┬──────────┘
                     │            │
              Subscribes    Voluntary cancel
                     │            │
              ┌──────▼──┐  ┌─────▼───────────┐
              │  PRO    │  │ CANCEL_PENDING   │
              └─────────┘  │ cancel_at_period │
                           │ _end: true       │
                           └────────┬─────────┘
                                    │
                           Period ends
                                    │
                           ┌────────▼────────┐
                           │   FREE           │
                           │ Listings delisted│
                           │ Excess decks     │
                           │ read-only        │
                           └─────────────────┘

              ┌──────────────────────┐
              │ PAYMENT_FAILED       │
              │ (invoice.            │
              │ payment_failed)      │
              └──────┬───────────────┘
                     │
              Stripe Smart Retries
              (7-day grace)
                     │
              ┌──────▼───────┐
              │   FREE       │
              │ (involuntary │
              │  cancel)     │
              └──────────────┘
```

### Stripe Billing Integration

**Trial setup (on signup):**

```javascript
// On user registration — create Stripe customer, NO subscription yet
const customer = await stripe.customers.create({
  email: user.email,
  metadata: { user_id: user.id }
});

// Store in DB
await db.query(
  `UPDATE users SET stripe_customer_id = $1, plan = 'trial',
   trial_ends_at = NOW() + INTERVAL '7 days' WHERE id = $2`,
  [customer.id, user.id]
);
```

**Trial-to-paid conversion (user clicks Subscribe):**

```javascript
const session = await stripe.checkout.sessions.create({
  customer: customer.stripeCustomerId,
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  subscription_data: {
    trial_end: Math.floor(user.trialEndsAt.getTime() / 1000), // Honor remaining trial
    trial_settings: {
      end_behavior: { missing_payment_method: 'cancel' } // Auto-cancel if no card
    }
  },
  success_url: `${BASE_URL}/settings?subscription=success`,
  cancel_url: `${BASE_URL}/pricing`
});
```

**Key Stripe fields:**

- `trial_end`: Unix timestamp — exact to the second, not midnight
- `missing_payment_method: 'cancel'`: auto-cancels when trial ends without payment method
- `cancel_at_period_end: true`: for voluntary cancellation (preserves access through billing period)

### Webhook Events & Handlers

**Critical subscription webhooks (platform endpoint):**

| Event                                  | Handler Action                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `checkout.session.completed`           | Set user `plan = 'pro'`, store `stripe_subscription_id`, clear `trial_ends_at` |
| `customer.subscription.updated`        | Sync plan tier. _v2: handle BYOK ↔ no-BYOK tier switches._                     |
| `customer.subscription.deleted`        | Set `plan = 'free'`, delist marketplace listings                               |
| `invoice.payment_succeeded`            | Clear any `payment_failed_at` flag                                             |
| `invoice.payment_failed`               | Set `payment_failed_at`. _v2: trigger dunning email sequence._                 |
| `customer.subscription.trial_will_end` | _v2: send reminder email (3 days before trial ends). v1: log only._            |

**Webhook processing pattern — direct idempotent handlers (v1):**

```javascript
// v1: Direct processing with idempotent SQL. No Redis/BullMQ dependency.
// Optimistic locking via WHERE clause prevents race conditions at MVP scale.
// v2: If webhook volume causes race conditions, add BullMQ queue with single-writer pattern per customer.

app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], SECRET);

  // Always 200 to Stripe — process inline with optimistic locking
  try {
    switch (event.type) {
      case 'customer.subscription.deleted': {
        const customerId = event.data.object.customer;
        // Optimistic lock: only update if not already free (idempotent)
        await db.query(
          `UPDATE users SET plan = 'free', stripe_subscription_id = NULL
           WHERE stripe_customer_id = $1 AND plan != 'free'`,
          [customerId]
        );
        await db.query(
          `UPDATE marketplace_listings SET status = 'delisted', updated_at = NOW()
           WHERE seller_id = (SELECT id FROM users WHERE stripe_customer_id = $1)
           AND status = 'active'`,
          [customerId]
        );
        break;
      }
      // ... other handlers
    }
  } catch (err) {
    console.error(`Webhook ${event.type} processing error:`, err);
    // Still return 200 — log for manual investigation, don't block Stripe retries
  }
  res.sendStatus(200);
});
```

### Dunning Sequence (v2 — Requires Email Service)

> **v1: Stripe handles retries automatically via Smart Retries. `customer.subscription.deleted` fires after retries exhausted → auto-downgrade. No email notifications in v1.**

When `invoice.payment_failed` fires (v2 email flow):

1. **Immediate**: Email user — "Your payment failed. Update your payment method to keep Pro access."
2. **Day 3**: Second email — "Your Pro features will be suspended in 4 days if payment isn't resolved."
3. **Day 5**: Third email — "Last chance: 2 days until your account is downgraded."
4. **Day 7 (grace period end)**: Stripe exhausts retries → `customer.subscription.deleted` fires → auto-downgrade to Free.

During the 7-day grace period, user retains full Pro access. This is Stripe's default retry behavior with Smart Retries.

**DB columns for tracking:**

- `payment_failed_at TIMESTAMPTZ` — set on first failure, cleared on success
- `payment_retry_count INTEGER DEFAULT 0` — track for email sequence

### Downgrade Consequences

When a user downgrades from Pro to Free (voluntary or involuntary):

| Resource             | Action                                                                       |
| -------------------- | ---------------------------------------------------------------------------- |
| Marketplace listings | Auto-delisted (hidden, not deleted). Status → `'delisted'`                   |
| Excess decks (>10)   | Become **read-only**: viewable and studyable, but not editable. No deletion. |
| Generation limit     | Drops to 1/day                                                               |
| Purchased decks      | **Unaffected** — purchases are permanent regardless of tier                  |
| Seller earnings      | Pending payouts still process. Stripe Connect account remains active.        |
| _v2: BYOK API keys_  | _Retained but frozen. Reactivate on re-subscription to BYOK tier._           |

### Re-subscription

- User can re-subscribe at any time from `/pricing`
- Listings are NOT auto-relisted — seller must manually relist each one (prevents stale content reappearing)
- Excess decks become editable again
- _v2: BYOK keys reactivate immediately if re-subscribing to BYOK tier_

### Trial Abuse Prevention

**v1 (no email service):**

- **Disposable email blocking**: Use `disposable-email-domains` npm package (maintained list of ~3000 disposable domains). Block at signup.
- **Rate limit signups by IP**: Max 3 accounts per IP per 24 hours (express-rate-limit on `/auth/register`)
- **Stripe customer deduplication**: Before creating a Stripe customer, check if email already has a customer record (`stripe.customers.list({ email })`). If so, link to existing customer (prevents multiple trials via re-registration).

**v2 (requires email service — TODO):**

- **Email verification**: Required before trial starts generating. Unverified users see: "Verify your email to start your free trial."
- **Trial reminder emails**: Day 1 welcome, Day 4 mid-trial, Day 6 reminder (via `trial_will_end` webhook), Day 7 expiry notice.
- **Dunning emails**: Payment failure → 3 emails over 7-day grace period before involuntary cancellation.

### Feature-Gating Middleware

```javascript
// middleware/plan.js
function requirePlan(...allowedPlans) {
  return async (req, res, next) => {
    const user = req.user;

    // Check trial expiry
    if (user.plan === 'trial' && new Date(user.trial_ends_at) < new Date()) {
      await db.query(`UPDATE users SET plan = 'free' WHERE id = $1 AND plan = 'trial'`, [user.id]);
      user.plan = 'free';
    }

    if (!allowedPlans.includes(user.plan)) {
      return res.status(403).json({
        error: 'upgrade_required',
        message: `This feature requires a ${allowedPlans.join(' or ')} plan`,
        current_plan: user.plan
      });
    }

    next();
  };
}

// Usage:
router.post('/listings', requirePlan('pro'), createListing);
// v2: router.post('/settings/keys', requirePlan('pro'), saveApiKey);
```

## Supabase Migration & Deployment (Deep Dive)

### Migration Strategy: Local PostgreSQL → Supabase

**Step 1: Schema-only migration (recommended for MVP)**

Since the app has no production data yet, export schema only:

```bash
# Export schema from local PostgreSQL
pg_dump -U postgres -d ai_notecards --schema-only --no-owner --no-privileges > schema.sql

# Review and clean up:
# - Remove any local-only extensions
# - Verify all CREATE TABLE statements
# - Add any missing indexes
```

**Step 2: Apply to Supabase**

```bash
# Connect to Supabase directly
psql "postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres" < schema.sql
```

**Step 3: Seed initial data (marketplace bootstrap)**

Create 20-30 quality decks across top categories for cold start. Store seed data in `server/src/db/seeds/marketplace_bootstrap.sql`.

### Versioned Migration Runner

Replace the current `CREATE TABLE IF NOT EXISTS` approach with a proper versioned migration system. ~50 lines of code:

```javascript
// server/src/db/migrator.js
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate(pool) {
  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      filename TEXT NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get already-applied versions
  const { rows: applied } = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
  const appliedVersions = new Set(applied.map(r => r.version));

  // Read migration files (format: 001_initial.sql, 002_marketplace.sql, etc.)
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (appliedVersions.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)', [version, file]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = { migrate };
```

**Migration file structure:**

```
server/src/db/migrations/
├── 001_initial.sql                     # Current schema (users, decks, cards, study_sessions)
├── 002_tiers_and_marketplace_prep.sql  # User tier columns, deck origin, Connect fields
├── 003_marketplace.sql                 # listings, categories, tags, purchases tables
├── 004_ratings_and_flags.sql           # ratings, content_flags tables
# v2:
# ├── 005_byok.sql                     # user_api_keys table, encryption columns
# └── 006_moderation.sql               # moderation_queue table, automated scores
```

### Connection Configuration

**Supabase provides three connection modes:**

| Mode                             | Port             | Use Case               | Supports Transactions | Supports SET |
| -------------------------------- | ---------------- | ---------------------- | --------------------- | ------------ |
| **Session mode** (Supavisor)     | 5432             | Application queries    | Yes                   | Yes          |
| **Transaction mode** (Supavisor) | 6543             | High-concurrency reads | Yes                   | **No**       |
| **Direct connection**            | (from dashboard) | Migrations, admin      | Yes                   | Yes          |

**Recommendation for this app:**

- **Express app**: Session mode (port 5432) — supports all PostgreSQL features, sufficient for MVP traffic
- **Migrations**: Direct connection — bypasses pooler entirely, no connection limit issues
- **If scaling later**: Switch hot-path reads to transaction mode (port 6543), keep writes on session mode

```javascript
// server/src/db/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Session mode URL from Supabase
  ssl: { rejectUnauthorized: false }, // Required for Supabase
  max: 12, // Cap pool size (Supabase free: ~60 connections, Pro: ~200)
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

module.exports = pool;
```

**Environment variable format:**

```
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres
DATABASE_URL_DIRECT=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Pages                    │
│              (React SPA — FREE tier)                 │
│         client/dist → auto-deploy from git           │
├─────────────────────────────────────────────────────┤
│                                                      │
│    API calls (fetch /api/*)                          │
│                                                      │
├─────────────────────────────────────────────────────┤
│                  Railway.app                         │
│           (Express API — $5/mo Hobby)                │
│     server/ → Dockerfile or Nixpacks auto-detect     │
├─────────────────────────────────────────────────────┤
│                                                      │
│    PostgreSQL queries (pg Pool)                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│                  Supabase                            │
│      (PostgreSQL — Free → Pro $25/mo at launch)      │
│              + Supavisor connection pooling           │
└─────────────────────────────────────────────────────┘
```

**Estimated monthly cost:**

| Service                     | Tier                      | Cost             |
| --------------------------- | ------------------------- | ---------------- |
| Cloudflare Pages            | Free                      | $0               |
| Railway                     | Hobby                     | $5               |
| Supabase                    | Free (dev) → Pro (launch) | $0 → $25         |
| Stripe                      | Pay-as-you-go             | 2.9% + $0.30/txn |
| _v2: OpenAI Moderation API_ | _Free_                    | _$0_             |
| **Total (dev)**             |                           | **~$5/mo**       |
| **Total (launch)**          |                           | **~$30/mo**      |

### Railway Deployment Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway init

# Set environment variables
railway variables set DATABASE_URL="postgresql://..."
railway variables set STRIPE_SECRET_KEY="sk_live_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
railway variables set STRIPE_CONNECT_WEBHOOK_SECRET="whsec_..."
railway variables set JWT_SECRET="..."
# v2: railway variables set OPENAI_API_KEY="sk-..."  # For automated moderation
# v2: railway variables set ENCRYPTION_KEY="..."  # For BYOK key encryption
# v2: railway variables set HMAC_SECRET="..."  # For BYOK blind index
railway variables set NODE_ENV="production"

# Deploy
railway up
```

**Railway `Procfile` (or use Nixpacks auto-detect):**

```
web: node server/src/index.js
```

### Cloudflare Pages Setup

```bash
# In client/ directory
# Build command: npm run build
# Output directory: dist
# Environment variables: VITE_API_URL=https://your-railway-app.up.railway.app
```

Connect the GitHub repo → Cloudflare auto-deploys on push to `main`.

### Security Hardening Checklist

- [ ] **CORS**: Restrict `origin` to Cloudflare Pages domain only (not `*`)
- [ ] **Rate limiting**: `express-rate-limit` on all API routes (100 req/min general, 5/hour for sensitive endpoints like key management)
- [ ] **Helmet.js**: Add `helmet()` middleware for security headers (CSP, HSTS, X-Frame-Options)
- [ ] **SSL**: Supabase connections require `ssl: { rejectUnauthorized: false }` — already handled in pool config
- [ ] **RLS**: Not needed — all DB access goes through Express middleware with auth checks. Simpler and equally secure for this architecture.
- [ ] **Secrets**: All secrets in Railway environment variables, never in code or `.env` files committed to git
- [ ] **Webhook verification**: Both Stripe endpoints use `constructEvent()` with their respective signing secrets

### Monitoring

- **Sentry** (free tier): Error tracking for both Express and React. `@sentry/node` + `@sentry/react`. Captures unhandled exceptions, rejected promises, and Express middleware errors.
- **pg_stat_statements**: Enable on Supabase (Settings → Database → Extensions) to monitor slow queries. Check weekly.
- **Railway metrics**: Built-in CPU/memory/network dashboards. Set alerts for >80% memory usage.
- **Uptime**: Use a free service (UptimeRobot, Better Stack free tier) to ping the health endpoint every 5 minutes.
- **Health endpoint**: `GET /api/health` → checks DB connection, returns `{ status: 'ok', db: 'connected' }`.

### Pre-Launch Deployment Checklist

- [ ] Supabase project created, schema migrated, seed data loaded
- [ ] Railway project deployed, all env vars set, health endpoint responding
- [ ] Cloudflare Pages connected to repo, `VITE_API_URL` set, build succeeding
- [ ] Stripe webhooks configured (both platform + Connect) with correct URLs
- [ ] CORS origin set to production Cloudflare Pages domain
- [ ] Sentry DSN configured for both server and client
- [ ] Rate limiting enabled on all API routes
- [ ] Helmet.js middleware active
- [ ] SSL connections verified (no plaintext DB connections)
- [ ] Test purchase flow end-to-end in Stripe test mode
- [ ] Test Stripe Connect onboarding flow
- [ ] Test trial expiry → downgrade flow
- [ ] 20-30 bootstrap decks loaded in marketplace

## UI/UX Design System

### Research Insights: Design Direction

**Aesthetic: Editorial Luxury** — a curated bookshop meets a premium digital storefront. Clean but warm, with deliberate typographic hierarchy, muted earthy tones punctuated by a single bold accent, and generous whitespace.

**Typography (Google Fonts):**

- **Display/Headings**: `DM Serif Display` — elegant, high-contrast serif for page titles, deck names, price tags
- **Body/UI**: `Outfit` — modern geometric sans-serif for descriptions, buttons, labels, navigation
- **Mono/Accent**: `JetBrains Mono` — for prices, stats, code-like values

**Color Palette:**
| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#FAF7F2` | Warm parchment background |
| `--color-surface` | `#FFFFFF` | Cards, panels |
| `--color-ink` | `#1A1614` | Primary text |
| `--color-ink-muted` | `#6B635A` | Secondary text |
| `--color-accent` | `#1B6B5A` | CTAs, links, active states (deep teal-green) |
| `--color-accent-light` | `#E8F5F0` | Hover backgrounds, tag pills |
| `--color-gold` | `#C8A84E` | Star ratings, seller badges |
| `--color-success` | `#2D8A5E` | Validation, confirmations |
| `--color-error` | `#C0392B` | Errors, warnings |

**Motion Principles:**

- Card hover: `translateY(-4px)` + shadow bloom + subtle 0.5-degree rotation (CSS transitions, 250ms ease-out)
- Page load: staggered fade-up on card grids (50ms delay increments)
- Buttons: `scale(0.98)` on `:active`

**Key UI Patterns:**

- Category pills: horizontal scroll with gradient fade on overflow, emoji prefixes (e.g., "🧬 Science")
- Listing cards: white surface with colored category accent bar (2px top), price in `JetBrains Mono`, star ratings in gold
- Card previews: paper-like texture overlay, flip animation on click (`rotateY(180deg)` with `perspective(800px)`)
- Buy button: "Buy for $3" (embed price in CTA), no cart — direct to Stripe Checkout
- Mobile: sticky bottom buy bar on preview page, single-column cards
- Pricing page: two cards (Free + Pro), Pro plan elevated with `scale(1.03)` and accent border, "Recommended" badge. _v2: add BYOK card._
- Empty states: never blank — always offer a path forward ("Be the first to publish", "Try browsing by category")
- Skeleton loading: matching card dimensions, subtle pulse/shimmer animation (1.2s), never show skeleton for more than 3 seconds
- Below 3 ratings: show "New" badge instead of misleading star average
- Search results: "Owned" badge on already-purchased decks

### Research Insights: Marketplace UX Best Practices

1. **No cart for $1-$5 single items.** Direct checkout reduces friction. "Buy for $3" → Stripe Checkout → redirect to deck in library. Three clicks from discovery to purchase.
2. **Price is a feature at $1-$5.** Display it prominently on browse cards, not hidden on detail pages. Use whole-dollar display ("$3" not "$3.00").
3. **Preview card selection: first N in order** (not random, not seller-chosen). Buyers can judge content progression and difficulty level.
4. **Seller onboarding: defer Stripe Connect.** Let sellers fill out the listing form first (emotional investment), then handle payment setup. Don't front-load Connect onboarding.
5. **Empty categories: show "Be the first to publish" + 2-3 popular decks from other categories** to prevent dead-end pages.
6. **Flag flow: one-tap flag → reason selection modal → confirmation.** Do not show flag count to other users (prevents pile-on effects).
7. **Rating distribution: show horizontal bar chart** (5-star to 1-star proportions) on preview page. Users universally understand the Amazon pattern.
8. **Seller dashboard earnings: show both gross and net** with fee breakdown. Sellers care about what they receive.

## Acceptance Criteria

### Functional Requirements (v1)

- [ ] App connects to Supabase and serves real users
- [ ] Two tiers enforce correct generation limits (free: 1/day, pro: 10/day)
- [ ] 7-day trial starts on signup, auto-downgrades on expiry (exact timestamp, not midnight)
- [ ] Disposable email blocking at signup (`disposable-email-domains` package)
- [ ] Stripe customer deduplication to prevent multiple trial abuse
- [ ] Voluntary cancellation uses `cancel_at_period_end: true` (preserves access through billing period)
- [ ] Excess decks become read-only on downgrade (no deletion), re-subscription restores edit access
- [ ] Re-subscription requires manual relist of marketplace decks (prevents stale content)
- [ ] Pro users can list generated decks on marketplace ($1-$5, 13 categories, up to 5 tags, min 10 cards, max 50 active listings)
- [ ] Basic listing validation (required fields, min cards, duplicate title check per category)
- [ ] Buyers can browse, full-text search, filter, sort marketplace listings
- [ ] Preview page shows first 10% of cards (rounded up) as flippable cards, seller info, rating, Study Score
- [ ] Purchase creates a copy in buyer's library (origin: purchased), buyer can edit freely
- [ ] Duplicate purchase blocked at app and DB level
- [ ] Stripe Connect Express onboarding for sellers, destination charges with 50/50 split
- [ ] Seller dashboard shows earnings (gross + net), per-deck stats, payout status
- [ ] Rating prompt appears after completing purchased deck (skippable, one-time), 1-5 stars, atomic average updates
- [ ] Content reporting with reason categories, admin review page, seller suspension
- [ ] Study Score increments on deck completion, displays on profiles
- [ ] Pro downgrade delists marketplace listings (hidden, not deleted)
- [ ] AI prompt enforces 25/30 card soft/hard cap with auto-split
- [ ] "Non-refundable digital purchase" notice displayed before Stripe redirect

**Deferred to v2:**

- [ ] BYOK tier ($5/mo, unlimited gen with user's own API keys) + encryption service
- [ ] 3-layer automated content moderation pipeline (obscenity → decancer → OpenAI Moderation API)
- [ ] Trial reminder emails, dunning emails, email verification (requires email service)
- [ ] Flag abuse prevention (false-flag penalties, rate limits)
- [ ] Rating revision on subsequent completions
- [ ] Seller badges (New → Verified)

### Non-Functional Requirements (v1)

- [ ] Stripe webhooks verify signatures via `constructEvent()`, handlers are idempotent via optimistic locking
- [ ] Two separate webhook endpoints (platform + Connect) with separate signing secrets
- [ ] Raw body parsing on webhook routes (before JSON parser)
- [ ] Copy-on-purchase wrapped in database transaction (reads outside, writes inside)
- [ ] Marketplace browse uses cursor-based pagination (20 per page)
- [ ] Full-text search via PostgreSQL `tsvector` + GIN index
- [ ] Responsive on mobile with sticky bottom buy bar on preview page
- [ ] Supabase Pro tier ($25/mo) — no free tier for production
- [ ] Connection pooling via Supavisor session mode (port 5432), pool capped at 12
- [ ] Versioned database migrations (sequential files, not single-script)
- [x] HTTP caching headers on browse and category endpoints
- [ ] Skeleton loading states on all marketplace pages
- [ ] Feature-gating middleware (`requirePlan()`) on all tier-restricted endpoints
- [ ] Railway deployment with all environment variables configured
- [ ] Cloudflare Pages auto-deploy from git for React SPA
- [ ] CORS restricted to production Cloudflare Pages domain
- [ ] `express-rate-limit` on all API routes (100/min general, 5/hour sensitive, 3/24hr signups per IP)
- [ ] Helmet.js security headers enabled
- [ ] Sentry error tracking on both Express and React
- [ ] Health endpoint (`GET /api/health`) with DB connection check

**Deferred non-functional (v2):**

- [ ] BYOK keys encrypted at rest with AES-256-GCM
- [ ] BullMQ queue-based webhook processing (if scale requires)
- [ ] Email verification before Stripe Connect onboarding
- [ ] Automated content moderation with custom thresholds
- [ ] NCMEC ESP registration, DMCA agent registration (legal — required before v2 moderation)

## Dependencies & Risks

| Risk                                      | Impact                                      | Mitigation                                                                                                          | v1/v2               |
| ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Stripe Connect onboarding complexity      | High — most complex integration             | Follow Express account pattern exactly, prefill KYC before Account Link, test with Stripe CLI, start with test mode | v1                  |
| $1 sales losing money                     | Low at launch volume                        | Log per-sale economics, revisit pricing floor if losses exceed threshold                                            | v1                  |
| Cold start marketplace                    | High — empty marketplace kills conversion   | Bootstrap 20-30 quality decks across top 5-6 categories before launch                                               | v1                  |
| Supabase connection limits                | Medium — pauses after 7 days inactivity     | Upgrade to Pro ($25/mo), session mode pooler, cap pool to 12                                                        | v1                  |
| Webhook signature verification bypass     | Critical — forged webhooks = free purchases | Mandate `constructEvent()` on every handler, reject unsigned requests                                               | v1                  |
| Concurrent rating/purchase lost updates   | High — silent data corruption               | Atomic SQL updates, DB-level unique constraints, optimistic locking                                                 | v1                  |
| Trial abuse via disposable emails         | Medium — perpetual free Pro access          | Block disposable domains, rate limit signups by IP (3/24hr), deduplicate Stripe customers                           | v1                  |
| Express raw body parsing for webhooks     | Medium — breaks all payment processing      | Exclude webhook routes from global `express.json()`, use `express.raw()`                                            | v1                  |
| Migration versioning                      | High — blocks all schema changes            | Implement versioned migration runner (Phase 0) before any feature work                                              | v1                  |
| No automated content moderation at launch | Medium — harmful content could be listed    | Manual review via admin page + Report button. Monitor closely at launch. Add automated pipeline in v2.              | v1 risk, v2 fix     |
| BYOK key management security              | High — storing third-party credentials      | _Deferred to v2._ Will require AES-256-GCM + versioned keyring + HMAC blind index.                                  | v2                  |
| CSAM legal liability                      | Critical — federal reporting obligation     | _v2: Register as NCMEC ESP before enabling automated moderation._ v1: manual review + immediate takedown on report. | v2                  |
| Webhook race conditions                   | Medium — state corruption on rapid events   | v1: optimistic locking via WHERE clause. v2: BullMQ queue if scale requires.                                        | v1 partial, v2 full |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-12-marketplace-and-production-brainstorm.md](docs/brainstorms/2026-03-12-marketplace-and-production-brainstorm.md) — Key decisions: 2-tier model (v1, BYOK deferred), 50/50 Stripe Connect payouts, copy-on-purchase, 13 categories + tags, manual moderation (v1), Study Score = decks completed

### Internal References

- Current schema: `server/src/db/migrate.js`
- AI service (BYOK integration point): `server/src/services/ai.js`
- Existing Stripe scaffolding: `server/src/routes/stripe.js`
- Auth system: `server/src/routes/auth.js`, `server/src/middleware/auth.js`
- API client: `client/src/lib/api.js`
- Route patterns: `server/src/routes/decks.js` (CRUD reference)

### External References

- [Stripe Connect Express Onboarding](https://docs.stripe.com/connect/express-accounts)
- [Stripe Destination Charges](https://docs.stripe.com/connect/destination-charges)
- [Stripe Connect Webhooks](https://docs.stripe.com/connect/webhooks)
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe CLI Listen](https://docs.stripe.com/cli/listen)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Key Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [Supabase Connection Management](https://supabase.com/docs/guides/database/connection-management)
- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Groq API — Model List Endpoint](https://console.groq.com/docs/api-reference) (BYOK validation)
- [Gemini Models API](https://ai.google.dev/api/models) (BYOK validation)

### Research Sources (from deepening)

- Nielsen Norman Group — card component design, search visibility, empty states
- Baymard Institute — e-commerce UX research
- Lenny Rachitsky — marketplace growth patterns, cold start strategies
- Smashing Magazine — skeleton screen loading patterns
- NIST SP 800-38D — AES-GCM IV/nonce recommendations
