---
date: 2026-03-15
topic: ios-monetization-and-subscriptions
---

# iOS Monetization & Subscription Strategy

## What We're Building

A dual-payment architecture that lets AI Notecards sell Pro subscriptions through Apple IAP on iOS while keeping Stripe as the payment backbone on web. The iOS app uses RevenueCat to manage StoreKit 2 subscriptions, which sync to the same server-side `plan` column that Stripe already writes to today. Marketplace purchases route through the web browser on iOS -- they do not go through Apple IAP. Seller payouts remain on Stripe Connect regardless of how the buyer paid.

This is the single hardest architectural decision in the iOS build. Every choice here has revenue, compliance, and code complexity implications. The strategy optimizes for App Store approval, indie economics (sub-$1M, 15% Apple commission), and keeping the existing Stripe infrastructure intact rather than replacing it.

**Current repo reality (2026-03-15 refresh):**

- Web subscriptions already exist through Stripe and write `plan` / `stripe_subscription_id` in `server/src/routes/stripe.js`
- Marketplace purchases and seller payouts already run through Stripe Checkout + Stripe Connect
- Mobile auth now exists as a native token-based flow, so RevenueCat can attach to authenticated mobile users after login instead of inventing a second identity model
- Legal/product docs currently describe marketplace economics as **70% seller / 30% platform**, so this brainstorm should align with that and not the earlier 50/50 assumption

## Why This Approach

Three strategies were considered:

1. **All-Apple IAP** -- route both subscriptions and marketplace purchases through StoreKit. Simple for App Store compliance but devastating for marketplace economics. Apple's 15% on top of a $2 deck sale, combined with the intended 70/30 marketplace split, still damages low-ticket deck economics and makes Stripe Connect payouts extremely complex since Apple doesn't pay sellers directly.

2. **All-web via Reader Rule** -- use the reader rule (post-2022 US settlement) to link users to the website for all purchases. Avoids Apple's cut entirely but risks App Store rejection. The reader rule applies to "reader" apps (content consumption), and AI Notecards generates content, not just reads it. Apple has rejected apps for stretching this definition. Too risky for a first submission.

3. **Hybrid: Apple IAP for subscriptions, web for marketplace** (chosen) -- Pro subscription goes through StoreKit on iOS and Stripe on web. Marketplace purchases open a Safari/in-app browser to the existing Stripe Checkout flow. This is what Etsy, Poshmark, and similar marketplace apps do. Apple explicitly allows external payment for physical goods and peer-to-peer transactions. Digital content marketplaces are a gray area, but the peer-to-peer creator marketplace framing (sellers set prices, sellers create content, platform facilitates) has been approved for numerous apps. The subscription is clearly a service that must go through IAP.

## Feature Details

### 1. Subscription Strategy: RevenueCat + Apple Small Business Program

**Problem:** The Pro subscription at $9/mo via Stripe needs an IAP equivalent on iOS. Apple takes a commission. At 30%, the $9 price yields $6.30 net. At 15% (Small Business Program), it yields $7.65 net. Meanwhile, Stripe takes ~2.9% + $0.30, yielding ~$8.44 net.

**Approach:**

- Enroll in the Apple Small Business Program (15% commission for developers earning under $1M/year). This is a no-brainer for an indie app.
- Keep the iOS price at $9.99/mo (Apple requires prices from their price tier list; $9.99 is the closest tier to $9). Net after Apple's 15%: ~$8.49. This actually matches Stripe net revenue almost exactly.
- Web price stays at $9/mo via Stripe. The $0.99 difference is negligible and doesn't violate Apple's anti-steering rules -- you just can't actively tell users "it's cheaper on the web."
- Offer a $79.99/year annual plan on both platforms (~$6.67/mo effective). Annual plans have higher LTV and lower churn. Apple reduces commission to 15% after the first year on auto-renewing subscriptions even without Small Business Program, so annual is doubly beneficial.
- Free and Trial tiers remain unchanged -- no payment involved, no platform dependency.

### 2. RevenueCat vs StoreKit 2 Direct

**Problem:** StoreKit 2 is Swift-native and modern, but the app is Expo/React Native. Direct StoreKit 2 integration requires a native module bridge. RevenueCat provides a React Native SDK (`react-native-purchases`) that abstracts StoreKit 2 and Google Play Billing.

