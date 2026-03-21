---
title: iOS Native Experience & App Store Launch
type: feat
date: 2026-03-15
origin: docs/brainstorms/2026-03-15-ios-native-experience-and-app-store-launch-brainstorm.md
deepened: 2026-03-15
---

# iOS Native Experience & App Store Launch

## Enhancement Summary

**Brainstorm found:** `docs/brainstorms/2026-03-15-ios-native-experience-and-app-store-launch-brainstorm.md`
**Local research:** `mobile/app.json`, `mobile/app/_layout.tsx`, `mobile/app/(tabs)/profile.tsx`, `mobile/src/lib/auth.tsx`, `mobile/src/lib/network.tsx`, `docs/solutions/feature-patterns/pre-launch-checklist.md`
**External research:** Expo push notifications setup + sending docs, Expo iOS universal links docs, Apple App Review Guidelines, Apple App Store Connect privacy docs
**Skills applied:** `workflows-plan`, `deepen-plan`

### Key Planning Findings

1. **The mobile foundation already exists** — auth, billing, biometrics, offline study, and browser handoff are already in place, so this plan should not reopen earlier iOS work.
2. **Push is the highest-leverage remaining native feature** — it directly improves retention and is now justified by the presence of streaks, offline sync, and marketplace activity.
3. **Universal links must be additive** — the app already declares a custom scheme, so universal links should complement existing routing rather than replace it.
4. **App Review posture is part of the feature** — review notes, demo account quality, privacy disclosures, and a marketplace fallback toggle are launch-critical, not postscript work.
5. **Launch scope should stay narrow** — notifications, links, haptics, sharing, crash monitoring, and launch operations are in; widgets, rich notifications, and full gesture rewrites stay out.
6. **Launch notifications should stay product-focused** — ship study reminders and marketplace events first; defer subscription-renewal or marketing-style nudges.
7. **Real-device testing is a hard requirement** — push delivery, universal links, and release-like crash monitoring cannot be meaningfully signed off in simulators or Expo Go.
8. **Reminder timing should follow device-local time by default** — use device-reported IANA timezone data, not manual timezone selection or UTC-only heuristics for v1.
9. **Push tokens should be globally unique and transferable** — the latest authenticated registration should own the token to avoid cross-account notification leakage on shared devices.

## Technical Review Findings

### P1 — Critical

1. **Push delivery must not depend on app-open polling** — sale and purchase-ready notifications need a backend-triggered send path, not a “refresh when the app opens” workaround.
2. **Review-safe browser commerce fallback must exist before submission** — marketplace purchase capability should be feature-flagged so App Review risk can be managed without a last-minute refactor.
3. **Mobile crash monitoring is required for phased release decisions** — a seven-day rollout without client-side crash visibility is guesswork.
4. **Notification jobs need dedupe and invalid-token cleanup** — otherwise retries, expired tokens, or repeated purchase events will create noisy launch behavior and support burden.

### P2 — Important

1. **Universal-link coverage should be intentionally narrow** — only supported, review-tested paths should deep-link into the app at launch.
2. **Notification permissions should be timed carefully** — asking on first launch is a conversion and trust risk; request only after the user sees clear value.
3. **Gesture polish must not destabilize offline study** — the offline study flow is newly implemented and should not be rewritten just to add “more native feel.”
4. **Privacy labels must include third-party SDK behavior** — the App Store Connect answers need to reflect RevenueCat, Sentry, and push-token handling, not just first-party server data.
5. **AASA changes are sticky and cache-sensitive** — treat hosted file changes and device reinstall/update cycles as part of the verification plan, not an afterthought.

## Overview

Finish the native iOS product layer needed to launch AI Notecards confidently on the App Store.

This plan covers:

- push notifications with minimal backend delivery infrastructure
- universal links and web-return routing
- haptic and share-sheet polish
- minimal launch-safe gesture improvements
- mobile crash monitoring
- App Store metadata, privacy disclosures, review notes, TestFlight, and phased release

This plan explicitly assumes the previously completed iOS work remains intact:

