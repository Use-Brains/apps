---
date: 2026-03-12
topic: marketplace-production-readiness
---

# Deck Marketplace + Production Readiness

## What We're Building

Three interconnected changes to make AI Notecards production-ready and revenue-generating:

1. **Production database** — migrate from local PostgreSQL to Supabase (hosted Postgres)
2. **Revised tier structure** — hybrid BYOK model with 3 tiers
3. **Deck marketplace** — users buy and sell flashcard decks with Stripe Connect payouts

## Tier Structure

| Tier | Price | AI Generations | Marketplace | API Keys |
|------|-------|---------------|-------------|----------|
| Free | $0 | 1/day | Buy only | Our keys |
| Pro (BYOK) | $5/mo | As many as your keys support | Buy + Sell | User's keys |
| Pro (No BYOK) | $10/mo | 10/day | Buy + Sell | Our keys |

- Free tier uses our Groq/Gemini keys with 1 generation/day limit
- Pro BYOK users paste their own Groq and/or Gemini API keys in a settings page
- Pro BYOK copy: "Generate as much as you want — your keys, your limits. We never throttle you."
- $5 discount incentivizes BYOK, offloading LLM costs to users
- Pro no-BYOK capped at 10 generations/day to protect margins
- 7-day free Pro trial for all new users (starts as Pro no-BYOK: 10/day with our keys, user can add BYOK during trial to remove the cap)

## Deck Size Limits

- **Soft cap: 25 cards** — AI's recommended max per deck
- **Hard cap: 30 cards** — absolute maximum per deck
- When AI generates 25-30 cards, it recommends splitting into two decks of ~15 each
- If content would produce 30+ cards, AI automatically splits into multiple focused decks
- Split decks feel like levels/classes (e.g., "Biology 101: Part 1", "Biology 101: Part 2")
- These limits are enforced via the AI system prompt, not backend validation alone
- On the marketplace, multi-part series can be sold individually

## Deck Ownership Model

- **Generated decks** (`origin: 'generated'`) — created by the user via AI generation or built manually. Fully editable. Can be listed on the marketplace (Pro only).
- **Purchased decks** (`origin: 'purchased'`) — full copy made at time of purchase (snapshot). Buyer can freely edit, add, delete cards for personal use. Cannot be listed on the marketplace (no reselling).
- **Copy-on-purchase** — when a buyer purchases a deck, the deck and all its cards are copied into the buyer's library. Seller's future edits do not affect purchased copies. Buyer's personal edits do not affect the seller's listing.
- **Sellers can only list originally generated decks** — no reselling purchased content, no listing decks derived from purchases.
- **Pro downgrade** — if a Pro user downgrades to Free, their marketplace listings are delisted (hidden, not deleted). If they re-subscribe to Pro, listings can be re-activated.

## Marketplace Design

### Business Model (Model C — Hybrid)

- Revenue from subscriptions + marketplace revenue share
- Sellers set whole-dollar prices: $1, $2, $3, $4, or $5
- Platform takes 30% cut on every sale
- Buyers on any tier (including free) can purchase decks
- Only Pro users can list decks for sale
- Bootstrap content ourselves initially to solve cold start

### Seller Access & Reputation

Pro users can list paid decks immediately. No prerequisites.

| Badge | Requirements | Benefits |
|-------|-------------|----------|
| **New Seller** | Pro account | Can list paid decks, standard placement |
| **Verified Seller** | 30+ days active, 5+ paid sales, 0 content flags | Trust badge, boosted search/browse placement |

- Revenue split: 70% seller / 30% platform from the first sale
- Payouts flow immediately — no holdback or escrow period
- Reputation is earned through time, sales, and clean content — not by withholding money

### Seller Payouts

- **Stripe Connect** — sellers onboard with Stripe, receive direct payouts minus 30% platform cut
- Industry standard, handles identity verification and tax reporting
- Sellers see earnings dashboard in-app

### Buyer Experience

- **Category browsing** — 13 categories (see taxonomy below), no subcategories
- **Tags** — sellers add up to 5 free-text tags per deck for granularity (e.g., "Calculus", "AP Chemistry")
- **Search + filters** — search by keyword/tag, filter by price, rating, newest, most popular
- **Preview page** — deck title, description, card count, 10% of cards visible (rounded up), seller info/rating/Study Score, price
- **Instant delivery** — after purchase, full deck is added to buyer's library immediately
- **No refunds** — preview cards + rating system give buyers enough info before purchase

