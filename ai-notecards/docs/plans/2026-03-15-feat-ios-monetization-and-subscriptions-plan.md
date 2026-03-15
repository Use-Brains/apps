---
title: iOS Monetization & Subscriptions
type: feat
date: 2026-03-15
origin: docs/brainstorms/2026-03-15-ios-monetization-and-subscriptions-brainstorm.md
deepened: 2026-03-15
reviewed: 2026-03-15
---

# iOS Monetization & Subscriptions

## Enhancement Summary

**Brainstorm found:** `docs/brainstorms/2026-03-15-ios-monetization-and-subscriptions-brainstorm.md`
**Local research:** `server/src/routes/stripe.js`, `client/src/pages/Settings.jsx`, `client/src/pages/Terms.jsx`, `docs/solutions/feature-patterns/account-settings-experience.md`, `docs/solutions/feature-patterns/pre-launch-checklist.md`
**External research:** RevenueCat Expo + React Native installation/configuration docs, Expo `expo-web-browser` docs, Apple App Review Guidelines section 3.1
**Skills applied:** `workflows-plan`, `deepen-plan`, `security-review`, `spec-flow-analyzer`

### Key Planning Findings
1. **This is a payment and App Review feature** — external constraints matter as much as repo patterns, so the plan must preserve existing Stripe behavior while adding Apple IAP safely.
2. **Server-owned entitlements must remain the rule** — the mobile client can display RevenueCat state, but `users.plan` stays canonical and `/api/auth/me` remains the app contract.
3. **Expo requires a dev build for real purchase testing** — RevenueCat’s Expo docs explicitly require a development build for real native purchase flows; Expo Go is only sufficient for preview-mode logic.
4. **Marketplace web checkout is review-risky** — `expo-web-browser` opens `SFSafariViewController` on iOS, which fits the intended UX, but App Review fallback must be designed up front.
5. **Current billing state is Stripe-only** — the repo has `stripe_subscription_id`, `cancel_at_period_end`, and `cancel_at`, but no `subscription_platform`, no RevenueCat identity column, and no Apple webhook path yet.
6. **Current marketplace economics are internally inconsistent** — legal/docs currently say 70/30 seller/platform, but `server/src/routes/stripe.js` and related purchase flow still assume a 50% platform fee. This must be explicitly resolved during implementation, not ignored.

## Technical Review Findings

### P1 — Critical

1. **Entitlement resolution cannot trust webhook arrival order** — Stripe and RevenueCat events may arrive late or out of order. The downgrade logic must compute the effective entitlement from current persisted Stripe + Apple state, not from “this event means downgrade” alone.
2. **Purchase restore needs an explicit server-sync contract** — Apple restore flows and initial purchase completion cannot rely solely on eventual webhook delivery. The mobile app needs a post-purchase / post-restore sync path that forces the server to reconcile and then refreshes `/api/auth/me`.

### P2 — Important

1. **Annual web checkout needs server-side product allowlisting** — do not add a free-form “plan” parameter to Stripe checkout without validating against a strict allowlist of monthly vs annual products.
2. **Browser handoff must use allowlisted server URLs** — mobile should open only controlled purchase / billing / onboarding URLs, not arbitrary URLs assembled in the client.
3. **Marketplace fallback should be feature-flagged** — App Review fallback must be switchable without a rushed invasive refactor.
4. **Manage-subscription routing must be platform-safe** — Apple users must never be sent to Stripe management by default, and Stripe users must not see Apple management instructions.
5. **RevenueCat product mapping must be allowlisted too** — webhook and reconcile flows must map only known Apple product IDs / entitlements to internal plans, otherwise a misconfigured or future product could incorrectly unlock Pro.
6. **Platform-specific cancellation state needs explicit semantics** — the current shared `cancel_at_period_end` / `cancel_at` fields are Stripe-shaped. The implementation plan must define how Apple cancellation/expiration state is represented so Apple events do not silently overwrite or misrepresent Stripe cancellation state.

## Overview

