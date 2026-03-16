---
date: 2026-03-15
topic: ios-native-experience-and-app-store-launch
---

# iOS Native Experience & App Store Launch

## What We're Building

The last mile of the iOS product: the native experience work and launch pipeline that still remain after the recent auth, monetization, and offline-study efforts. This is no longer a “wrap the web app” discussion. The Expo app already has native auth, biometric session gating, RevenueCat-backed subscriptions, offline deck downloads, local study sync, and an offline-aware tab shell. The remaining question is how to turn that working foundation into an App Store-ready product that feels intentionally native and survives review.

This brainstorm covers the final native product layer that still matters for launch: push notifications, universal links, haptics, gesture polish, share sheet behavior, App Store operations, TestFlight, review posture, and phased release. It also reclassifies a few earlier assumptions that are now stale.

## Why This Approach

The current mobile app is past “scaffold” stage. Because the hard foundation is already in place, the highest-leverage work is not another round of generic parity work. It is a focused launch pass that sharpens re-engagement, link handoff, tactile feedback, and App Store submission mechanics without reopening solved platform decisions.

The right framing is: keep building on the existing Expo app, preserve the current shared backend and billing model, and add only the native integrations that materially change launch readiness. That means choosing features that improve retention and App Store acceptance, while explicitly deferring nice-to-have iOS extras that add build complexity without changing launch odds.

## Current State Snapshot

What already exists in the repo:

- Native auth flows with Apple, Google, magic-link verification, and biometric session lock
- Native tab shell with themed screens and native routing
- RevenueCat + StoreKit support for iOS Pro subscriptions
- Browser handoff for marketplace purchases and seller/billing web flows
- Offline deck downloads, local study sessions, queued sync, and offline-aware UI
- Profile surface with billing, restore purchases, and download management

What does **not** exist yet:

- APNs registration and push delivery
- Universal links / Apple App Site Association setup
- Native share sheet integration
- Haptic feedback integration
- Gesture-driven study interactions
- iOS-specific analytics / crash instrumentation on the mobile client
- Launch assets and App Store Connect submission workflow

## Feature Details

### 1. Push Notifications

Push notifications stay in launch scope.

They are the only remaining native feature here that materially improves retention before launch. Offline study now exists, streaks exist, marketplace purchases exist, and billing exists. That means the app finally has meaningful events worth notifying about.

Recommended launch notification types:

- Streak at risk
- Daily study reminder
- Marketplace sale notification
- Purchased deck ready / fulfillment notification

Approach:

- Use `expo-notifications` for permission prompts, token registration, and foreground/background handling
- Add backend device-token registration endpoints and a `device_tokens` table keyed by `user_id`
- Reuse the existing preferences model rather than inventing a mobile-only notification settings system
- Keep launch notifications plain text only; no inbox, no media, no category actions

Important scope guard: this is not an in-app notification center. It is delivery only.

### 2. Universal Links And Return Flows

The original brainstorm treated universal links as a replacement for custom URL schemes. That is no longer the right framing. The app already declares a custom scheme in Expo config. The new decision is to **add universal links on top of the existing scheme**, not to replace it.

Universal links matter now because the current app has real browser handoff paths:

- marketplace listing open/buy flows
- seller onboarding return flows
- magic-link / verification entry points
- billing portal / subscription-adjacent returns where web fallback still matters

Recommended mappings:

- `ainotecards.com/marketplace/:id` → native marketplace listing when installed
- `ainotecards.com/marketplace` → native marketplace browse
- `ainotecards.com/verify-code` → native verification flow
- `ainotecards.com/seller/onboard/return` → native profile or seller state refresh screen
- any unsupported route → safe web fallback

The key product goal is not “all links open in app.” It is “all important links have a sensible installed-app path and a safe browser fallback.”

### 3. Haptics And Gesture Polish

This is now a product-polish pass, not a speculative architecture discussion.

The dependencies needed for gesture work already exist in the mobile app. The remaining question is where tactile feedback adds value without forcing a rewrite of the study experience that was just implemented.

Recommended launch scope:

- Haptic confirmation on correct / incorrect study actions
- Light haptic on card reveal or flip
- Pull-to-refresh haptic on home / marketplace refresh
- Optional swipe-to-rate interaction only for flip mode, if it can be layered onto the current local study screen without destabilizing the new offline flow

Recommendation: ship haptics for launch, but treat gesture-heavy flip-mode interaction as a stretch launch item. The current study implementation is intentionally simple and offline-safe. It should not be destabilized just to chase a flashier interaction model.