**Approach:** Use RevenueCat.

- **react-native-purchases** is the most battle-tested React Native IAP library. The alternative, `react-native-iap`, has a history of breaking changes and inconsistent receipt validation.
- RevenueCat's free tier covers up to $2,500/mo in tracked revenue (first $2,500/mo in MTR is free). An indie app won't hit that for a long time, and even then it's 1% of revenue.
- RevenueCat provides a webhook to the server on subscription events (new purchase, renewal, cancellation, billing issue, expiration). This webhook writes to the same `plan` column that Stripe webhooks already write to.
- RevenueCat handles receipt validation server-side automatically. No need to implement App Store Server API v2 receipt verification manually.
- Cross-platform: if Android is added later, RevenueCat handles Google Play Billing with the same SDK and same webhook format.
- RevenueCat dashboard gives subscription analytics (MRR, churn, trial conversion) that would otherwise require building custom tooling on top of App Store Connect.

**What RevenueCat replaces:** It replaces direct StoreKit 2 calls, receipt validation, and subscription status polling. It does NOT replace Stripe -- Stripe continues to handle web subscriptions, marketplace payments, and Connect payouts.

### 3. Marketplace Purchase Strategy: Web Checkout on iOS

**Problem:** Marketplace deck purchases ($1-$5) currently go through Stripe Checkout with Stripe Connect destination charges. Apple's IAP rules require digital content purchased within an app to use IAP. But marketplace/platform apps where third-party sellers set prices and create content occupy a gray area.

**Approach:** Route marketplace purchases to the web, not through IAP.

- When an iOS user taps "Buy" on a marketplace deck, open an in-app `SFSafariViewController` (or `expo-web-browser`) pointing to the existing marketplace purchase page on the web app. The user completes Stripe Checkout in the browser, then returns to the app.
- The purchase fulfillment webhook fires as it does today. The app polls or receives a push notification to refresh the user's deck library.
- This is the same pattern used by Etsy, Depop, Poshmark, and other marketplace apps. Apple's guidelines (3.1.1) exempt "goods and services not consumed within the app" -- and while flashcard decks are consumed in-app, the marketplace framing as a multi-sided platform with independent sellers has been accepted for similar apps.
- If Apple rejects this approach during review, the fallback is to make the marketplace browse-only on iOS with a "Purchase on web" link. This is explicitly allowed under the reader rule changes and the US court settlement (Epic v. Apple).
- Do NOT implement IAP for marketplace purchases. The math doesn't work well at low price points: a $2 deck with Apple's 15% cut plus the intended 70/30 seller-platform split compresses already-small margins, and Apple pays the developer, not the seller -- so the platform would need to collect from Apple, then pay sellers via Stripe Connect, adding delay and reconciliation complexity.

**App Store review framing:** Position the app as a "learning marketplace platform" where independent educators create and sell content. The subscription unlocks creation tools. The marketplace is a peer-to-peer transaction facilitated by the platform. This framing is accurate and matches approved precedent.

### 4. Tier Mapping: Server-Side Source of Truth

**Problem:** A user might subscribe via Stripe on web, then open the iOS app. Or subscribe via Apple IAP on iOS, then log in on web. The `plan` column in the `users` table must reflect the correct status regardless of payment source.

**Approach:**

- The `users` table `plan` column remains the single source of truth. Both Stripe webhooks and RevenueCat webhooks write to it.
- Add a `subscription_platform` column to `users`: `'stripe'` | `'apple'` | `null`. This tracks where the active subscription originated.
- Add `revenuecat_app_user_id` column to `users` -- set to the user's UUID. RevenueCat uses this to identify users.
- On iOS app launch after native auth completes, call `Purchases.logIn(userId)` with the authenticated user's ID. RevenueCat then associates the Apple subscription with the correct user.
- The mobile app already receives `plan` through the existing auth payload and `/api/auth/me`, so the source-of-truth contract stays server-first rather than SDK-first.

**Current gap in the repo:** Stripe-backed subscription state exists today (`stripe_subscription_id`, billing portal flow, Stripe webhook writes to `plan`), but `subscription_platform` and `revenuecat_app_user_id` do **not** exist yet. This step will introduce them rather than “aligning” existing fields.

