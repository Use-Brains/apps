AI Notecards — Corrected iOS Launch Pre-Flight Checklist & Execution Brief
Date: March 22, 2026
Audience: Founder / Codex / Polsia
Purpose: Builder-facing launch document grounded in current repo reality

# 1. Current launch-product alignment

## What AI Notecards is trying to launch as

AI Notecards is trying to launch as an AI-powered flashcard and study app with a serious buyer-facing marketplace layer. The core user loop is:

- create decks from text, notes, or photos
- study those decks on iOS with multiple study modes
- browse curated marketplace decks
- evaluate marketplace decks through title, description, ratings, seller attribution, and pricing
- access and study marketplace decks the user has obtained

The buyer marketplace is strategically important. It should not be treated as decorative browse-only fluff if the product is going to market itself as a marketplace app.

## Intended buyer marketplace scope for launch

What looks firm:

- marketplace browse matters
- marketplace detail matters
- marketplace should feel like a real product surface, not a hidden beta tab
- purchased marketplace decks should be accessible and studyable in a trustworthy way

What is not yet settled in the repo:

- the final iOS purchase mechanism for marketplace decks

Current repo reality:

- the mobile marketplace detail screen currently opens a browser checkout flow when enabled
- that flow is gated by an iOS-specific availability flag
- the backend handoff build currently returns placeholder purchase responses

This means the product intent is clear, but the final launch-safe implementation path is not yet locked.

## Likely seller marketplace scope for launch

Seller creation, onboarding, listing management, and payout tooling still look deferrable.

Evidence in the current repo:

- seller tools default to disabled in runtime config
- mobile seller screens are placeholder-level
- the handoff docs explicitly treat seller flows as deferred / shell surfaces

Best current interpretation:

- launch should preserve buyer marketplace seriousness
- seller tooling can slip to later if needed
- seeded and curated marketplace content is the near-term bridge

## What appears firm vs flexible

Firm:

- AI generation from text and photos
- iOS as a primary launch surface
- multiple study modes
- offline-aware study behavior
- subscriptions via Apple / RevenueCat path
- buyer marketplace importance
- seller tooling being negotiable

Flexible:

- whether iOS marketplace purchasing is enabled at launch
- whether web remains mostly marketing / companion vs full commercial surface
- how much onboarding is required before TestFlight
- how much marketplace inventory is enough for first launch

# 2. Current app structure and launch implications

## Major product areas that clearly exist

- iOS app environments, bundle IDs, associated domains, and EAS profiles exist
- Apple Sign In is configured for preview and production environments
- RevenueCat subscription hooks and restore flow exist
- push notification controls and device registration flow exist
- offline downloads and offline study support exist
- marketplace browse and listing detail exist on mobile
- AI generation from text and photos exists in the mobile product surface

## Major flows that are real vs incomplete

Clearly real or materially implemented:

- iOS app config and build structure
- Apple Sign In environment wiring
- in-app subscription entry points for Apple subscriptions
- restore purchases
- marketplace browse and detail
- seller deferral infrastructure

Clearly incomplete or unresolved:

- iOS marketplace purchase strategy for launch
- seller experience on iOS
- launch-safe legal / App Store metadata package
- a single source-of-truth document for launch scope
- a clean handoff contract describing exactly what the iOS app expects from the backend

## Most likely launch blockers

- App Store Connect and RevenueCat setup not fully verified
- no clear final decision on iOS marketplace purchase method
- launch copy and screenshots not yet grounded tightly enough in current truth
- legal / privacy / review-note package not yet finalized
- unknown TestFlight readiness of the actual preview / production build path

## Areas that are overbuilt for now

- seller infrastructure relative to immediate launch need
- some web / handoff prep work relative to the immediate TestFlight path
- broad scope compared with the number of launch-critical things that still need verification

## Areas that are underbuilt for launch credibility

- trustworthy launch artifacts: App Store copy, screenshots, review notes, privacy labels
- a clean explanation of current marketplace scope
- explicit decision on what is true at launch if iOS marketplace purchase is not approved or not ready
- seeded marketplace depth if launch messaging leans heavily on marketplace value

# 3. Builder-facing pre-flight checklist

## A. Must verify before local testing is considered trustworthy

### A1. Verify the active iOS environments and API target
- Exact task: confirm `development`, `preview`, and `production` app configs, bundle IDs, scheme names, and `EXPO_PUBLIC_API_URL`
- Why it matters: without this, every later test can be misleading
- Category: engineering
- Severity: blocker
- Effort: XS
- Recommended owner: founder
- Dependencies: working env vars
- Verify done: run config inspection and a preview/production build check; confirm the build points to the intended backend

