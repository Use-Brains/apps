---
date: 2026-03-12
topic: ios-swift-rewrite-byok
---

# iOS Swift Rewrite + BYOK Feature

## What We're Building

A native iOS app in Swift/SwiftUI that replaces the current React web frontend while keeping the existing Express API backend. The app will be a premium, polished experience targeting App Store distribution with liquid glass aesthetics, system light/dark theme integration, and full native iOS feel.

Additionally, a BYOK (Bring Your Own Key) tier is added as a new subscription option where users provide their own OpenRouter API key for unlimited generations at a reduced subscription price.

## Key Decisions

### Architecture: Native Swift + Existing Express Backend
- **Decision**: Swift/SwiftUI for iOS, keep Express API as-is
- **Rationale**: User wants premium native feel (liquid glass, haptics, SF Symbols, system theme). Cross-platform frameworks (React Native, Capacitor) compromise polish. The Express backend is already platform-agnostic — any client can call it.
- **Android later**: Will be a separate Kotlin/Jetpack Compose app hitting the same API. Accepted trade-off — better to be great on one platform than mediocre on two.

### BYOK: Server-Side, Not Client-Side
- **Decision**: User's OpenRouter key is stored encrypted in the database, decrypted at request time on the server
- **Rationale**: Users are still paying ($5/mo), so we need tier enforcement and usage tracking. Keeps prompt template private. Fits naturally into existing Express middleware (auth + plan checks). OpenRouter is stateless — swapping keys per-request is trivial.
- **Key storage**: AES-256 encrypted at rest in `users` table. Decrypted only in `ai.js` at generation time.
- **Key validation**: Test call to OpenRouter on key submission to verify validity.

### Tier Structure
| Tier | Price | Generations | AI Keys |
|------|-------|-------------|---------|
| Free | $0 | 1/day | App's keys |
| Pro | $9/mo | 10/day | App's keys |
| BYOK Pro | $5/mo | Unlimited | User's OpenRouter key |

### Payments: Apple IAP Only in v1
- **Decision**: Apple IAP is the sole payment platform for v1 — subscriptions (Pro, BYOK Pro) and marketplace deck purchases all go through IAP. No Stripe subscriptions, no external payment links.
- **Rationale**: Cleanest path to App Store approval. Single subscription system keeps backend simple — no dual-platform tier resolution needed.
- **Revenue split**: 50/50 of gross (see "Marketplace Revenue Split" section below for full breakdown)
- **v2 plan — Stripe Direct option**: Offer discounted subscriptions ($7.99/mo Pro, $3.99/mo BYOK) via Stripe Payment Links outside the app. Users who find the payment page directly (not linked from the app) avoid Apple's cut entirely. Both the user and platform benefit. Code should include TODOs/placeholders/comments throughout v1 to make this transition straightforward.
- **v2 plan — External marketplace payments**: Link out to Stripe Checkout for deck purchases (Apple now allows external payment links via anti-steering ruling). Code should include TODOs/placeholders for this transition alongside the subscription link-out.

### Ratings System
- **v1 scope**: 1-5 star ratings only, no written reviews
- **Display**: Aggregated as 1.0–5.0 average

### Admin/Moderation
- **v1 scope**: Single admin (the developer) can moderate content
- **Not v1**: Multi-admin, additional moderator roles

### BYOK Model Selection
- **Decision**: Users choose their own model from OpenRouter's catalog
- **Rationale**: Power users want control. OpenRouter supports 100+ models — let them pick what they want to pay for.
- **UX**: Settings screen with model picker + link to OpenRouter docs on how to create an API key and add credits
- **In-app guidance**: Point users to OpenRouter's key creation page and explain that different models have different costs/capabilities

