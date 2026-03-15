---
date: 2026-03-15
topic: ios-native-experience-and-app-store-launch
---

# iOS Native Experience & App Store Launch

## What We're Building

The native iOS wrapper for AI Notecards using Expo/React Native. The web app is feature-complete — generation, four study modes, marketplace, seller dashboard, Stripe payments, profiles, streaks, ratings. This brainstorm covers the features that only make sense on native (push notifications, haptics, gestures, deep links, share sheet, widgets) and the full App Store launch pipeline from TestFlight to phased rollout.

The goal is not to rebuild the web app in React Native. It's to take what already works and add the native layer that makes it feel like it belongs on iOS. A web app in a WebView with push notifications is not the play. Expo gives us shared JS logic with genuinely native UI components, haptic feedback, gesture handlers, and system integrations that a PWA can't touch.

## Why This Approach

Expo/React Native lets us reuse significant business logic (API calls, state management, validation) from the existing React web app while getting real native capabilities. We're not porting the UI 1:1 — we're rebuilding screens with React Native components and adding native affordances. The web app continues to exist for desktop users and as the fallback for universal links. The native app targets the 80% of study sessions that happen on phones.

## Feature Details

### Native Experience

#### 1. Push Notifications (APNs)

**Problem:** The web app has no way to re-engage users. Streak-at-risk reminders, marketplace activity (someone bought your deck, your purchase is ready), and study nudges all require push notifications to be effective on mobile.

**Approach:**

- Use `expo-notifications` for APNs integration — handles token registration, permission prompts, and foreground/background delivery
- Store device tokens in a new `device_tokens` table: `user_id`, `token`, `platform` (ios), `created_at`, `last_used_at`
- Users can register multiple devices (iPad + iPhone)
- Backend sends via APNs using `@parse/node-apn` or a lightweight wrapper

**Notification types (mapped to existing JSONB preferences):**

| Notification | Trigger | Preference Key |
|---|---|---|
| Streak at risk | 8pm local if no study today, streak >= 3 | `notify_study_reminders` |
| Sale notification | Webhook: purchase completed (seller side) | `notify_sale` |
| Purchase ready | Webhook: purchase completed (buyer side) | `notify_purchase` |
| Daily study reminder | Configurable time, opt-in only | `notify_study_reminders` |

- Respect existing `notification_preferences` JSONB on the users table — no new preference UI needed, just wire the native toggles to the same keys
- Add `POST /api/notifications/register-device` and `DELETE /api/notifications/unregister-device` endpoints
- Streak-at-risk check: a lightweight cron (Railway cron job or Supabase pg_cron) that runs at 8pm UTC, queries users with active streaks who haven't studied today, and sends APNs

**What we're NOT building:** In-app notification center, notification history, rich media notifications, notification grouping. Plain text alerts are fine for launch.

#### 2. Deep Linking / Universal Links

**Problem:** When someone shares a marketplace link on iMessage or Twitter, it opens in Safari even if the app is installed. Seller onboarding returns to a web URL after Stripe Connect. Magic link emails open in the browser, not the app.

**Approach:**

- Configure universal links via Apple App Site Association (AASA) file hosted at `ainotecards.com/.well-known/apple-app-site-association`
- Use `expo-linking` for deep link handling with Expo Router

**Link mappings:**

| URL Pattern | App Screen | Fallback |
|---|---|---|
| `ainotecards.com/marketplace/:id` | Marketplace detail | Web marketplace page |
| `ainotecards.com/marketplace` | Marketplace browse | Web marketplace |
| `ainotecards.com/seller/onboard/return` | Seller dashboard | Web seller dashboard |
| `ainotecards.com/verify-code?email=...` | Verify code screen | Web verify page |
| `ainotecards.com/study/:deckId` | Study screen | Web study page |

- AASA file: served as `application/json` from Express with the app's team ID and bundle ID
- Expo Router handles incoming URLs via its built-in linking configuration — no manual URL parsing
- Stripe Connect `return_url` and `refresh_url` already point to web URLs — universal links will intercept them automatically when the app is installed

**Decision:** No custom URL scheme (`ainotecards://`). Universal links are strictly better — they work as web fallbacks, don't require the app to be installed, and Apple recommends them over custom schemes.

#### 3. Haptic Feedback