Implement iOS monetization support for AI Notecards using a hybrid billing model:

- Apple subscriptions on iOS via RevenueCat + StoreKit
- Stripe subscriptions on web remain unchanged
- Marketplace purchases on iOS open the existing web checkout flow in `SFSafariViewController` via `expo-web-browser`
- The server remains the canonical source of truth for subscription entitlement and downgrade behavior

This plan covers the schema, server, mobile, and App Review preparation needed to ship step 3 without breaking the existing Stripe-backed production behavior.

## Problem Statement

The current product has only one monetization path wired into the codebase:

- Web Pro subscriptions go through Stripe Checkout + Stripe webhooks
- Billing portal flows assume Stripe-only subscribers
- Marketplace purchases and seller payouts assume Stripe Checkout + Stripe Connect
- Mobile has no RevenueCat SDK, no purchase UI, no Apple subscription management path, and no platform-aware subscription contract

Without this work, the iOS app cannot legally sell Pro subscriptions through Apple IAP, cannot safely distinguish Stripe-vs-Apple subscription ownership, and cannot present a coherent purchase/manage-subscription experience on mobile.

## Proposed Solution

### Phase 1 — Data model and entitlement contract

Add explicit billing-platform state without replacing the existing Stripe subscription model.

- Add user columns:
  - `subscription_platform` — `'stripe' | 'apple' | null`
  - `revenuecat_app_user_id` — stable identifier for RevenueCat, equal to `users.id`
  - optionally `apple_product_id` or equivalent current-plan metadata if webhook handling benefits from storing current SKU
- Define whether `cancel_at_period_end` / `cancel_at` remain shared cross-platform fields or whether Apple-specific cancellation metadata is stored separately; do not leave this ambiguous
- Keep `users.plan` as the single entitlement field returned to clients
- Preserve existing `stripe_subscription_id`, `cancel_at_period_end`, and `cancel_at` behavior for Stripe users
- Add explicit persisted Apple-side entitlement metadata sufficient to evaluate “is Apple subscription currently active?” without trusting last-event-wins logic alone
- Define conflict resolution in one place:
  - if either Stripe or Apple entitlement is active, user remains `plan = 'pro'`
  - downgrades only occur when neither platform has an active entitlement
  - `subscription_platform` indicates where the current primary self-service management path lives
- Implement a dedicated entitlement projection helper/service that derives effective billing state from current Stripe + Apple persistence, so webhook handlers do not duplicate downgrade rules

### Phase 2 — Server-side RevenueCat integration

Add a RevenueCat webhook path that mirrors the existing Stripe webhook posture.

- Add `POST /api/revenuecat/webhook`
- Verify RevenueCat webhook authorization before processing any payload
- Handle at minimum:
  - `INITIAL_PURCHASE`
  - `RENEWAL`
  - `CANCELLATION`
  - `BILLING_ISSUE`
  - `EXPIRATION`
  - `PRODUCT_CHANGE`
- Maintain a strict allowlist mapping of RevenueCat entitlement names and Apple product IDs to internal plan semantics
- Reuse the same downgrade side effects Stripe already applies:
  - set `plan`
  - manage `cancel_at_period_end` / `cancel_at`
  - delist marketplace listings on full Pro expiry when no alternate entitlement exists
- Add idempotency protections so webhook retries cannot create contradictory billing state
- Persist provider event identifiers or equivalent replay guards for RevenueCat events
- Recompute effective entitlement after every Stripe or RevenueCat billing mutation instead of assigning downgrade/final state inline per event
- Keep Stripe webhook behavior intact and additive, not rewritten

### Phase 3 — Mobile RevenueCat purchase and subscription UX

Integrate RevenueCat on mobile as the native subscription layer.

- Install and configure `react-native-purchases` in the Expo app
- Configure Purchases once near app startup with the Apple public SDK key
- After auth, call `Purchases.logIn(user.id)` so RevenueCat uses the same identity as the server
- Build a mobile Pro paywall that:
  - shows monthly and annual options
  - clearly describes Pro benefits before purchase
  - restores purchases
  - reflects current entitlement state without showing conflicting Stripe-web details