**Conflict resolution:** If a user has both a Stripe subscription and an Apple subscription (rare but possible):

- The server honors whichever subscription is active. If both are active, prefer the one that was created first (it has the longer history).
- On the RevenueCat webhook, before upgrading to Pro, check if `stripe_subscription_id` is already active. If so, skip the upgrade (user is already Pro) and log a warning.
- On subscription cancellation from either platform, only downgrade if the OTHER platform doesn't have an active subscription. Check both `stripe_subscription_id` and RevenueCat subscriber status before setting `plan = 'free'`.

**Trial handling:**

- The 7-day trial starts on signup regardless of platform. It's tracked by `trial_ends_at` in the database.
- If a user starts a trial on web and then subscribes via iOS IAP, the trial converts normally.
- RevenueCat supports free trials configured in App Store Connect. Use a 7-day free trial on the IAP product to match the web experience. RevenueCat's trial conversion tracking is a bonus.

### 5. Receipt Validation and Subscription Sync

**Problem:** When a user subscribes via Apple IAP on iOS, the server needs to know about it to update the `plan` column, and it needs to handle renewals, cancellations, and billing failures without regressing the existing Stripe webhook behavior.

**Approach:** RevenueCat handles all of this via its server-to-server webhook.

- Configure a RevenueCat webhook endpoint: `POST /api/revenuecat/webhook`.
- RevenueCat sends events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `BILLING_ISSUE`, `EXPIRATION`, `PRODUCT_CHANGE`.
- Webhook handler logic:

  | RevenueCat Event | Action |
  |-----------------|--------|
  | `INITIAL_PURCHASE` | Set `plan = 'pro'`, `subscription_platform = 'apple'`, clear trial fields |
  | `RENEWAL` | Ensure `plan = 'pro'` (no-op if already pro) |
  | `CANCELLATION` | Set `cancel_at_period_end = true`, `cancel_at` = expiration date |
  | `BILLING_ISSUE` | Log warning, send email via Resend (Apple handles retry) |
  | `EXPIRATION` | If no active Stripe subscription, set `plan = 'free'`, delist marketplace listings |
  | `PRODUCT_CHANGE` | Handle annual/monthly switch (update metadata) |

- Verify the RevenueCat webhook authorization header to prevent spoofing.
- This should mirror the existing Stripe webhook structure closely -- same state transitions, same downgrade side effects, and the same “server owns entitlements” rule.

**No direct App Store Server API calls needed.** RevenueCat abstracts the App Store Server Notifications v2 and handles grace periods, billing retries, and offer codes. This is the primary reason to use RevenueCat over raw StoreKit 2.

### 6. Seller Payouts on iOS

**Problem:** If marketplace purchases eventually go through Apple IAP (fallback scenario), how do sellers get paid? Apple pays the developer account, not individual sellers.

**Approach:** This is a non-problem with the chosen hybrid strategy.

- Marketplace purchases always go through Stripe (via web checkout), even when initiated from the iOS app. Stripe Connect destination charges work exactly as they do today. Sellers receive their 50% split directly from Stripe. No change to seller payout infrastructure.
- Stripe Connect onboarding happens on the web (it already does -- the Stripe Connect Express flow opens in a browser). On iOS, the seller onboarding link opens in `SFSafariViewController`.
- The Seller Dashboard in the iOS app displays earnings data fetched from the existing `/api/seller/dashboard` endpoint. No iOS-specific seller payout code needed.

**If Apple forces IAP for marketplace (worst case fallback):**

- Remove marketplace purchasing from the iOS app entirely. Make the marketplace browse-only on iOS with a "Buy on ainotecards.com" button.
- This is a viable fallback because marketplace browsing drives discovery, and motivated buyers will complete the purchase on web. Many apps do this (Kindle, Audible, Spotify).
- Sellers are unaffected in this scenario -- they still receive Stripe Connect payouts.

### 7. Price Parity and Anti-Steering Compliance

**Problem:** Apple's guidelines prohibit calling out lower prices outside the app or actively steering users away from IAP. But the 2021 settlement (effective 2022) allows developers to communicate with users via email about alternative payment methods.

**Approach:**