### A2. Verify Apple Sign In on a real device for preview or production-capable config
- Exact task: test sign-in, sign-out, and session restore
- Why it matters: Apple auth is launch-critical if offered
- Category: engineering
- Severity: blocker
- Effort: S
- Recommended owner: founder
- Dependencies: Apple capability configured
- Verify done: successful sign-in, app restart, session restore, logout, re-login

### A3. Verify RevenueCat package loading and purchase restore path
- Exact task: confirm packages load and restore behaves correctly in the current app
- Why it matters: the subscription path is more grounded in code than marketplace purchase is
- Category: payments
- Severity: blocker
- Effort: S
- Recommended owner: founder
- Dependencies: RevenueCat project and keys
- Verify done: package list loads, restore works, backend reconcile updates user state

### A4. Verify AI generation from text and photos on mobile
- Exact task: run successful end-to-end tests for both generation modes
- Why it matters: this is core value, not optional polish
- Category: product
- Severity: blocker
- Effort: S
- Recommended owner: founder
- Dependencies: working backend keys
- Verify done: generate, edit, save, reopen, and study a created deck

### A5. Verify at least one complete offline study cycle
- Exact task: download deck, study offline, reconnect, sync, verify no duplicates or bad streak math
- Why it matters: offline study is one of the strongest iOS differentiators
- Category: engineering
- Severity: blocker
- Effort: M
- Recommended owner: founder
- Dependencies: working test deck
- Verify done: synced results are correct and idempotent

### A6. Verify marketplace browse/detail reality on iOS
- Exact task: test categories, search, listing detail, ratings display, and messaging around purchase availability
- Why it matters: this is the current visible marketplace surface
- Category: marketplace
- Severity: blocker
- Effort: S
- Recommended owner: founder
- Dependencies: seeded data
- Verify done: mobile browse and detail feel coherent and non-broken

## B. Must complete before TestFlight

### B1. Configure App Store Connect app record and subscription products
- Exact task: create app record, subscription products, and required Apple-side metadata for testing
- Why it matters: no meaningful TestFlight monetization testing without this
- Category: payments
- Severity: blocker
- Effort: S
- Recommended owner: founder
- Dependencies: Apple developer access
- Verify done: products appear in App Store Connect and RevenueCat mapping is live

### B2. Verify sandbox subscription purchase end-to-end
- Exact task: complete a sandbox subscription purchase, reconcile backend state, confirm `plan` changes correctly
- Why it matters: this is the clearest current route to first paid capability
- Category: payments
- Severity: blocker
- Effort: M
- Recommended owner: founder
- Dependencies: B1
- Verify done: purchase succeeds, restore succeeds, manage-subscription path is correct

### B3. Produce a successful preview or production EAS build
- Exact task: build, upload, and confirm the artifact appears in App Store Connect / TestFlight
- Why it matters: this is the real gate from theory to launch motion
- Category: engineering
- Severity: blocker
- Effort: M
- Recommended owner: founder
- Dependencies: certificates / provisioning / EAS setup
- Verify done: installable TestFlight build exists

### B4. Write the marketplace launch decision explicitly
- Exact task: document one of these launch stances:
- launch with iOS marketplace purchase enabled
- launch with buyer-facing browse/evaluate/access and defer iOS deck purchase until compliant/ready
- Why it matters: current repo intent is serious buyer marketplace, but current implementation path is not yet fully settled
- Category: product
- Severity: blocker
- Effort: XS
- Recommended owner: founder
- Dependencies: none
- Verify done: a short source-of-truth note exists and is reflected in App Store copy and review notes

### B5. Replace misleading App Store copy with truth-constrained copy
- Exact task: use submission-safe metadata only
- Why it matters: overclaiming creates App Review risk and user trust risk
- Category: App Store
- Severity: blocker
- Effort: S
- Recommended owner: Polsia
- Dependencies: B4
- Verify done: no fake scale, no seller launch promises unless true, no unsupported feature claims

### B6. Prepare a minimal legal and review package
- Exact task: finalize Terms, Privacy, and App Review notes
- Why it matters: this is part of submission readiness, not optional admin
- Category: legal / App Store
- Severity: blocker
- Effort: M
- Recommended owner: Polsia draft, founder review
- Dependencies: B4
- Verify done: URLs exist, review notes match actual build behavior

## C. Must complete before App Store submission

### C1. Finalize App Store metadata and screenshots against actual launch behavior
- Exact task: title, subtitle, promo text, description, screenshots, keywords
- Why it matters: store page must match what reviewers and users will actually see
- Category: App Store
- Severity: blocker
- Effort: M
- Recommended owner: Polsia + founder
- Dependencies: B4, B5
- Verify done: every screenshot and line of copy corresponds to current launch scope

### C2. Complete Privacy Nutrition Labels
- Exact task: map collected data accurately
- Why it matters: Apple will evaluate this against app behavior and third-party SDKs
- Category: App Store
- Severity: blocker
- Effort: S
- Recommended owner: founder
- Dependencies: legal/privacy review
- Verify done: labels match auth, subscriptions, crash reporting, analytics, and user content behavior