- auth and biometric gating
- RevenueCat-backed iOS subscriptions
- browser handoff for marketplace and billing web flows
- offline deck downloads and offline study sync

It also intentionally updates one existing cross-platform product rule:

- study-day and streak-day semantics should use the user’s stored local timezone boundary instead of UTC

## Problem Statement

AI Notecards now has a real iOS app, but it is not fully launch-ready. The current gaps are no longer “core product missing” gaps. They are launch-layer gaps:

- no push stack for re-engagement or marketplace fulfillment events
- no universal links for browser-to-app handoff
- no native haptic/share polish on the key study and marketplace flows
- no mobile crash-monitoring baseline for TestFlight and phased rollout
- no complete App Store submission package for review, privacy disclosures, and rollout operations

Without this work, the app may still function, but it will feel unfinished on iOS, lose retention opportunities, and go into App Review and rollout without enough operational safety.

## Chosen Product Decisions

- Keep **push notifications in launch scope**
- Keep launch notifications limited to:
  - streak at risk
  - daily study reminder
  - marketplace sale notification
  - purchased deck ready / fulfillment notification
- Keep **subscription-renewal / expiration nudges out of launch scope**
- Add **universal links alongside the existing custom scheme**
- Keep marketplace browser checkout enabled, but guard purchase entry with a **review-safe feature flag**
- Ship **haptics** in launch scope
- Treat **swipe-to-rate flip mode** as optional stretch work, not a blocker
- Keep **widgets post-launch**
- Use **device-reported timezone sync** for reminder scheduling in v1
- Use **device-local timezone as the canonical study/streak day boundary**
- Make **push token ownership latest-registration-wins**

## Proposed Solution

### Phase 1 — Push notification foundation

Use Expo’s notification stack in the client and a server-owned delivery path for launch.

**Client**

- Install and configure:
  - `expo-notifications`
  - `expo-device`
- Add the Expo notifications config plugin in `mobile/app.json`
- Set an app-wide notification handler intentionally:
  - foreground study reminders should not interrupt active study sessions unexpectedly
  - sale / purchase-ready notifications can show alert + sound
- Add permission request and token registration flow in the mobile app
- Defer the permission prompt until after:
  - auth is complete
  - the user has reached a relevant screen or explicit notification CTA
- Store the Expo push token plus platform/device metadata locally long enough to register/unregister reliably
- Also send the current device IANA timezone on registration and when it changes
- Re-register on these transitions:
  - fresh login
  - app reinstall / token refresh
  - permission state changes from denied to granted
- Sync timezone on these transitions too:
  - app foreground after timezone change
  - successful auth/session restore
- Unregister on logout best-effort, but do not rely on logout for correctness; the server must tolerate stale tokens

**Server**

- Add a `device_tokens` table:
  - `id`
  - `user_id`
  - `platform`
  - `provider`
  - `token`
  - `timezone`
  - `status`
  - `created_at`
  - `updated_at`
  - `last_used_at`
  - global unique constraint on `token`
- Add endpoints:
  - `POST /api/notifications/devices`
  - `DELETE /api/notifications/devices/:token`
- Validate auth, CSRF posture, and input shape
- Normalize token upserts so repeated registration from the same device is cheap and idempotent
- Registration should transfer token ownership to the latest authenticated user automatically if the token was previously associated with another account
- Track a last-known notification permission state if lightweight enough to support cleanup and support debugging
- Build a notification service abstraction that sends via Expo Push Service at launch
- Keep provider-specific code behind a service seam so direct APNs can be added later without route churn
- Add response handling for invalid / unregistered tokens and mark them inactive instead of retrying forever
- Batch sends conservatively and log provider ticket / receipt failures with user-safe context only

**Launch notification triggers**

- **Streak at risk**
  - scheduled backend job
  - only users with a meaningful streak and reminders enabled
  - evaluate using the same local-time study/streak day boundary used by the core study domain
- **Daily study reminder**
  - scheduled backend job
  - only explicit opt-in users
  - use device-local scheduling, not UTC approximation