### 4. Native Share Sheet

This has become more valuable after the marketplace and study work landed.

Recommended launch share points:

- Marketplace listing share
- Study-result share from the offline results screen

Approach:

- Use React Native `Share` or Expo-compatible native share API
- Prefer plain text + URL at launch
- Include marketplace URL when the content is public
- Skip generated image cards and custom share graphics for v1

This gives the app a native-feeling growth loop without opening a new design system problem.

### 5. Launch Operations And App Review

This section needs to reflect the current business and platform reality.

Important current truths:

- Pro subscriptions on iOS already belong to StoreKit via RevenueCat
- Marketplace purchases remain browser handoff flows, not Apple IAP purchases
- Offline study is already in the product, so review notes must explain what works offline versus what still requires internet
- Seller economics are 50/50 across web and iOS-driven commerce paths; the platform source should not change seller payout semantics

App Review positioning:

- Explain that Pro subscriptions are available in-app through Apple IAP
- Explain that marketplace transactions are user-to-user marketplace purchases handled via browser handoff
- Explain that downloaded decks can be studied offline and sync later
- Provide demo account credentials plus exact steps to reach subscription, restore, and marketplace flows
- Call out any review-safe fallback behavior if browser purchases are temporarily browse-only in the iOS app

### 6. Widgets

Widgets remain explicitly post-launch.

The recent offline and monetization work was high-value foundation work. Widgets are not. They require extra native target complexity and do not materially improve review odds or launch readiness compared with push notifications.

Keep them in the v1.1 bucket unless launch goes unusually smoothly.

## Key Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| iOS subscription billing | Keep StoreKit via RevenueCat | Already implemented and required for App Store approval |
| Marketplace billing on iOS | Keep browser handoff | Matches current architecture and marketplace positioning |
| Seller payout semantics | 50/50 everywhere | Platform source must not change seller economics |
| Offline study | In launch scope already | Implemented foundation exists; launch docs/review notes must reflect it |
| Push notifications | In launch scope | Highest-leverage remaining native retention feature |
| Universal links | Add alongside custom scheme | Better installed-app UX without sacrificing existing route handling |
| Haptics | In launch scope | High native feel for relatively low complexity |
| Gesture-heavy flip rewrite | Stretch only | Nice polish, but lower priority than stability and launch ops |
| Widgets | Post-launch | Low ROI for launch, high native build complexity |
| App preview video | Skip at launch | Screenshots and polished listing copy matter more right now |

## Resolved Questions

- **Offline study:** No longer an open question. The offline study/download/sync foundation already exists and should be treated as part of the launch product.
- **Subscription path on iOS:** Already resolved. StoreKit + RevenueCat remains the only correct iOS subscription path.
- **iPad layout:** `supportsTablet` is already enabled. Dedicated iPad optimization is still not a launch blocker.
- **Custom scheme vs universal links:** We already have a custom scheme. Universal links should complement it.

## Open Questions

- Should marketplace browser handoff remain fully enabled at launch, or should the iOS app ship with a review-safe browse-only fallback toggle that can be enabled if review risk appears higher than expected?
- Do we want push notifications to include only study reminders and marketplace events at launch, or also operational messages like subscription-renewal / expiration nudges?

## Implementation Priority

**Phase 1 — Native launch blockers**
1. Push notification stack: permissions, device registration, backend delivery, minimal preference wiring
2. Universal links and return-path handling
3. App Store review notes, demo account, privacy labels, and TestFlight-ready metadata

**Phase 2 — Native launch polish**
4. Haptic feedback on study and refresh interactions
5. Native share sheet for marketplace listings and study results
6. Minimal gesture polish where it does not destabilize offline study

**Phase 3 — Submission and rollout**
7. Screenshots and ASO copy
8. Internal TestFlight
9. Closed beta
10. App Review submission and phased release

**Phase 4 — Post-launch**
11. Widgets
12. iPad-specific layout improvements
13. Richer gesture systems or more ambitious study animations

## Scope Boundaries

**In scope:**

- APNs push notifications
- Universal links and browser-return handling
- Native haptics
- Native share sheet
- App Store launch assets, review notes, privacy labels, and TestFlight
- Phased release and launch monitoring

**Out of scope:**

- WidgetKit extension work
- Rich push notifications
- In-app notification inbox
- Full gesture rewrite of every study mode
- Dedicated iPad redesign
- Android launch work

## Next Steps

→ `/workflows:plan` for implementation details