### Category Taxonomy (13 categories)

1. Math
2. Science
3. History
4. Geography
5. English
6. Foreign Languages
7. Computer Science
8. Business & Economics
9. Medical & Health Sciences
10. Law
11. Arts & Humanities
12. Religion
13. Test Prep

No subcategories at launch. Sellers add up to 5 tags for granularity. Popular tags can be promoted to subcategories later based on actual usage patterns.

### Rating System

- 1-5 stars per deck
- One rating per account per deck
- Rating only allowed after completing the deck at least once
- Rating is **mandatory** — user cannot continue past the completion screen without rating (marketplace-purchased decks only; personal/generated decks are not rated)
- Completers-only rating naturally skews positive (users who quit never rate), which keeps marketplace ratings healthy

### Moderation & Content Filtration

**On deck submission (real-time, programmatic only — no AI):**
- Minimum 5 cards
- No empty front/back fields
- Duplicate title detection
- Profanity list / regex pattern matching / blocked term filtering
- Pass → listed on marketplace
- Fail → rejected with reason

**On user flag (post-publish):**
1. Re-run programmatic filter (may catch things missed on first pass)
2. Save flagged record to review queue with flag reason
3. AI reviews queue later — adhoc, manually triggered by admin to control token usage
4. Admin makes final call: remove listing or dismiss flag

No AI in the real-time submission pipeline. AI only runs on the flagged queue when manually triggered.

### BYOK Key Validation

- On key submission, make a minimal API call to the provider to verify the key works
- Check key uniqueness against `users` table — reject if already in use by another account
- Store keys encrypted in database

## Study Score

- **Formula:** total decks completed (simple count)
- Public on seller profiles as a trust signal
- Displayed for all users as a gamification/retention mechanic
- "This person has completed 47 decks" signals a serious studier whose content is probably quality

## Production Database

- **Supabase** (hosted PostgreSQL)
- User already has a Supabase account
- Migration: create project, get connection string, swap `DATABASE_URL` in `.env`
- No code changes needed — same pg driver, same queries

## Key Decisions

- **Stripe Connect for payouts**: industry standard, scales properly, handles tax/compliance
- **BYOK as a discount, not a requirement**: accessible to non-technical users, power users save $5/mo
- **No-BYOK Pro capped at 10/day**: protects LLM cost margins while still feeling generous
- **13 categories + tags, not 22 categories + subcategories**: avoids empty pages, tags provide granularity
- **Programmatic moderation only in prod**: no AI in real-time pipeline, AI only for adhoc review of flagged content
- **Bootstrapped content**: owner seeds initial marketplace content to overcome cold start
- **Immediate payouts, reputation earned over time**: no escrow, no holdback — trust badges earned through activity
- **25/30 soft/hard card cap**: AI recommends splitting at 25, enforces at 30, creates natural multi-part series
- **Forced ratings after completion**: ensures all rated decks were actually studied, keeps ratings meaningful
- **No refunds**: preview cards + ratings = sufficient buyer protection
- **7-day Pro trial**: starts as no-BYOK, user can add keys during trial
- **Pure copy-on-purchase**: simplest model, protects buyers, no sync complexity
- **Sellers can only list generated decks**: prevents resale of purchased content
- **Buyers can edit purchased decks**: personal use only, cannot relist

## Next Steps

→ Set up Supabase and swap DATABASE_URL
→ Update tier structure (free: 1/day, Pro no-BYOK: 10/day, 7-day trial, BYOK settings page)
→ Update AI prompt with 25/30 card limits and auto-split logic
→ Build marketplace (schema, Stripe Connect, 13 categories, tags, search, preview, purchase flow)
→ Build rating system (forced post-completion, 1-5 stars)
→ Build seller reputation system (New Seller → Verified Seller)
→ Build Study Score (decks completed counter)
→ Build content moderation pipeline (programmatic filter + flag queue)
→ Build BYOK settings page with key validation
→ `/workflows:plan` for implementation details