- **Marketplace sale notification**
  - purchase completion path for sellers
  - must be idempotent across webhook retries / duplicate purchase-finalization paths
- **Purchased deck ready**
  - purchase completion path for buyers
  - must be coordinated with fulfillment completion, not merely checkout start

**Important constraints**

- No marketing/promotional notifications at launch
- No in-app inbox
- No rich media
- Respect opt-out / preference state everywhere
- Reuse the existing preference model explicitly as:
  - `notifications.study_reminders` → controls both daily reminder and streak-at-risk notifications
  - `notifications.marketplace_activity` → controls both seller sale and buyer purchase-ready notifications
- Define one shared payload shape for launch notifications:
  - `type`
  - `title`
  - `body`
  - optional `url`
  - optional lightweight metadata for routing
- Route taps through the same universal-link path model where possible to avoid parallel deep-link logic
- Do not introduce a manual timezone picker for v1; device timezone is the source of truth unless the product later adds explicit reminder-time customization
- Apply the same local-time boundary to core study semantics:
  - “studied today”
  - current streak
  - longest streak progression
  - daily-reminder eligibility
  - streak-at-risk eligibility

### Phase 2 — Universal links and return routing

Add installed-app routing for the high-value web URLs already used by the product.

**Website / server**

- Serve `/.well-known/apple-app-site-association`
- Keep the file small and path-scoped
- Host over HTTPS with the correct content type
- Do not redirect the AASA path
- Keep the file environment-aware if staging and production domains differ
- Include only launch-supported paths:
  - `/marketplace`
  - `/marketplace/*`
  - `/verify-code`
  - `/seller/onboard/return`

**Mobile config**

- Add `ios.associatedDomains` to `mobile/app.json`
- Keep the existing custom scheme unchanged
- Ensure Expo Router handles inbound HTTP(S) routes without breaking current scheme-based paths

**Routing behaviors**

- Marketplace listing links open native listing detail when installed
- Marketplace root opens native browse screen
- Verify-code links route into native verification flow
  - prefill `email` when present in the URL
  - prompt for email in-app when it is missing instead of dead-ending the flow
- Seller onboarding return routes into a native refresh/re-entry surface
- Unsupported paths stay on web without awkward half-routing

**Verification**

- test installed-app behavior on a real device
- test fallback behavior with the app not installed
- test seller-return and magic-link entry paths specifically
- test after reinstall or version update because AASA caching and entitlement changes can be misleading during iteration
- verify that notification-tap routing and raw Safari-entry routing land on the same destination behavior

### Phase 3 — Native polish: haptics, sharing, and safe gesture enhancements

Add the smallest set of native interaction improvements that materially improve feel without risking regressions.

**Haptics**

- Install `expo-haptics`
- Add a small `useHaptics()` wrapper to keep calls centralized and easy to disable
- Trigger haptics for:
  - card reveal / flip
  - correct answer
  - incorrect answer
  - pull-to-refresh
- Add a user preference toggle if the implementation stays lightweight and can map cleanly onto existing preferences
- If the preference toggle is added, keep it server-backed only if the mobile app already syncs the relevant preference domain cleanly; otherwise make it device-local for launch and avoid expanding settings scope unnecessarily

**Share sheet**

- Add native share actions for:
  - marketplace listing detail
  - study results summary
- Share text + URL only for launch
- Include public marketplace URLs when available
- Avoid generated image assets and custom card rendering in v1
- Keep share message builders in a single utility module so listing titles, URLs, and score summaries remain consistent across surfaces and tests

**Gesture polish**

- Keep pull-to-refresh where it already fits
- Only add swipe-to-rate for flip mode if:
  - the implementation can be layered onto the current study screen
  - offline session semantics remain unchanged
  - the result is clearly more polished than the current button flow
- If those conditions are not met, defer swipe-to-rate and keep the haptic pass only
- Explicitly prefer no change over a partially polished gesture system that competes with the current offline button flow

### Phase 4 — Mobile crash monitoring and launch instrumentation