- After purchase or restore, call an explicit server reconciliation path and then refresh `/api/auth/me`; do not grant or retain Pro solely from local SDK state
- Add platform-aware “Manage Subscription” behavior:
  - Apple subscriber → Apple subscription management surface
  - Stripe subscriber → existing Stripe billing portal via web/browser handoff
- Ensure already-Pro Stripe subscribers on iOS do not see a misleading subscribe CTA

### Phase 4 — iOS marketplace purchase handoff

Keep marketplace purchases on Stripe by explicitly routing iOS to the web purchase flow.

- Install and use `expo-web-browser`
- For iOS marketplace purchases:
  - open an allowlisted server-generated purchase URL in `WebBrowser.openBrowserAsync()`
  - treat it as a browser commerce flow, not a native IAP
  - refresh marketplace/deck entitlement state when the user returns
- For seller onboarding and billing-management links on mobile, use the same browser-handoff pattern rather than inventing a native billing stack
- Prepare a hard fallback:
  - if App Review rejects external marketplace checkout, iOS marketplace becomes browse-only with a web purchase CTA
- Put the marketplace-buy capability behind a feature flag so browse-only fallback can be enabled with minimal code churn

### Phase 5 — Pricing, review posture, and regression safety

Make the monetization surface coherent across platforms and reviewable by Apple.

- Add annual pricing support on web (`STRIPE_PRO_ANNUAL_PRICE_ID`) and in mobile copy
- Parameterize Stripe subscription checkout with a strict server allowlist for `monthly` and `annual` rather than separate ad hoc flows or arbitrary client-provided price IDs
- Define cancellation-state presentation rules so Settings/Profile can accurately represent Apple-vs-Stripe cancellation timing without leaking platform confusion into the UI
- Keep iOS price presentation compliant:
  - show only iOS subscription price in app
  - avoid “cheaper on web” language
- Add reviewer-facing notes/checklist:
  - demo account or test instructions
  - where IAP is visible in the app
  - how marketplace checkout works and what the fallback is
- Verify account/settings surfaces continue to render correct cancellation state for both Stripe and Apple subscribers

## Research Insights

### Existing repo patterns to follow

- `server/src/routes/stripe.js` already encapsulates subscription checkout, cancellation, billing portal, and downgrade side effects; RevenueCat should parallel this shape rather than inventing a second billing architecture.
- `server/src/routes/auth.js` and the new mobile auth flow already use server-driven user state; monetization should continue to depend on `/api/auth/me` and sanitized user payloads instead of client-only SDK state.
- `docs/solutions/feature-patterns/account-settings-experience.md` establishes the pattern of platform-aware settings surfaces, JSON-backed preferences, and careful server-side state merges.
- `docs/solutions/feature-patterns/pre-launch-checklist.md` reinforces the need for reviewer-ready metadata, full demo access, and avoiding hidden billing/review blockers.

### External research notes

- RevenueCat’s Expo docs say real purchase testing requires an Expo development build; Expo Go only supports preview-mode behavior.
- RevenueCat’s configuration docs say the SDK should be configured once and use platform-specific public API keys.
- Expo docs confirm `WebBrowser.openBrowserAsync()` opens `SFSafariViewController` on iOS, which fits the intended marketplace handoff.
- Apple’s App Review Guidelines 3.1.1 require in-app purchase for unlocking app features or functionality, which is why Pro must be Apple IAP on iOS.
- Apple’s guidelines also allow access to subscriptions purchased elsewhere in multiplatform apps if those items are also available as IAP in-app; this supports existing Stripe Pro users on iOS as long as iOS also offers IAP.
- RevenueCat restore behavior is client-visible immediately, but server-owned access still requires explicit reconciliation so the app and backend do not drift during webhook delays.

## Technical Considerations

### Current code paths to extend