### Marketplace Deck Purchases: Consumable IAP with Server-Managed Entitlements
- **Decision**: Deck purchases use consumable IAPs (5 product IDs, one per price tier $1-$5) with server-managed purchase records
- **Rationale**: Non-consumable IAPs require pre-registered product IDs in App Store Connect — can't create one per deck dynamically. Consumable IAPs with server-side entitlements solve this: the consumable is "consumed" immediately, the backend records the purchase, and the `purchases` table is the source of truth for deck ownership. Users still buy once and keep forever — ownership is tracked server-side, not via StoreKit restore.
- **Updated during planning**: Original decision was non-consumable, changed after SpecFlow analysis identified the dynamic product ID limitation.

### Marketplace Revenue Split (Updated for Apple IAP)
- **Decision**: 50/50 split between seller and platform (changed from web's 70/30)
- **Rationale**: Apple takes 30% off the top. The platform's 50% covers Apple's cut plus operational expenses (hosting, Stripe fees, etc.). Sellers are clearly informed of the 50/50 split in the seller onboarding flow.
- **Money flow**: User pays via Apple IAP → Apple keeps 15% (Small Business Program, under $1M revenue) → Platform receives 85% → Platform pays seller 50% of gross via Stripe Connect → Platform keeps remainder
- **Example**: $5 deck → Apple keeps $0.75 (15%) → Platform receives $4.25 → Platform pays seller $2.50 (50% of gross) via Stripe Connect → Platform nets $1.75
- **Note**: Updated from 30% to 15% after discovering Apple Small Business Program eligibility. Enroll immediately after creating Apple Developer account.
- **Seller communication**: Transparent explanation during onboarding — "You receive 50% of each sale. The remaining 50% covers App Store fees and platform costs."
- **Infrastructure**: Sellers still onboard via Stripe Connect Express (same as web). Apple IAP is the payment collector; Stripe Connect is the payout mechanism.

### AI Provider Routing
- **Free/Pro users**: Groq (primary) with Gemini fallback — existing `ai.js` behavior, uses app's API keys
- **BYOK users**: OpenRouter with user's key and user's chosen model — new code path in `ai.js`
- **Three providers total**: Groq, Gemini, OpenRouter — backend must support all three

## v1 Feature Scope (iOS)

### Must Have — Full Feature Set
1. **AI Generation** — paste notes/topic → get flashcard deck (up to 30 cards)
2. **Study Mode** — flip cards, mark known/unknown
3. **Auth** — signup/login (JWT, existing backend)
4. **Subscription Tiers** — Free, Pro, BYOK Pro (Apple IAP for subscriptions)
5. **BYOK Settings** — enter/validate/store OpenRouter API key
6. **Marketplace** — browse, search, purchase decks (Apple IAP)
7. **Seller Flow** — Stripe Connect Express onboarding, publish decks, view sales
8. **Ratings** — 1-5 stars on purchased decks
9. **Admin** — content moderation, user management (single admin)
10. **iOS Native Polish** — liquid glass, SF Symbols, haptics, system light/dark theme, native animations

### Backend Changes Needed
- Add `openrouter_api_key_encrypted` and `preferred_model` columns to `users` table
- Add BYOK tier to plan middleware (skip rate limiting, use user's key)
- Update `ai.js` to accept/use per-user OpenRouter keys + model selection (third provider alongside Groq/Gemini)
- Add endpoints: `PUT /api/settings/api-key`, `DELETE /api/settings/api-key`, `POST /api/settings/api-key/validate`
- Add endpoint: `PUT /api/settings/model` (store preferred OpenRouter model)
- Apple IAP server-side transaction validation endpoint (StoreKit 2 Server API)
- Update marketplace payout logic for 50/50 split

### What Happens to the Web Frontend
- `client/` directory stays in the repo for now (could serve as a web companion later)
- Not actively maintained during iOS development
- Backend serves both if needed

## Remaining Open Questions
- **StoreKit 2 implementation**: Auto-renewable subscriptions and non-consumable purchases need research — server-side validation via App Store Server API vs on-device Transaction.currentEntitlements
- **Liquid glass availability**: This is an iOS 26 design language. If building before iOS 26 ships publicly, the app may need a design approach that upgrades gracefully when the API becomes available.

## Next Steps
→ `/workflows:plan` for implementation details — start with iOS project setup + BYOK backend changes