Add enough mobile observability to support TestFlight and phased rollout decisions.

- Integrate a mobile-compatible Sentry SDK
- Keep initialization env-gated
- scrub obvious PII where supported by the SDK path used
- identify the current user by stable ID only
- capture link-handling failures, notification permission/token failures, and critical marketplace/browser handoff failures
- verify that native errors and JS exceptions surface in the release-like build path you will actually submit
- Ensure monitoring is initialized early enough to capture startup and linking failures, but after env/config validation so noisy boot misconfiguration does not pollute the signal
- Add a short launch dashboard checklist:
  - crash-free sessions
  - top exception groups
  - notification registration failures
  - link-routing failures

This phase is intentionally minimal. It is not a full analytics redesign.

### Phase 5 — App Review and App Store submission package

Turn the current app into a reviewable, operationally safe submission.

**Review posture**

- Prepare a reviewer demo account with:
  - active login
  - at least one downloaded deck
  - visible subscription surface
  - visible marketplace browsing data
- Write reviewer notes that explain:
  - where Apple IAP is visible
  - how Restore Purchases works
  - how Manage Subscription works for Apple subscribers
  - that marketplace purchases use browser handoff
  - that offline deck study is supported
  - whether the marketplace purchase flag is enabled in the submitted build
- Add one internal pre-submission verification step that compares:
  - reviewer notes
  - actual feature-flag state
  - current build behavior
  This avoids the common failure mode where reviewer notes describe a different runtime than the uploaded build.

**Privacy / metadata**

- Prepare App Privacy answers that cover:
  - account data
  - push tokens
  - purchase/subscription data
  - crash data
  - third-party SDK disclosures
- Prepare a small source-of-truth matrix before filling App Store Connect:
  - data element
  - source SDK / server path
  - linked-to-user or not
  - purpose
- Confirm privacy policy URL is current
- Finalize:
  - app name
  - subtitle
  - keyword list
  - category selection
  - description text

**Screenshots**

- capture the highest-signal native screens:
  - generate
  - offline study
  - marketplace
  - subscription/profile
  - streak/progress
- Prefer truthful screenshots from the actual app over mock-heavy marketing art
- Capture screenshots from a release-like build where possible so native subscription, offline, and marketplace states match the shipped product exactly

**TestFlight and rollout**

- internal TestFlight first
- closed beta second
- staged submission after crash/flow validation
- phased release on production launch
- pause criteria documented ahead of time
- Define minimum readiness gates before expanding tester count:
  - no broken auth entry path
  - no broken subscription purchase / restore path
  - no broken marketplace browse path
  - no broken offline-study sync path
- Define pause / rollback signals for phased release:
  - repeated crash cluster on one stack trace
  - notification delivery failure due to token / provider bug
  - universal-link misrouting to dead-end screens
  - any entitlement or purchase regression

### Phase 6 — Review-safe marketplace fallback

Prepare the fallback before it is needed.

- Add or verify a server-backed feature flag for iOS marketplace purchase availability
- Make the flag readable in the mobile API contract rather than only as hidden server config so UI behavior is explicit and testable
- When disabled:
  - marketplace browsing remains available
  - listing detail explains that purchase is temporarily unavailable in-app
  - browser purchase CTA is hidden or blocked consistently
- Ensure reviewer notes and runtime behavior always match

This is operational insurance. It should not require a code scramble after review feedback.

## Research Insights

### Existing repo patterns to follow

- `mobile/app/_layout.tsx` already establishes a provider-driven mobile root; notifications and link listeners should follow the same centralized setup pattern.
- `mobile/src/lib/auth.tsx` already owns session hydration and user identity transitions; push-token registration should piggyback on authenticated identity, not invent a second auth concept.
- `server/src/routes/settings.js` already has a constrained preferences contract with `notifications.study_reminders` and `notifications.marketplace_activity`; launch notification scope should map onto those existing switches rather than proliferating new preference keys immediately.
- `mobile/app/(tabs)/profile.tsx` is already the account/settings surface for billing and device-specific controls, so notification settings and review-facing subscription affordances should remain anchored there.
- `docs/solutions/feature-patterns/pre-launch-checklist.md` already captures reviewer-note expectations and pre-submission rigor; this plan should extend that pattern, not create a parallel launch checklist philosophy.
- The current mobile provider structure (`ThemeProvider` → `ErrorBoundary` → query persistence → `AuthProvider` → `NetworkProvider`) is a good place to anchor notifications, link listeners, and launch-safe global instrumentation without scattering lifecycle code.