**Problem:** Study interactions feel flat without physical feedback. Haptics are the fastest way to make a web-to-native transition feel real.

**Approach:**

Use `expo-haptics` with three intensity levels mapped to specific interactions:

| Interaction | Haptic Type | Why |
|---|---|---|
| Card flip (flip mode) | `ImpactFeedbackStyle.Light` | Subtle confirmation of the flip action |
| Correct answer (all modes) | `NotificationFeedbackType.Success` | Positive reinforcement |
| Incorrect answer (all modes) | `NotificationFeedbackType.Error` | Gentle negative signal |
| Match mode: correct pair | `ImpactFeedbackStyle.Medium` | Satisfying "click" when tiles match |
| Match mode: wrong pair | `NotificationFeedbackType.Warning` | Quick buzz before tiles flip back |
| Streak milestone (3, 7, 14, 30, 100) | `ImpactFeedbackStyle.Heavy` | Celebration moment |
| Pull-to-refresh trigger | `ImpactFeedbackStyle.Light` | Standard iOS convention |

- Wrap in a `useHaptics()` hook that checks `expo-haptics` availability and respects a user preference toggle (some users hate haptics)
- Add `haptics_enabled` to the existing preferences JSONB (default: `true`)
- Total implementation: one hook file, ~40 lines

#### 4. Native Gestures

**Problem:** The web app uses button taps and keyboard shortcuts for study interactions. On native, swipe gestures are the expected interaction pattern — especially for a card-based app.

**Approach:**

Use `react-native-gesture-handler` (included with Expo) and `react-native-reanimated` for smooth, interruptible animations:

**Flip mode — swipe to rate (the big one):**
- Swipe right = correct (card slides off right with green tint)
- Swipe left = incorrect (card slides off left with red tint)
- Tap to flip (replaces Space key)
- Card follows finger during swipe with rotation (like Tinder) — `PanGestureHandler` with `Animated.event`
- Threshold: 40% of screen width to commit, otherwise spring back
- Visual cue: green/red gradient overlay intensifies as swipe progresses

**Other gestures:**
- Pinch-to-zoom on photo-generated card images — `PinchGestureHandler` on the card image component
- Long-press on deck card → action sheet (edit, delete) — replaces hover-based interactions from web
- Pull-to-refresh on dashboard and marketplace — `RefreshControl` on ScrollView/FlatList (standard React Native)

**Match mode:** Keep tap-based selection rather than drag-and-drop. The web version uses HTML drag-and-drop which doesn't translate. Tap-to-select, tap-to-match is faster on mobile and works better with the 6-pair grid on smaller screens.

**Decision:** Swipe-to-rate in flip mode is the signature native gesture — it's the interaction users will use most and it's what makes the app feel native rather than wrapped. Everything else is standard iOS convention.

#### 5. Share Sheet

**Problem:** The web app uses a custom `SharePopover` component with Web Share API (or copy-link fallback). On iOS, this should be the native share sheet — it's more capable, familiar, and supports AirDrop, Messages, and other system extensions.

**Approach:**

- Use `expo-sharing` / `Share` from React Native for the native share sheet
- Replace `SharePopover` usage in the native app with a single `shareItem()` utility function
- Share content: marketplace listing URL + title + preview text

**Share points:**
| Screen | Content | URL |
|---|---|---|
| Marketplace listing | "{title} — AI Notecards" | `ainotecards.com/marketplace/:id` |
| Study results | "I scored {x}% on {deck title}!" | `ainotecards.com/marketplace/:id` (if listed) or no URL |
| Deck view (own deck) | "{title} — {card_count} cards" | No URL (not public) |

- Study results sharing is new — the web doesn't have this. On the results screen, add a "Share Results" button that opens the native share sheet with the score summary. If the deck is a marketplace listing, include the listing URL so friends can buy it. Organic growth loop.
- No image generation for share cards (YAGNI). Plain text + URL is fine for launch.

#### 6. Widgets (iOS 14+)

**Problem:** Users forget to study. A home screen widget showing their current streak creates a passive reminder without push notification fatigue.

**Approach:**

- **This is post-launch. Not MVP.** Widgets require a separate Swift target in the Xcode project, which Expo supports via config plugins but adds significant build complexity.
- When we build it: a small widget showing current streak count + "Study now" tap target
- Uses `expo-widgets` (or a custom config plugin) to create a WidgetKit extension
- Data sync via shared App Group container — the React Native app writes streak data to shared UserDefaults on each study session completion
- Widget refreshes via `WidgetCenter.shared.reloadAllTimelines()` triggered from the app