- `apps/ai-notecards/server/src/routes/stripe.js`
- `apps/ai-notecards/server/src/index.js`
- `apps/ai-notecards/server/src/db/migrations/*.sql`
- `apps/ai-notecards/server/src/routes/auth.js`
- `apps/ai-notecards/mobile/app/_layout.tsx`
- `apps/ai-notecards/mobile/src/lib/auth.tsx`
- `apps/ai-notecards/mobile/src/lib/api.ts`
- `apps/ai-notecards/mobile/app/(tabs)/profile.tsx`
- `apps/ai-notecards/client/src/pages/Settings.jsx`
- `apps/ai-notecards/client/src/pages/Terms.jsx`

### SpecFlow analysis: must-work flows

1. **Existing Stripe Pro user opens iOS app**
   - Auth succeeds
   - mobile sees `plan = 'pro'`
   - no purchase prompt is shown
   - manage-subscription routes to Stripe portal, not Apple

2. **New iOS user subscribes via Apple**
   - paywall shows Apple products
   - purchase succeeds
   - client triggers server reconciliation after purchase
   - RevenueCat webhook and/or reconcile path updates server state
   - `/api/auth/me` returns `plan = 'pro'`
   - app unlocks Pro without requiring a separate Stripe flow

3. **Apple subscriber opens web app later**
   - web sees `plan = 'pro'`
   - product features unlock normally
   - billing management is platform-aware and does not incorrectly send them into Stripe cancellation

4. **Stripe subscriber cancels on web**
   - Stripe webhook updates cancellation state
   - iOS app shows correct pending-cancel state on next refresh

5. **Apple subscriber expires**
   - RevenueCat webhook marks cancellation / expiration
   - downgrade to free only if no active Stripe subscription exists
   - seller listing delist behavior remains correct

6. **iOS marketplace buyer taps purchase**
   - app opens browser handoff
   - Stripe checkout completes on web
   - purchased deck appears after return/refresh

7. **App Review fallback**
   - marketplace can be switched to browse-only without breaking subscriptions or seller flows

### Risks and dependencies

- **App Review risk:** external marketplace checkout may be challenged even if subscriptions are correctly on IAP
- **Identity drift risk:** RevenueCat app user ID must exactly match the authenticated server user model
- **Webhook race risk:** Stripe and RevenueCat events can both affect `plan`; downgrade logic must inspect the alternate platform before revoking Pro
- **Restore timing risk:** Apple purchase restore may complete in the SDK before the server sees the matching webhook
- **Settings regression risk:** existing cancellation UI currently assumes Stripe-only semantics
- **Economics inconsistency risk:** the current repo still uses a 50% platform fee constant while legal/docs say 70/30

## Acceptance Criteria

### Must Fix

- [x] Add `subscription_platform` and `revenuecat_app_user_id` to the user billing model
- [x] Add a verified `POST /api/revenuecat/webhook` endpoint
- [x] Keep `users.plan` as the server-side source of truth for entitlement
- [x] Prevent Apple and Stripe billing events from incorrectly downgrading an otherwise active Pro user, even with out-of-order webhook delivery
- [x] Add RevenueCat mobile initialization and authenticated `Purchases.logIn(user.id)` wiring
- [x] Add iOS purchase UI for monthly and annual Pro subscriptions
- [x] Add purchase restore handling for Apple subscriptions
- [x] Add explicit post-purchase / post-restore server reconciliation before the app trusts refreshed entitlement state
- [x] Add platform-aware “Manage Subscription” behavior for Apple vs Stripe subscribers
- [x] Keep existing Stripe checkout, Stripe portal, and Stripe webhook flows working for web users
- [x] Add iOS marketplace checkout handoff via `expo-web-browser`
- [x] Add a browse-only iOS marketplace fallback path for App Review rejection handling
- [x] Add annual web pricing support and the required env/config surface
- [x] Strictly map only known RevenueCat entitlements / Apple product IDs to internal Pro access
- [x] Define and implement platform-safe cancellation metadata semantics for Apple and Stripe subscribers

### Should Fix