- iOS subscription price: $9.99/mo (Apple's price tier). Web subscription price: $9/mo. This $0.99 gap is standard practice -- Spotify, YouTube Premium, and most subscription apps charge slightly more on iOS.
- Do NOT show "cheaper on web" messaging anywhere in the iOS app. This violates guideline 3.1.1.
- Do NOT show the web price in the iOS app at all. The iOS subscription screen shows only the $9.99/mo IAP price.
- The web app shows $9/mo as it does today. No changes needed.
- Post-signup emails (sent via Resend) can mention that subscriptions are available at ainotecards.com. This is allowed under the 2022 settlement. But don't be aggressive about it -- a footer link is sufficient.
- Marketplace prices ($1-$5) are the same everywhere since they always go through Stripe. No parity issue.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| IAP library | RevenueCat (`react-native-purchases`) | Free tier sufficient, handles receipt validation, cross-platform, React Native SDK, subscription analytics included |
| Subscription on iOS | Apple IAP via RevenueCat | Required by App Store guidelines for digital services |
| Subscription on web | Stripe (unchanged) | Already built and working |
| iOS subscription price | $9.99/mo, $79.99/yr | Apple price tiers; net revenue matches Stripe after 15% commission |
| Apple commission rate | 15% via Small Business Program | Indie app, well under $1M threshold |
| Marketplace purchases on iOS | Web checkout via SFSafariViewController | Avoids IAP for marketplace, preserves Stripe Connect seller payouts, follows Etsy/Poshmark precedent |
| Seller payouts | Stripe Connect (unchanged) | Marketplace payments always flow through Stripe regardless of platform |
| Source of truth for plan status | `users.plan` column in PostgreSQL | Both Stripe and RevenueCat webhooks write to the same column |
| Subscription platform tracking | New `subscription_platform` column | Needed to resolve conflicts and route cancellations correctly |
| RevenueCat identity mapping | `revenuecat_app_user_id = users.id` | Avoids a second identifier scheme on mobile |
| Annual plan | $79.99/yr on both platforms | Higher LTV, lower churn, better Apple commission after year 1 |
| Fallback if Apple rejects marketplace checkout | Browse-only marketplace on iOS, purchase on web | Kindle/Audible model; preserves seller economics |

## Resolved Questions

- **Manage subscription routing:** Yes. Show “Manage Subscription” based on `subscription_platform` — Apple subscribers go to Apple’s manage-subscription surface, Stripe subscribers go to the Stripe billing portal.
- **Existing Stripe subscribers on iOS:** Treat them as already entitled. The app should never prompt an already-Pro user to subscribe again just because they authenticated on iOS.
- **RevenueCat experiments / pricing tests:** Not for v1. Keep pricing static until the base dual-platform billing path is stable.
- **Marketplace review fallback:** Keep a browse-only fallback ready for iOS if Apple rejects external marketplace checkout during review.
- **Annual web parity:** Yes. Annual pricing should exist on both platforms; the implementation plan should include the Stripe annual price ID and pricing-surface updates.

## Open Questions

- None blocking for planning. The remaining uncertainty is App Review outcome for marketplace checkout, and that is already handled by the explicit browse-only fallback.

## Scope Boundaries

**In scope:**

- RevenueCat SDK integration in Expo/React Native app
- Apple IAP product configuration (monthly + annual Pro subscription)
- RevenueCat webhook endpoint on the server (`/api/revenuecat/webhook`)
- `subscription_platform` and `revenuecat_app_user_id` columns on `users` table
- SFSafariViewController flow for marketplace purchases on iOS
- Apple Small Business Program enrollment
- Dual cancellation/expiration logic (check both platforms before downgrade)

**Out of scope:**

- Google Play Billing (RevenueCat supports it, but Android is not the current target)
- Promotional offers or introductory pricing on IAP (future optimization)
- RevenueCat Experiments / A/B pricing (YAGNI for launch)
- Replacing Stripe for web subscriptions (Stripe stays as-is)
- IAP for marketplace purchases (explicitly rejected)
- In-app purchase restoration UI beyond what RevenueCat handles automatically
- Family Sharing for subscriptions (low priority, complex)

## Next Steps

-> `/workflows:plan` for implementation details