### External research notes

- Expo’s official push setup docs say iOS push notification testing requires a real device and is easiest with EAS Build or equivalent credentialed builds.
- Expo’s notifications docs support both Expo push tokens and native push tokens; launch should prefer the lower-friction Expo Push Service path.
- Expo’s universal-link docs require both a hosted AASA file and `ios.associatedDomains` in app config; Apple’s verification behavior is install/update-sensitive, so path changes need deliberate testing.
- Apple’s review guidance emphasizes complete metadata, working URLs, active demo access, and visible in-app purchases during review.
- Apple’s push-notification guidance requires opt-in for promotional use; keeping launch notifications transactional / user-value-oriented is safer.
- Apple’s App Store privacy docs require answers that reflect both first-party collection and third-party SDK behavior.
- Apple’s universal-link behavior is notoriously sensitive to domain, entitlement, and installed-build alignment; the practical implication is that “config looks right” is not sufficient evidence.

## Technical Considerations

### Current code paths to extend

- `apps/ai-notecards/mobile/app.json`
- `apps/ai-notecards/mobile/app/_layout.tsx`
- `apps/ai-notecards/mobile/app/(tabs)/profile.tsx`
- `apps/ai-notecards/mobile/app/(tabs)/marketplace/index.tsx`
- `apps/ai-notecards/mobile/app/(tabs)/marketplace/[id].tsx`
- `apps/ai-notecards/mobile/app/study/[deckId].tsx`
- `apps/ai-notecards/mobile/src/lib/auth.tsx`
- `apps/ai-notecards/mobile/src/lib/api.ts`
- `apps/ai-notecards/mobile/src/lib/network.tsx`
- `apps/ai-notecards/server/src/index.js`
- `apps/ai-notecards/server/src/routes/*`
- `apps/ai-notecards/server/src/services/*`
- `apps/ai-notecards/docs/solutions/feature-patterns/pre-launch-checklist.md`

### SpecFlow analysis: must-work flows

1. **Authenticated user enables notifications**
   - permission prompt appears intentionally
   - token registration succeeds
   - backend persists one active device token for the user
   - duplicate registration does not create duplicate rows or duplicate sends
   - current device timezone is persisted alongside registration

2. **User with reminders enabled is at risk of losing a streak**
   - scheduler identifies the user correctly
   - notification sends once
   - disabled reminders or missing tokens suppress delivery
   - delivery timing is based on the stored device timezone rather than server UTC

3. **Marketplace purchase completes**
   - seller receives a sale notification
   - buyer receives purchase-ready notification
   - duplicate sends are suppressed for retrying jobs
   - invalid or stale tokens are removed from active delivery without failing the purchase flow

4. **User taps a supported universal link**
   - installed app opens the correct native screen
   - unsupported or not-installed flow falls back cleanly to the web page

5. **User shares a marketplace listing or study result**
   - native share sheet opens
   - text and URL payload are correct

6. **User studies offline and later returns online**
   - offline sync still behaves as before
   - new haptic/share additions do not affect session correctness

7. **Marketplace review-safe fallback is enabled**
   - browsing still works
   - purchase affordances are consistently disabled
   - review notes remain truthful

8. **TestFlight / release build throws a mobile exception**
   - monitoring captures it
   - release decisions can be made from real crash data

9. **Reviewer notes are exercised literally**
   - a reviewer following the written notes can reach login, subscription, restore, marketplace, and offline-study surfaces without extra explanation

10. **Device token ownership changes across accounts**
   - the same physical device token is reassigned to the latest authenticated user
   - prior users do not continue receiving notifications on that token