- [x] Record enough Apple product metadata to explain a user’s current subscription state in support/debugging
- [x] Surface cancellation / billing-issue status cleanly in mobile settings
- [x] Add a clear review-note checklist for App Store submission
- [x] Align legal/product copy with the final monetization implementation
- [x] Resolve the 50/50 vs 70/30 marketplace split inconsistency before shipping iOS marketplace purchase copy
- [x] Put iOS marketplace purchasing behind a feature flag so review fallback is operationally simple
- [x] Make cancellation-state UI accurate for both Apple and Stripe subscribers without reusing Stripe-only assumptions blindly

### Security / Correctness Requirements

- [x] Verify RevenueCat webhook auth before any billing mutation
- [x] Make RevenueCat webhook handling idempotent across retries
- [x] Never let the mobile client grant Pro solely from SDK state without server confirmation
- [x] Ensure cancel/downgrade logic checks both Apple and Stripe state before changing `plan`
- [x] Keep browser-based purchase handoffs on HTTPS-only, allowlisted URLs
- [x] Strictly allowlist Stripe monthly vs annual checkout products on the server
- [x] Strictly allowlist RevenueCat entitlement names and Apple product IDs on the server
- [x] Avoid exposing internal billing identifiers in `sanitizeUser()`

## Testing Strategy

### Backend

- [ ] Add webhook tests for RevenueCat initial purchase, renewal, cancellation, expiration, and replayed retries
- [x] Add downgrade tests proving Stripe and Apple entitlements do not clobber each other
- [ ] Add out-of-order event tests proving entitlement projection remains correct across Stripe + RevenueCat sequences
- [ ] Add migration verification for new billing columns and defaults
- [ ] Add regression tests for existing Stripe webhook behavior
- [x] Add tests proving unknown RevenueCat products / entitlements do not unlock Pro

### Mobile

- [x] Typecheck `mobile/` after RevenueCat and WebBrowser integration
- [x] Verify RevenueCat initialization is one-time and tied to authenticated user identity
- [ ] Verify existing Stripe Pro users do not see a false subscribe path on iOS
- [ ] Verify restore purchases updates UI correctly
- [ ] Verify purchase restore triggers server reconciliation and `/api/auth/me` reflects the updated plan without waiting on eventual webhook timing
- [ ] Verify browser purchase handoff returns cleanly to the app
- [ ] Verify paywall and purchase flows in an Expo development build, not Expo Go

### Regression / Manual

- [ ] Verify web checkout and billing portal still work unchanged
- [ ] Verify iOS “Manage Subscription” targets Apple for Apple users and Stripe for Stripe users
- [ ] Verify settings surfaces render correct cancellation dates for both billing platforms
- [ ] Verify Apple cancellation state does not overwrite or misstate Stripe cancellation history, and vice versa
- [ ] Verify marketplace browse-only fallback can be enabled without breaking listing discovery
- [ ] Verify App Review demo notes cover login, IAP location, and marketplace behavior

## Dependencies and Risks

### Dependencies

- RevenueCat project + Apple public SDK key
- App Store Connect subscription products for monthly and annual Pro
- Expo development build support
- `expo-web-browser`
- New server migration for billing metadata
- New env/config for annual Stripe pricing

### Risks

- Apple review rejects external marketplace checkout
- Subscription state drifts between Apple, RevenueCat, and PostgreSQL
- Existing Stripe-only settings UX becomes misleading on iOS
- Marketplace fee split confusion leaks into billing or legal copy

## References

- RevenueCat Expo install docs: https://www.revenuecat.com/docs/getting-started/installation/expo
- RevenueCat SDK config docs: https://www.revenuecat.com/docs/getting-started/configuring-sdk
- RevenueCat React Native install docs: https://www.revenuecat.com/docs/getting-started/installation/reactnative
- Expo WebBrowser docs: https://docs.expo.dev/versions/v55.0.0/sdk/webbrowser/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple In-App Purchase overview: https://developer.apple.com/in-app-purchase/