**Decision:** Widgets are a v1.1 feature, not a launch blocker. The ROI on development time is low compared to getting the core native experience right. Push notifications handle the re-engagement use case for launch.

### App Store Launch

#### 7. TestFlight Strategy

**Problem:** Need a structured beta process to catch device-specific bugs, validate the native experience, and build early reviews before public launch.

**Approach:**

**Phase 1 — Internal testing (1 week):**
- Team devices only (2-3 devices covering iPhone SE, standard iPhone, iPad)
- Focus: crash-free sessions, Stripe payments in test mode, push notification delivery, deep link handling
- No App Store Connect review required for internal builds

**Phase 2 — Closed beta (2 weeks):**
- 20-30 testers recruited from: existing web users with active streaks, education-focused Twitter/Reddit communities, friends who are students
- Requires App Store Connect review (typically 24-48 hours)
- Focus: real usage patterns, study mode feedback, marketplace purchase flow with live Stripe
- Collect feedback via a simple in-app "Send Feedback" button (opens email compose to a dedicated inbox)
- TestFlight auto-expires builds after 90 days — set explicit 2-week beta period

**Phase 3 — Open beta (1 week):**
- Public TestFlight link shared on landing page and social media
- Cap at 200 testers (TestFlight supports up to 10,000 but we don't need scale testing)
- Focus: diverse device coverage, edge cases, final polish
- Monitor crash-free rate in Sentry — target 99.5%+ before submission

**Total beta duration: 4 weeks.** Submit to App Store review once crash-free rate is stable and no P0 bugs remain.

#### 8. App Store Optimization (ASO)

**Problem:** Discovery on the App Store is keyword-driven. Without deliberate keyword targeting, the app is invisible.

**Approach:**

**Title (30 chars max):** `AI Notecards: Study Flashcards`

**Subtitle (30 chars max):** `Generate Cards from Your Notes`

**Keyword field (100 chars, comma-separated, no spaces):**
`flashcards,study,ai,notecards,quiz,exam,test,review,cards,learn,notes,tutor,memorize,school,college`

**Keyword rationale:**
- `flashcards` — highest volume, primary category term
- `study` + `exam` + `test` + `review` — intent-based terms students search
- `ai` — differentiator, trending modifier
- `notecards` — brand term + direct synonym for flashcards
- `quiz` — adjacent behavior, high volume
- `notes` — connects to the generation feature (paste your notes)
- `memorize` + `learn` — outcome-based terms
- `school` + `college` — audience targeting
- `tutor` — AI tutor framing

**Category:** Education (primary), Productivity (secondary)

**NOT targeting:** "Anki" (trademark), "Quizlet" (trademark), "spaced repetition" (too long, low volume on iOS). Focus on broad terms where we can rank, not competitor brand terms that Apple may reject.

**Localization:** English (US) only for launch. Add English (UK), Spanish, Japanese in v1.1 based on web traffic data.

#### 9. Screenshots & Preview Video

**Problem:** Screenshots are the single biggest conversion factor on the App Store. Six slots available — each must communicate a distinct value proposition in under 2 seconds of glance time.

**Approach:**

**Required sizes:** 6.7" (iPhone 15 Pro Max — 1290x2796) and 6.5" (iPhone 11 Pro Max — 1242x2688). Generate 5.5" (iPhone 8 Plus — 1242x2208) for older device coverage.

**Six screenshots in order:**
1. **AI Generation** — phone showing the generate screen with topic input, headline: "Paste Notes. Get Flashcards."
2. **Flip Study Mode** — card mid-flip with swipe gesture arrow overlay, headline: "Swipe to Study"
3. **Study Modes** — 2x2 grid preview of all four modes, headline: "4 Ways to Learn"
4. **Marketplace** — marketplace browse screen with listings, headline: "Buy & Sell Decks"
5. **Streak & Progress** — dashboard with streak widget and study score, headline: "Build Your Streak"
6. **Photo Generation** — camera/upload screen with generated cards, headline: "Snap a Photo. AI Does the Rest."

**Design:** Use the warm parchment palette as the screenshot background frame. Device mockup (iPhone 15 Pro) centered. Bold headline text above the device in #1A1614. Accent green (#1B6B5A) for highlight elements.

**App preview video:** Skip for launch. Videos auto-play on the listing and can hurt conversion if they're not polished. Screenshots are safer. Revisit after launch with real usage footage.

#### 10. Privacy Nutrition Labels

**Problem:** App Store requires a detailed privacy disclosure before submission. Getting this wrong delays review.

**Approach:**

**Data linked to identity:**
| Data Type | Purpose | Collection Method |
|---|---|---|
| Email address | Account creation, transactional emails | User-provided at signup |
| Name / Display name | User profile, marketplace seller name | User-provided in onboarding |
| Payment info | Purchases, subscriptions | Collected by Stripe (not stored by us) |
| Purchase history | Purchase records, seller earnings | Generated from app usage |

**Data NOT linked to identity:**
| Data Type | Purpose |
|---|---|
| Usage data | Analytics (PostHog — study sessions, feature usage) |
| Crash data | Sentry error monitoring |
| Device ID | Push notification delivery (APNs token) |
| Performance data | App launch time, screen load metrics |

**Data NOT collected:**
- Location data (not needed)
- Contacts (not needed)
- Browsing history (not tracked)
- Health/fitness data (not applicable)
- Financial info beyond Stripe (we don't store card numbers)

**Key disclosure:** Stripe handles payment processing — we never see or store card numbers. The privacy label should list "Payment Info" under "Data Used to Track You: No" and "Data Linked to You: Yes" with purpose "App Functionality."

#### 11. App Review Preparation

**Problem:** Education apps with in-app purchases and external payment processing (Stripe Connect) have specific rejection risks. First-time submissions average 2-3 review cycles.

**Approach:**

**Demo account for review team:**
- Create `demo-reviewer@ainotecards.com` with Pro plan, pre-loaded decks, active streak, and marketplace listings
- Include credentials in App Store Connect review notes
- Pre-populate the account with 5+ decks across different categories so reviewers see a full experience

**Common rejection risks and mitigations:**

| Risk | Mitigation |
|---|---|
| Stripe Connect (external payments for marketplace sellers) | This is B2B payment processing, not circumventing Apple IAP. Sellers are paid for digital goods they created. Include explanation in review notes. Apple's guidelines (3.1.1) allow marketplace/platform payment processing. |
| Subscription not using StoreKit | Use RevenueCat + StoreKit for the Pro subscription in the native app. Do NOT use Stripe for iOS subscriptions — this is a guaranteed rejection. |
| Missing restore purchases | RevenueCat handles this. Add "Restore Purchases" button on the Pricing screen. |
| Login required for basic features | Marketplace browsing works without login. Only generation/study requires auth — this is standard. |
| Incomplete feel | Ensure all screens are polished, no placeholder text, no "coming soon" features. |

**Critical decision: Subscription payment on iOS MUST go through StoreKit (Apple IAP), not Stripe.** Apple takes 30% (15% for small business program). Stripe subscriptions remain for web users. RevenueCat syncs subscription status across both — when a user subscribes via iOS, RevenueCat webhook updates our backend. This is non-negotiable for App Store approval.

**Marketplace purchases:** Physical and digital goods sold by third-party sellers are exempt from Apple IAP per guideline 3.1.1(e) — "Goods and services sold in a marketplace that are created by users." Our marketplace qualifies. Marketplace purchases continue through Stripe Checkout (opens in-app browser).

**Review notes template:** "AI Notecards is a flashcard app with an AI generation engine and a user-created marketplace. Subscriptions are processed via StoreKit. Marketplace purchases between users are processed via Stripe Connect per guideline 3.1.1(e). Demo account: [email] / [password]."

#### 12. Phased Release

**Problem:** A bug in production that affects all users simultaneously is catastrophic for a new app's ratings. Phased release limits blast radius.

**Approach:**

**Use Apple's automatic phased release (7-day rollout):**
- Day 1: 1%
- Day 2: 2%
- Day 3: 5%
- Day 4: 10%
- Day 5: 20%
- Day 6: 50%
- Day 7: 100%

**Monitoring during rollout:**
- Sentry crash-free rate: target 99.5%+, pause rollout if it drops below 99%
- App Store Connect crash reports (complementary to Sentry)
- TestFlight feedback channel stays open for early adopters to report issues
- Monitor 1-star reviews daily — respond to each one within 24 hours

**Pause criteria:** More than 3 crash reports on the same stack trace, any payment-related bug, any data loss bug. Apple allows pausing the phased rollout at any time.

**Decision:** Use phased release for v1.0 and every subsequent update. The 7-day default is fine — no need to customize the percentages. Immediate release only for critical security patches.

## Key Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| iOS subscription billing | StoreKit via RevenueCat, not Stripe | Apple IAP required for App Store approval; RevenueCat syncs with backend |
| Marketplace billing on iOS | Stripe Checkout (in-app browser) | Exempt from IAP per guideline 3.1.1(e) — user-created marketplace |
| Deep link scheme | Universal links only, no custom scheme | Apple-recommended, works as web fallback, more reliable |
| Match mode interaction | Tap-to-select, not drag-and-drop | Drag-and-drop doesn't translate well to small screens; tap is faster |
| Widgets | Post-launch (v1.1) | Too much build complexity for launch; push notifications cover re-engagement |
| App preview video | Skip for launch | Screenshots convert better unless video is highly polished |
| Beta duration | 4 weeks (1 internal + 2 closed + 1 open) | Enough time for device coverage without losing momentum |
| Phased release | 7-day automatic rollout | Limits blast radius, can pause on critical bugs |
| Haptics | On by default, user-toggleable | Most users expect haptics; preference for those who don't |

## Open Questions

- **RevenueCat pricing tier:** Free tier covers 2,500 MTR (monthly tracked revenue). Will we exceed this at launch? Probably not — budget for the $0 tier initially.
- **Apple Small Business Program:** Do we qualify for the 15% commission rate (vs 30%)? Yes, if we earn under $1M/year. Enroll before submission.
- **iPad layout:** Do we ship a dedicated iPad layout or just scale up the iPhone layout? Recommendation: iPhone layout scaled for v1.0, dedicated iPad in v1.1.
- **Offline study:** Should users be able to study downloaded decks without internet? High value but requires local SQLite cache. Defer to v1.1.
- **Minimum iOS version:** iOS 16+ (drops ~3% of users, but gives us modern SwiftUI widget support and latest APNs features for when we add widgets).

## Implementation Priority

**Phase 1 — Native MVP (weeks 1-3):**
1. Expo project setup with Expo Router, shared API layer
2. Core screens: auth, dashboard, generate, deck view, study (all 4 modes)
3. Swipe-to-rate gesture in flip mode
4. Haptic feedback integration
5. Pull-to-refresh, long-press actions

**Phase 2 — Native features (weeks 4-5):**
6. Push notifications (APNs + backend endpoints + streak-at-risk cron)
7. Deep linking / universal links (AASA file + Expo Router linking config)
8. Native share sheet (replace SharePopover, add study results sharing)
9. RevenueCat integration (StoreKit subscriptions, restore purchases)

**Phase 3 — Launch prep (weeks 6-7):**
10. ASO: title, subtitle, keywords, description, category selection
11. Screenshots (6 screens, 3 device sizes)
12. Privacy nutrition labels
13. App review notes + demo account
14. TestFlight internal build

**Phase 4 — Beta + submission (weeks 8-11):**
15. Internal testing (1 week)
16. Closed beta (2 weeks)
17. Open beta (1 week)
18. App Store submission + phased release

## Scope Boundaries

**In scope:**
- Push notifications (4 types, backed by existing preferences)
- Universal links for marketplace, seller return, magic links
- Haptic feedback (7 interaction points)
- Swipe-to-rate gesture in flip mode
- Native share sheet with study results sharing
- RevenueCat for iOS subscriptions (StoreKit)
- Full ASO keyword strategy
- 6 screenshots across required device sizes
- Privacy nutrition labels
- TestFlight beta program (4 weeks)
- Phased release strategy

**Out of scope:**
- Widgets (v1.1)
- App preview video (v1.1)
- iPad-specific layout (v1.1)
- Offline mode / local caching (v1.1)
- Localization beyond English US (v1.1)
- Android (separate effort, after iOS proves the model)
- Apple Watch companion (YAGNI)
- Siri shortcuts (YAGNI)
- Rich push notifications with images (plain text is fine)
- In-app notification center (YAGNI)

## Next Steps

→ `/workflows:plan` for implementation details