## Dependencies

- Apple Developer account and push credentials
- EAS or equivalent signed iOS build path for device testing
- Expo notification setup
- hosted HTTPS domain for AASA
- App Store Connect app record and metadata access
- reviewer demo account data
- environment-specific config management so staging / production domains, bundle IDs, and associated domains do not drift

## Risks And Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Push setup blocks on credentials or device-only testing | High | Make push Phase 1, validate on a real device immediately, do not bury it behind polish work |
| Universal links fail due to AASA or entitlements mismatch | High | Keep path list narrow, validate file hosting early, test install/update behavior on device |
| Marketplace purchase flow triggers review concern | High | Keep review-safe feature flag and document its intended reviewer state before submission |
| Gesture polish destabilizes offline study | Medium | Make swipe-to-rate optional and keep haptics/share work independent |
| Privacy answers under-disclose third-party SDK behavior | High | Build the privacy matrix from actual integrated SDKs, not assumptions |
| Phased release lacks enough observability | High | Add mobile Sentry before TestFlight expansion |
| Invalid push tokens cause noisy retry loops | Medium | Mark failed tokens inactive and add cleanup/observability from day one |
| Reviewer notes diverge from build behavior | High | Add explicit pre-submission note-vs-build verification gate |

## Out Of Scope

- WidgetKit / widgets
- rich push notifications
- in-app notification inbox
- subscription-renewal or marketing push campaigns
- full redesign of study interactions
- dedicated iPad layouts
- Android launch work

## Acceptance Criteria

- [ ] `expo-notifications` is configured and tested on a real iOS device
- [ ] Authenticated users can register and unregister a device token successfully
- [ ] Study-reminder and marketplace-event notifications can be triggered end-to-end in a dev/test environment
- [x] App config and site hosting support iOS universal links for the agreed launch paths
- [ ] Supported universal links open the correct native screens when installed and fall back to web when not installed
- [x] Native share sheet works for marketplace listings and study-result summaries
- [x] Haptics are present on the agreed launch interactions and do not break offline study behavior
- [ ] Mobile crash monitoring is active in release-like builds
- [ ] Review notes, privacy disclosures, screenshots, and demo-account instructions are prepared and consistent with the submitted build
- [x] Marketplace purchase fallback can be toggled to browse-only without invasive code changes

## Verification Plan

### Automated

- mobile unit tests for:
  - notification preference / registration helpers
  - universal-link route parsing
  - share payload builders
  - feature-flag marketplace fallback behavior
  - timezone sync helpers
- mobile component/integration tests for:
  - permission CTA timing logic
  - link listener routing decisions
- server tests for:
  - device registration endpoints
  - notification send service input validation
  - scheduler / trigger logic
  - invalid-token handling
  - deduped marketplace event notification dispatch
  - token reassignment across different authenticated users
  - timezone-aware reminder selection

### Manual

- install a real iOS dev build and verify push permission flow
- send a test notification to the device
- tap a universal link from Safari, Notes, and Messages
- test marketplace browser handoff with fallback both enabled and disabled
- validate share-sheet behavior on a physical device
- verify App Review demo account instructions exactly against the current build
- verify App Privacy answers against the integrated SDK list before submission
- reinstall the app and repeat universal-link + push-registration smoke tests
- verify foreground notification behavior does not disrupt an active study session unexpectedly
- verify logout/login rotates device-token ownership correctly for shared-device scenarios if relevant
- change the device timezone and verify the next registration/sync updates server state

## Implementation Sequence

1. Push notification plumbing, token lifecycle, and first end-to-end send
2. Universal links + return routing + AASA verification
3. Mobile Sentry / crash monitoring in release-like build path
4. Review-safe marketplace fallback wiring
5. Haptics and share sheet
6. Optional gesture polish if still justified
7. Review package, screenshots, metadata, and rollout prep

## Next Step

After plan approval, execute with `workflows-work` and keep push setup / universal-link validation at the front of the queue so launch risk becomes visible early.