### C3. Verify associated domains and review-sensitive capabilities
- Exact task: check AASA, associated domains, Apple Sign In, notifications, encryption declaration
- Why it matters: broken entitlements can derail review late
- Category: engineering / App Store
- Severity: high
- Effort: S
- Recommended owner: founder
- Dependencies: working domain
- Verify done: universal-link path test, Apple Sign In works, `ITSAppUsesNonExemptEncryption` survives build

### C4. Write explicit reviewer notes for the commerce model
- Exact task: explain subscription path, restore path, marketplace behavior, and any launch-time purchase limitations
- Why it matters: this is where ambiguity about the marketplace can be managed instead of discovered by review
- Category: App Store
- Severity: high
- Effort: S
- Recommended owner: founder with Polsia draft
- Dependencies: B4
- Verify done: notes are specific, current, and consistent with the build

## D. Must complete before first paid user

### D1. Subscription monetization must work end-to-end
- Exact task: verify free/trial/pro transitions on production-like infrastructure
- Why it matters: this is the most concrete current revenue path in the repo
- Category: payments
- Severity: blocker
- Effort: M
- Recommended owner: founder
- Dependencies: TestFlight-ready subscription path
- Verify done: fresh account can subscribe, restore, and manage subscription

### D2. Marketplace promise must match actual purchasable behavior
- Exact task: if marketplace purchase is enabled, test browse -> obtain deck -> access deck -> study deck
- Why it matters: this is the difference between a real buyer marketplace and a storefront shell
- Category: marketplace
- Severity: blocker
- Effort: M
- Recommended owner: founder + Codex
- Dependencies: B4
- Verify done: no dead ends between discovery and study access

### D3. Crash reporting and minimal product analytics must be live
- Exact task: confirm at least crash capture plus a few core events
- Why it matters: you need signal once real users touch the app
- Category: analytics
- Severity: high
- Effort: S
- Recommended owner: Codex
- Dependencies: chosen tooling
- Verify done: live events and test crash visible

## E. Safe to defer until after launch

- seller onboarding and payouts
- seller dashboard completion
- deep seller trust and moderation ops
- web billing as a primary launch dependency
- broader web polishing that does not affect TestFlight
- advanced ASO experiments before truthful metadata is stable
- any second-app work

# 4. Must-have vs should-have vs defer

## Must-have for credible launch

- working TestFlight build
- working Apple subscription path
- truthful App Store page
- explicit marketplace launch decision
- trustworthy browse/detail marketplace experience
- clear legal and privacy package
- core generation and study loops verified on device

## Should-have soon

- stronger onboarding
- deeper seeded marketplace content
- clearer handoff docs for backend/mobile contract
- better post-purchase or post-obtain deck experience

## Not worth scarce time yet

- seller tooling before buyer demand is proven
- polish work that does not change trust, monetization, or submission readiness
- marketing copy that promises a larger marketplace than currently exists

# 5. Handoff-readiness recommendations

The project becomes much easier to hand off once these are true:

- the iOS build path is proven in TestFlight
- the active backend target is explicit for preview and production
- subscription truth is verified end-to-end
- the marketplace launch stance is written down in one short source-of-truth doc
- mobile/backend expectations are documented concretely, not just conceptually

Best missing artifacts:

- exact mobile API expectation doc
- environment manifest with required vs optional vars
- one-page launch-scope note covering buyer marketplace, seller deferral, and payment stance

# 6. Best future overnight task use

Highest leverage next Polsia tasks:

1. truth-constrained App Store metadata and screenshot brief
2. Terms of Service + Privacy Policy draft set
3. one-page launch-scope / marketplace-decision memo

Lower leverage until later:

- teacher recruitment execution
- growth-channel work before the App Store page and build are real
- speculative seller-marketplace strategy beyond curated launch

# 7. Final blunt recommendation

The biggest current risk is not lack of strategy. It is scope ambiguity around commerce.

The repo clearly supports:

- a real iOS app path
- Apple subscription monetization path
- serious marketplace browse/detail intent
- seller deferral

The repo does not yet justify pretending that marketplace deck purchase implementation is fully settled for iOS launch.

So the fastest credible path is:

1. get the subscription path fully real in TestFlight
2. decide and document the iOS marketplace purchase stance
3. make the store page and review notes match that decision exactly

Best single next task for founder:
- complete App Store Connect + RevenueCat sandbox purchase verification

Best next task for Codex:
- tighten launch docs and implement any missing instrumentation / flow fixes needed to support TestFlight

Best next use of the next overnight Polsia token:
- draft the final App Store submission package around the chosen marketplace launch stance, including review notes and legal copy
