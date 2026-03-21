---
title: 'Prelaunch Completion Sprint — All Remaining Work Before Marketing'
type: feat
date: 2026-03-17
origin: docs/2026-03-17-sprint/prelaunch-launch-readiness-audit.md
deepened: 2026-03-17
reviewed: 2026-03-17
---

# Prelaunch Completion Sprint

All remaining work to take the AI Notecards app from audit score 6.4/10 to launch-ready. Strategy: **web-first launch**, iOS secondary.

## Enhancement Summary

**Deepened on:** 2026-03-17
**Sections enhanced:** 8 phases + architecture + risk analysis
**Research agents used:** Security Sentinel, Architecture Strategist, Code Simplicity Reviewer, SpecFlow Analyzer, Repo Research Analyst, Learnings Researcher, Helmet Best Practices Researcher, Playwright Best Practices Researcher, PostHog Analytics Researcher, Pattern Recognition Specialist, Performance Oracle

### Key Improvements

1. **Phase 1 (helmet) completely reworked** — Security Sentinel found 4 critical/high CSP gaps: `script-src` needs `'unsafe-inline'` (Vite inlines modules), `style-src` needs `'unsafe-inline'` (react-hot-toast), `connect-src` needs 5 explicit origins, `img-src` needs Supabase + Google avatar origins, `frame-src` needs Stripe + Google. Complete per-directive CSP config now provided.
2. **Phase 1.3 (CSP report-only) CUT** — Simplicity Reviewer: solo indie dev does not need a CSP reporting endpoint. Test locally, enforce from the start.
3. **Phase 2.1 (ConfirmModal) simplified** — Simplicity Reviewer: CUT focus trap and body scroll lock for v1. Architecture Strategist: extract `ModalShell` wrapper first to fix existing `SellerTermsModal` duplication in Dashboard.jsx and Settings.jsx.
4. **Phase 2.6 (trust signals) trimmed** — Simplicity Reviewer: ship with `purchase_count` + `avg_rating` only. CUT Verified Seller badge, study score badge, and listing age (all YAGNI at zero-seller launch).
5. **Phase ordering corrected** — Architecture Strategist: Phase 3 (E2E) depends on Phase 2 (ConfirmModal tests) AND Phase 4 (analytics events should be testable). Revised: Phase 1 → (Phase 2 || Phase 4) → Phase 3.
6. **Phase 3 (Playwright) grounded** — Context7 docs: concrete `webServer` config for dual-server setup, `storageState` pattern for authenticated tests, setup project with dependencies.
7. **Phase 4.3 server-side analytics already exists** — Repo Research found `server/src/services/analytics.js` with PostHog Node SDK, consent-checking via DB preferences, and `shutdownAnalytics()` on SIGTERM. No new infra needed.
8. **Phase 5.1 Node version** — Learnings Researcher: iOS offline study solution confirms Node 22 is required. Use Node 22.x LTS, not a downgrade.
9. **Phase 6.4 (health check external pings) CUT** — Simplicity Reviewer: over-engineering for a solo dev. Railway's built-in health check is sufficient. Add external pings only after a real outage warrants it.
10. **Phase 8.5 (App Store review notes)** — Learnings: pre-launch-checklist.md has a battle-tested reviewer notes template and operational checklist. Reference it directly.

### Review Fixes Applied (from `/workflows:review`)

- **P1:** Fixed CSP `img-src` — added `blob:` (Generate.jsx uses `URL.createObjectURL()` for photo previews) and `https://accounts.google.com` (Google Sign-In button images)
- **P1:** Added E2E test user field requirements — must insert with `plan='pro'`, `display_name='Test User'`, `email_verified=true` or tests hit generation limits and redirect to Welcome
- **P1:** Added PostHog event queue warning — `analytics.track()` silently drops events when SDK hasn't loaded yet. Plan now documents the timing gap and recommends `initPostHog().then()` for critical events
- **P1:** Fixed Phase 4 — `signup_completed` already tracked server-side in auth routes; removed redundant client-side proposal. Only 2 new client events needed (`deck_saved`, `subscription_page_viewed`)
- **P2:** Fixed SellerTermsModal claim — not identically duplicated (Settings version has extra ToS link). ModalShell extraction deferred to Phase 7
- **P2:** Added Vercel CSP task — helmet CSP is inert for Vercel-hosted frontend; added task 1.3 to configure `vercel.json` headers
- **P2:** Playwright timing target updated to "< 2 min local, < 3 min CI" with `fullyParallel: true`
- **P2:** Phase 2.1 simplified — ConfirmModal standalone, no ModalShell extraction
- **P2:** Phase 5.3 — removed "View on Web" pressable (increases App Store rejection risk)
- **P2:** Corrected dependency diagram — Phases 2+4 don't depend on Phase 1; can start immediately
- **P2:** Webhook error responses leak `err.message` — add task to Phase 6 to sanitize (`index.js:111`, `stripe.js:135`)
- **P2:** `.env.test` not in `.gitignore` — must add before Playwright setup
- **P2:** Phase 6.2 runbook trimmed from 5 to 2 scenarios (webhook replay + manual fulfillment)
- **P1:** Playwright `test:e2e` script must be `"test:e2e": "npx playwright test"` — explicitly specified
- **P1:** PostHog returning-user bug — `initPostHog()` never called for users who previously consented. All events silently dropped forever. Must add `if (consentGranted) initPostHog()` at module load

### Considerations

- **Security:** CSP `script-src 'unsafe-inline'` is acceptable for v1 with Vite — nonce strategy (Vite `html.cspNonce`) can be added post-launch. Document as tech debt. Helmet CSP only applies to Express API responses; real frontend CSP requires `vercel.json` headers.
- **Architecture:** `SellerTermsModal` exists in both Dashboard.jsx (line 9) and Settings.jsx (line 9) but they are NOT identical — Settings version has an extra ToS link paragraph. Deduplication deferred to Phase 7.
- **Simplicity:** Original plan had ~23 work items. After cuts, ~16 remain. The cut items are deferred to post-launch, not deleted.
- **Performance:** Server-side PostHog already exists at `server/src/services/analytics.js` — Phase 4.3 can use it directly. PostHog client SDK has a timing gap during dynamic import where events are silently dropped.

---

## Overview

A thorough prelaunch audit (2026-03-16) identified 6 critical blockers, 6 high-priority items, and several medium/lower items. This plan organizes all remaining work into 8 phases, ordered by dependency and priority. Phases 1-5 must complete before marketing the web app. Phases 6-7 are post-launch hardening. Phase 8 is iOS completion for a later App Store submission.

**What's already done:** All prior plans are marked FINISHED — auth revamp, marketplace production readiness, seller onboarding, ratings, photo upload/vision, account settings, UX polish/retention, pre-launch blockers (Sentry, legal pages, error boundary, meta tags, email verification, forgot password), iOS auth/Apple Sign-In, iOS offline study, iOS monetization/RevenueCat, iOS native experience, iOS home layout, iOS dev client workflow.

**What's still missing (verified against codebase 2026-03-17):**

| Finding | Status | File(s) |
|---------|--------|---------|
| No `helmet` / HTTP security headers | Confirmed missing | `server/src/index.js` |
| iOS seller dashboard is placeholder | Confirmed placeholder | `mobile/app/seller.tsx` |
| iOS sell/list deck is placeholder | Confirmed placeholder | `mobile/app/sell/[deckId].tsx` |
| iOS marketplace opens browser checkout | Confirmed (has feature flag) | `mobile/app/(tabs)/marketplace/[id].tsx` |
| "Email delivery coming soon" in Settings | Confirmed at line 511 | `client/src/pages/Settings.jsx` |
| Mobile Node >=20.19.4 vs env 20.10.0 | Confirmed in engines field | `mobile/package.json` |
| Zero client tests / E2E tests | Confirmed — no Playwright/Cypress | `client/` |
| 3 browser `confirm()` dialogs | Confirmed | `Dashboard.jsx:197`, `Settings.jsx:307`, `SellerDashboard.jsx:88` |
| `notifyUser` only called for marketplace | Confirmed — only in `stripe.js` | `server/src/routes/stripe.js:301,308` |
| Funnel analytics light | Partial — some PostHog events exist | `client/src/pages/*.jsx` |

**What's more complete than audit indicated:**

- iOS marketplace listing already has `purchaseAvailability` feature flag with disabled state + messaging
- Push notification infrastructure exists (device_tokens table, `notifyUser`, Expo push)
- PostHog analytics integrated with consent-gating and ~11 tracked events
- Onboarding analytics events already in Welcome.jsx
- Server-side PostHog already exists at `server/src/services/analytics.js` with consent-checking

---

## Phase 1: Backend Security Hardening

**Effort:** S (half day) | **Blocks:** marketing | **Dependencies:** none

Add baseline HTTP security headers to the Express server. This is the simplest critical blocker and has zero frontend dependencies.

### Tasks

#### 1.1 Install and configure helmet

**File:** `server/src/index.js`

- [ ] `npm install helmet` in `server/`
- [ ] Add `helmet()` middleware **after** `cors()` but **before** route registrations
- [ ] Configure with explicit per-directive CSP:

```js
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com", "https://accounts.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.supabase.co", "https://lh3.googleusercontent.com", "https://accounts.google.com"],
        connectSrc: ["'self'", "https://us.i.posthog.com", "https://*.ingest.sentry.io", "https://accounts.google.com", "https://api.stripe.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        frameSrc: ["https://js.stripe.com", "https://accounts.google.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    strictTransportSecurity: process.env.NODE_ENV === 'production'
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
    crossOriginEmbedderPolicy: false,  // Required for Google Sign-In iframes
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions: { action: 'deny' },
  })
);
```

### Research Insights: CSP Configuration

**Why `'unsafe-inline'` is needed (Security Sentinel findings):**

| Directive | Why `'unsafe-inline'` | Alternative for v2 |
|-----------|----------------------|---------------------|
| `script-src` | Vite injects inline `<script type="module">` tags in production builds. Sentry SDK in `main.jsx` initializes inline. | Vite 6+ `html.cspNonce` config + helmet nonce middleware |
| `style-src` | `react-hot-toast` (used in 17 client files) injects inline styles for toast positioning. Tailwind outputs linked stylesheets but some dynamic styles may be inline. | Replace react-hot-toast with CSS-class-only toast library |

**Why `crossOriginEmbedderPolicy: false`:** Google Sign-In uses cross-origin iframes. The default COEP (`require-corp`) blocks them. Disabling COEP is necessary for Google OAuth.

**Middleware ordering in `server/src/index.js`:**
```
1. Sentry init (already at top)
2. express.raw() for Stripe webhooks (already present, lines 59-60)
3. express.json() (line 62)
4. cookieParser() (line 63)
5. cors() (lines 64-69)
6. helmet() ← ADD HERE
7. Route registrations
8. Sentry error handler + generic error handler (already at bottom)
```

**IMPORTANT: This is an API-only server.** The CSP headers apply to responses from `server/` (port 3001), not the Vite frontend (port 5173). In production, the frontend is served by Vercel which has its own headers. However, the API server returns HTML for:
- The health check endpoint
- Any non-API 404 responses that might return HTML

The CSP primarily matters because browsers apply it when the server sends HTML responses (error pages). For a pure JSON API, CSP is less critical — but helmet still adds valuable headers like HSTS, X-Frame-Options, and referrer policy that protect against clickjacking and protocol downgrade attacks.

#### 1.2 Verify helmet doesn't break existing flows

- [ ] Test: landing page loads without CSP violations in browser console
- [ ] Test: Google Sign-In popup works (requires `frame-src accounts.google.com`)
- [ ] Test: Stripe checkout redirect works (requires `frame-src js.stripe.com`)
- [ ] Test: Avatar upload from Supabase Storage displays (requires `img-src *.supabase.co`)
- [ ] Test: Google avatar displays (requires `img-src lh3.googleusercontent.com`)
- [ ] Test: PostHog events fire (requires `connect-src us.i.posthog.com`)
- [ ] Test: Sentry test error reports successfully (requires `connect-src *.ingest.sentry.io`)
- [ ] Test: react-hot-toast notifications render (requires `style-src 'unsafe-inline'`)

#### 1.3 Configure Vercel frontend CSP headers

### Research Insights: CSP Scope

**Security Sentinel review finding (P2):** Helmet CSP only applies to Express server responses (port 3001). In production, the React frontend is served by **Vercel**, not Express. Browsers only enforce CSP from the **document** response headers, not from API XHR responses. This means the helmet CSP directives are largely inert for their stated purpose.

The real value of helmet here is HSTS, X-Frame-Options, and Referrer-Policy (which apply to all responses). For actual frontend CSP protection, configure headers in Vercel.

- [ ] Create or update `client/vercel.json` with CSP headers matching the helmet config:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://accounts.google.com; connect-src 'self' https://us.i.posthog.com https://*.ingest.sentry.io https://accounts.google.com https://api.stripe.com; font-src 'self' https://fonts.gstatic.com; frame-src https://js.stripe.com https://accounts.google.com; object-src 'none'; base-uri 'self'"
        }
      ]
    }
  ]
}
```

- [ ] Deploy and verify CSP headers appear in browser Network tab on the document response (not just API responses)

### Acceptance Criteria

- [ ] All security headers present on both API and frontend responses
- [ ] No CSP violations on any existing page
- [ ] Server tests still pass (32/32)

---

## Phase 2: Web UX Polish

**Effort:** M (1-2 days) | **Blocks:** marketing | **Dependencies:** none

Replace amateur UX patterns with production-grade components. Fix the notification promise gap.

### Tasks

#### 2.1 Build standalone ConfirmModal

### Research Insights: Modal Architecture

**Simplicity Reviewer (Round 2):** ModalShell extraction and SellerTermsModal deduplication are scope creep for a pre-launch sprint. The SellerTermsModal works fine in both locations today — nobody is editing it, and the duplication creates zero user-facing risk. Build ConfirmModal standalone with the backdrop/card wrapper hardcoded directly (6 lines of JSX).

**Pattern Recognition finding:** The two SellerTermsModal copies are NOT identical — the Settings version (lines 9-80) has an extra ToS link paragraph that Dashboard version (lines 9-75) lacks. Any extraction would need to parameterize this difference.

**New file:** `client/src/components/ConfirmModal.jsx`

- [ ] Hardcode the backdrop + card wrapper directly (matching existing `fixed inset-0 bg-black/50 ... z-50` pattern)
- [ ] Add Escape key handler (one `useEffect`, 4 lines)
- [ ] Props: `title`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `variant` (danger/default)
- [ ] Danger variant: red confirm button for destructive actions
- [ ] Default variant: green (`#1B6B5A`) confirm button
- [ ] NO focus trap, NO body scroll lock, NO ModalShell extraction for v1 (deferred to Phase 7.5)

#### 2.2 Replace confirm() in Dashboard.jsx

**File:** `client/src/pages/Dashboard.jsx:197`

- [ ] Replace `if (!confirm(message)) return;` with `ConfirmModal`
- [ ] Current message: deck deletion confirmation (conditional text based on listing status)
- [ ] Use danger variant (red button)

#### 2.3 Replace confirm() in Settings.jsx

**File:** `client/src/pages/Settings.jsx:307`

- [ ] Replace `if (!confirm('Cancel your Pro subscription?...')) return;` with `ConfirmModal`
- [ ] Use danger variant — subscription cancellation is high-stakes
- [ ] Confirm label: "Cancel Subscription"

#### 2.4 Replace confirm() in SellerDashboard.jsx

**File:** `client/src/pages/SellerDashboard.jsx:88`

- [ ] Replace `if (!confirm('Delist this deck?...')) return;` with `ConfirmModal`
- [ ] Use danger variant
- [ ] Confirm label: "Delist Deck"

#### 2.5 Fix notification/reminder promise

**File:** `client/src/pages/Settings.jsx:511`

- [ ] **Option A (recommended — fastest):** Remove the "Email delivery coming soon" text and the study reminder toggle from the Settings notification section. Keep the notification preference toggles that actually work (marketplace notifications via push). This is honest and avoids promising features that don't exist.
- [ ] **Option B (if reminders are high priority):** Implement email study reminders end-to-end — **Effort: M-L, separate plan**

#### 2.6 Add marketplace trust signals (web) — minimal

**File:** `client/src/pages/MarketplaceDeck.jsx`, `client/src/pages/Marketplace.jsx`

- [ ] Show `purchase_count` on listing cards ("X purchases")
- [ ] Show `avg_rating` with star display
- [ ] These are read-only — data already exists in the API response

### Research Insights: Trust Signals Scope

**Simplicity Reviewer rationale for cuts:**
- **Verified Seller badge:** Zero sellers at launch. Every seller has completed Stripe Connect (required). The 5+ sales threshold cannot trigger for weeks. Building a badge for a nonexistent state is waste.
- **Study score badge:** Novel metric not validated with users. Conflates seller quality with study activity.
- **Listing age:** At launch everything is new. Useful only months later when stale listings exist.

These are deferred to Phase 7, not deleted.

#### 2.7 Add in-product support/contact

**File:** `client/src/pages/Settings.jsx`

- [ ] Add a "Help & Support" section in Settings with `mailto:` link
- [ ] Keep it simple — no feedback form for v1

### Acceptance Criteria

- [ ] Zero `confirm()` calls remain in client code
- [ ] ConfirmModal works with Escape key to cancel
- [ ] No "coming soon" text visible to users
- [ ] Marketplace listings show purchase count and rating
- [ ] Users can reach support from within the authenticated app

---

## Phase 3: E2E Test Suite

**Effort:** M (2-3 days) | **Blocks:** marketing (confidence gate) | **Dependencies:** Phase 2 (ConfirmModal tests) + Phase 4 (analytics events testable)

### Research Insights: Phase Ordering Correction

**Architecture Strategist finding:** The original plan drew Phases 2, 3, and 4 as partially parallel. This is wrong because:
- Task 3.5 tests "subscription cancel flow in Settings (with new ConfirmModal)" — requires Phase 2
- If analytics events (Phase 4) are added after E2E tests are written, tests can't validate events fire correctly
- Phase 4 modifies the same pages Phase 3 tests, causing merge conflicts if done in parallel

**Corrected critical path:**
```
Phase 1 (half day)
    |
    +--- Phase 2 (1-2 days)  ---+--- parallel ---+--- Phase 4 (1 day)
    |                            |                |
    +----------------------------+----------------+
    |
Phase 3 (2-3 days) — E2E tests validate Phases 1, 2, and 4
    |
WEB LAUNCH READY
```

Add Playwright E2E coverage for critical revenue and auth flows. The goal is a safety net, not exhaustive coverage.

### Tasks

#### 3.1 Set up Playwright

- [ ] `npm init playwright@latest` in the repo root (not `client/` — tests span both client and server)
- [ ] Configure `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: [
    {
      command: 'cd server && npm run dev',
      url: 'http://localhost:3001/api/health',
      name: 'Backend',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd client && npm run dev',
      url: 'http://localhost:5173',
      name: 'Frontend',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
  },
  fullyParallel: true,
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  reporter: [['html', { open: 'never' }]],
});
```

- [ ] Add `.env.test` with test database name (`notecards_test`) and mock Stripe keys
- [ ] Add `npm run test:e2e` script to root `package.json`
- [ ] Add to `.gitignore`: `playwright/.auth/`, `test-results/`, `.env.test` (Security Sentinel: current `.gitignore` has `.env` exact match which does NOT match `.env.test` — credential leak risk)
- [ ] Add `"test:e2e": "npx playwright test"` to root `package.json` scripts (Architecture Strategist: plan did not specify the actual script content)

#### 3.2 Auth setup project

**New file:** `e2e/auth.setup.ts`

### Research Insights: Test User Requirements

**Architecture Strategist review finding (P1):** A test user inserted with only `email` and `password_hash` will have `plan='free'` (1 generation/day limit), `email_verified=false`, and no `display_name`. This causes: generation limit after 1 test run, redirect to Welcome page on login, and potential email verification gates. The insert must specify all fields needed for smooth test execution.

- [ ] Create a test user via direct DB insertion with all required fields:
  ```sql
  INSERT INTO users (email, password_hash, plan, display_name, email_verified)
  VALUES ('test@example.com', '$2b$10$...', 'pro', 'Test User', true)
  ```
- [ ] Log in via `POST /api/auth/login` to get the JWT cookie
- [ ] Save authenticated state to `playwright/.auth/user.json`
- [ ] All subsequent tests reuse this state — no login UI in every test
- [ ] Add a teardown that cleans up the test user and any created decks

#### 3.3 Core flow tests (3 files, 80% of the value)

**New file:** `e2e/auth.spec.ts`
- [ ] Test: landing page renders, CTA visible
- [ ] Test: protected routes redirect to login when unauthenticated
- [ ] Test: logout clears session

**New file:** `e2e/generate-and-study.spec.ts`
- [ ] Test: authenticated user generates a deck from topic
- [ ] Test: saved deck appears on dashboard
- [ ] Test: start study session → flip card → complete → results shown

**New file:** `e2e/marketplace.spec.ts`
- [ ] Test: browse marketplace → view listing detail → see price, seller, cards
- [ ] Test: purchase button initiates Stripe Checkout (verify redirect URL contains `checkout.stripe.com`)

### Research Insights: E2E Scope

**Simplicity Reviewer:** 6 separate test files is over-engineered for launch. 3 files covering auth, core loop (generate + study), and marketplace give 80% of the confidence with 50% of the effort. Add subscription and seller tests post-launch when those flows have real usage.

**Playwright best practices from Context7:**
- Use `storageState` for authenticated tests — avoids login in every test
- Use setup project with `dependencies` — runs auth setup once
- `reuseExistingServer: !process.env.CI` — reuse running dev servers locally, start fresh in CI
- Add `fullyParallel: true` to Playwright config — the 3 test files test independent flows and can run concurrently

**Testing Stripe without real payments:**
- Intercept the Stripe redirect: `await page.waitForURL(/checkout\.stripe\.com/)` to verify the redirect happens
- For webhook testing, use Stripe CLI's `stripe trigger` command in a separate integration test, not E2E

**Performance Oracle finding (P2):** The 2-minute target is achievable locally (servers already running with `reuseExistingServer`), but CI cold starts add 10-20 seconds. For CI, consider using `npm run build && npm run preview` for the frontend webServer command — Vite preview serves static files in < 1s vs 3-6s for dev server.

### Acceptance Criteria

- [ ] `npm run test:e2e` passes all specs
- [ ] Each critical path has at least one happy-path test
- [ ] Screenshots captured on failure
- [ ] Tests complete in < 2 minutes locally, < 3 minutes in CI

---

## Phase 4: Analytics & Funnel Instrumentation

**Effort:** S-M (1 day) | **Blocks:** marketing (measurement) | **Dependencies:** none (run parallel with Phase 2)

Fill the gaps in funnel tracking so marketing effectiveness can be measured from day one.

### Tasks

#### 4.1 Add critical funnel events only

**Existing events (already tracked):**
- `onboarding_step_completed` (steps 1, 2, 3) — Welcome.jsx
- `deck_generated` (method: photo/text) — Generate.jsx
- `study_session_started`, `study_session_completed` — Study.jsx
- `listing_viewed`, `purchase_started` — MarketplaceDeck.jsx
- `marketplace_viewed` — Marketplace.jsx
- `streak_milestone` — Dashboard.jsx
- `deck_duplicated` — DeckView.jsx

**Events to add (trimmed to 2 — the rest already exist server-side):**

### Research Insights: Events Already Tracked Server-Side

**Architecture Strategist review finding (P1):** `server/src/services/analytics.js` with `trackServerEvent()` is already called extensively:
- `signup_completed` — already tracked in `auth.js:211`, `auth-google.js:105`, `auth-magic.js:128`, `auth-apple.js:93`
- `subscription_started` — already tracked in `stripe.js:167`
- `subscription_cancelled` — already tracked in `stripe.js:206`
- `purchase_completed` — already tracked in `stripe.js:287`

These do NOT need redundant client-side events. Only 2 new client-side events are needed:

| Event | Page | When | Why critical |
|-------|------|------|--------------|
| `deck_saved` | Generate.jsx | After user saves generated deck | Activation — distinct from `deck_generated` which fires at preview |
| `subscription_page_viewed` | Pricing.jsx | User views pricing page | Revenue intent — measures how many activated users explore paying |

### Research Insights: PostHog Event Timing Gap

**Performance Oracle review finding (P1):** `analytics.track()` in `client/src/lib/analytics.js` uses optional chaining (`posthog?.capture()`). If PostHog SDK hasn't loaded yet (during the `import('posthog-js')` dynamic import which takes 50-500ms), events are **silently dropped**. This means events fired immediately after consent is granted or after login may be lost.

**For the 2 new events this is low risk** — `deck_saved` fires after a multi-step generation flow (minutes after page load), and `subscription_page_viewed` fires on page navigation (PostHog will be loaded by then).

**However, there is a critical existing bug (Performance Oracle Round 2, P1):** For returning users who previously granted consent, `ConsentBanner` returns `null` and `initPostHog()` is **never called**. The `consentGranted` flag is `true` from localStorage, so `track()` passes the consent check, but `posthog` is `null` forever. **Every event is silently dropped for the entire session.** This affects all existing events too, not just the new ones.

**Required fix (add to Phase 4 scope):**

- [ ] Add eager initialization to `client/src/lib/analytics.js`:
  ```js
  // At the end of analytics.js — auto-init for returning users
  if (consentGranted) {
    initPostHog();
  }
  ```
- [ ] Add an event queue for events fired during the SDK import delay:
  ```js
  let eventQueue = [];
  // In track(): if posthog is null, push to queue
  // In initPostHog(): after posthog is assigned, flush the queue
  ```

#### 4.2 Add user properties for segmentation

**File:** `client/src/lib/AuthContext.jsx` (where `analytics.identify` is called)

- [ ] Send user properties on identify: `plan`, `deck_count`, `study_score`
- [ ] Keep it minimal — PostHog can derive most segments from events

#### 4.3 Verify server-side events

### Research Insights: Server-Side Analytics

**Repo Research finding:** Server-side PostHog already exists at `server/src/services/analytics.js`. It includes:
- PostHog Node SDK initialization
- Consent-checking via DB preferences (GDPR compliant)
- Fire-and-forget event capture
- `shutdownAnalytics()` called on SIGTERM for clean flush

**Already verified (Architecture Strategist review):**
- `signup_completed` tracked in `auth.js:211`, `auth-google.js:105`, `auth-magic.js:128`, `auth-apple.js:93`
- `subscription_started` tracked in `stripe.js:167`
- `subscription_cancelled` tracked in `stripe.js:206`
- `purchase_completed` tracked in `stripe.js:287`

**Tasks:**
- [ ] Verify all 4 server-side events fire correctly in test/staging (smoke test with Stripe test mode)
- [ ] If any are missing or broken, fix using existing `trackServerEvent` pattern

### Acceptance Criteria

- [ ] Full funnel trackable: signup (server) → generate (existing) → save (new) → study (existing) → subscribe (server)
- [ ] Marketplace funnel: view (existing) → purchase_started (existing) → purchase_completed (server)
- [ ] `deck_saved` and `subscription_page_viewed` events fire correctly in PostHog
- [ ] Server-side events verified in test/staging

---

## Phase 5: Mobile Toolchain & iOS Compliance

**Effort:** M (1-2 days) | **Blocks:** iOS beta | **Dependencies:** none (parallel with web phases)

Fix the mobile build/test environment and ensure iOS marketplace doesn't violate App Store rules.

### Tasks

#### 5.1 Upgrade to Node 22.x LTS

### Research Insights: Node Version

**Learnings Researcher finding:** The iOS offline study sync solution (`docs/solutions/integration-issues/ios-offline-study-sync-and-local-storage.md`) explicitly states: "Use Node 22 when running Vitest and TypeScript on mobile codebase (sensitive to runtime version)."

**Mobile CLAUDE.md confirms:** Test command is `node ./node_modules/vitest/vitest.mjs run` — requires Node 22+ for Vitest v4 compatibility.

- [ ] Install Node 22.x LTS via nvm/fnm: `nvm install 22 && nvm alias default 22`
- [ ] Update any CI configuration to use Node 22
- [ ] Keep `mobile/package.json` engines at `>=20.19.4` (or bump to `>=22`)
- [ ] Verify `npm test`, `npm run lint`, `npm run typecheck` all pass under Node 22

#### 5.2 Verify mobile test suite passes

- [ ] Run `node ./node_modules/vitest/vitest.mjs run` under Node 22
- [ ] Fix any test failures
- [ ] Run `expo lint` and fix any lint errors

#### 5.3 Gate iOS marketplace purchases

**File:** `mobile/app/(tabs)/marketplace/[id].tsx`

The feature flag infrastructure (`purchaseAvailability?.ios_native.enabled`) already exists with disabled state messaging.

- [ ] Verify the server-side flag is set to disable iOS marketplace purchases for App Store submission
- [ ] Change disabled state message from current text to: "Visit ainotecards.com to purchase decks"
- [ ] Remove "Buy in Browser" CTA text — even when enabled, this framing risks App Store rejection. Change to "Purchase Deck" or similar neutral language.
- [ ] Do NOT add a "View on Web" link on the listing detail page — **Simplicity Reviewer (Round 2):** Apple reviewers specifically look for buttons that redirect users to external purchase flows. A web link on a purchase-disabled listing is exactly the pattern that triggers guideline 3.1.1 rejections. The disabled notice text is sufficient.

#### 5.4 Handle iOS seller placeholder screens

**File:** `mobile/app/seller.tsx`, `mobile/app/sell/[deckId].tsx`

- [ ] **Option A (recommended for web-first):** Remove seller entry points from iOS navigation. Add a "Manage Listings on Web" link in iOS profile/settings that opens Safari to the seller dashboard URL.
- [ ] Ensure the removed screens don't leave dead routes that could be navigated to via deep links

#### 5.5 Verify iOS builds

- [ ] Run `npm run typecheck` — must pass
- [ ] Run a simulator build: `APP_ENV=development npm run ios:simulator`
- [ ] Verify: login, view decks, study, marketplace browse all work

### Acceptance Criteria

- [ ] Mobile `npm test`, `npm run lint`, `npm run typecheck` all pass under Node 22
- [ ] iOS marketplace doesn't show "Buy in Browser" CTA
- [ ] No placeholder screens accessible via navigation
- [ ] Simulator build launches and runs basic flows

---

## Phase 6: Production Hardening & Ops

**Effort:** S-M (1 day) | **Priority:** should-fix soon after launch | **Dependencies:** Phase 1

Improve operational resilience for when real users and real money are flowing.

### Tasks

#### 6.1 Structured error logging

**File:** `server/src/routes/stripe.js`, `server/src/services/ai.js`, `server/src/services/notifications.js`

- [ ] Ensure webhook handlers log failures with structured context: `{ event_type, stripe_event_id, error_message, user_id }`
- [ ] Ensure AI provider fallback logs which provider failed and which succeeded
- [ ] Ensure `notifyUser` failures are logged (not just thrown)
- [ ] Add Sentry breadcrumbs for webhook processing steps
- [ ] **Sanitize webhook error responses (Security Sentinel Round 2, P2):** `server/src/index.js:111` and `server/src/routes/stripe.js:135` both return `Webhook Error: ${err.message}` which leaks internal details (signing secret mismatches, timestamps). Change to: `res.status(400).send('Webhook signature verification failed')` — keep `console.error(err.message)` for server-side debugging

#### 6.2 Runbook documentation

**New file:** `docs/runbooks/billing-incidents.md`

- [ ] How to replay a failed Stripe webhook (`stripe events resend`)
- [ ] How to manually fulfill a stuck purchase (SQL + deck copy)

Simplicity Reviewer (Round 2): Trimmed from 5 to 2 scenarios. Manual plan changes use admin panel or SQL UPDATE. Seller suspension uses existing admin moderation queue. Migration rollback is automatic (transactional migrator). Write the other 3 runbooks when the situation actually arises.

#### 6.3 Production environment verification

- [ ] Create and run a checklist of all required env vars:
  - `DATABASE_URL`, `DATABASE_URL_DIRECT`, `JWT_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`
  - `RESEND_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN`
  - `CLIENT_URL`, `APPLE_TEAM_ID`, `IOS_BUNDLE_ID`
- [ ] Verify Stripe webhook endpoints are registered and receiving events
- [ ] Verify Supabase storage bucket permissions

### Research Insights: Health Check

**Simplicity Reviewer:** The original plan proposed pinging Stripe, Resend, and AI providers from the health endpoint. This is over-engineering: Railway's built-in health check (`GET /api/health` with DB ping) is sufficient. External service pings add latency, create false-negative alerts (Stripe API down ≠ your app is down), and you'll know about Stripe outages from their status page. Add deep health checks only after a real outage demonstrates the need.

### Acceptance Criteria

- [ ] All webhook failures produce actionable log entries
- [ ] Runbook exists for top 5 operational scenarios
- [ ] All production env vars verified

---

## Phase 7: Post-Launch Web Polish

**Effort:** M (2-3 days) | **Priority:** nice-to-have, improves retention | **Dependencies:** launched web app

Polish work that makes the app feel premium rather than merely functional.

### Tasks

#### 7.1 Responsive QA pass

- [ ] Test all pages at mobile (375px), tablet (768px), and desktop (1280px) breakpoints
- [ ] Fix any layout breaks, overflow issues, or touch target problems
- [ ] Pay special attention to: Generate page (photo upload), Study page (card flip), Marketplace (grid layout)

#### 7.2 Performance optimization

- [ ] Analyze bundle with `npx vite-bundle-visualizer`
- [ ] Current: ~446 kB JS before gzip
- [ ] Add `React.lazy()` + `Suspense` for low-traffic routes: Admin, SellerDashboard, ListDeck, Profile
- [ ] Review dashboard loading — virtualize deck list if users accumulate > 50 decks

#### 7.3 Deferred trust signals

Items cut from Phase 2 for post-launch:
- [ ] Verified Seller badge (once sellers exist and have sales data)
- [ ] Listing age display
- [ ] Seller profile page (accessible from marketplace listing)

#### 7.4 First-success polish (if retention data warrants it)

- [ ] "Study these cards now?" CTA after first generation
- [ ] "Generate more cards?" prompt after first study session
- [ ] "You haven't studied in X days" banner on dashboard

#### 7.5 ModalShell accessibility upgrade

Items cut from Phase 2 for post-launch:
- [ ] Add focus trap to `ModalShell` (install `focus-trap-react` or hand-roll)
- [ ] Add body scroll lock
- [ ] Full WCAG 2.1 AA modal compliance audit

### Acceptance Criteria

- [ ] No layout issues at standard breakpoints
- [ ] Bundle size reduced meaningfully via lazy loading
- [ ] Trust signals show real data once sellers exist

---

## Phase 8: iOS Seller & Marketplace Completion

**Effort:** L (3-5 days) | **Priority:** required for iOS App Store launch | **Dependencies:** Phases 5, web seller flow as reference

Build real iOS seller and marketplace experiences to bring iOS from 2.8/10 to launch quality.

### Tasks

#### 8.1 iOS Seller Dashboard

**File:** `mobile/app/seller.tsx` (replace placeholder)

- [ ] Show earnings summary (total earnings, this month, pending)
- [ ] Show active listings with status badges (active, pending_review, delisted)
- [ ] Pull data from `GET /api/seller/dashboard` and `GET /api/seller/listings`
- [ ] Add pull-to-refresh
- [ ] Match web seller dashboard functionality
- [ ] Link to web for Stripe Connect management (open Safari)

#### 8.2 iOS Listing Creation/Edit

**File:** `mobile/app/sell/[deckId].tsx` (replace placeholder)

- [ ] Listing creation form: title, description, price ($1-$5), category picker, tags (up to 5)
- [ ] Preview of deck cards included in listing
- [ ] Submit → `POST /api/seller/listings`
- [ ] Edit flow for existing listings → `PATCH /api/seller/listings/:id`
- [ ] Delist/relist actions with confirmation
- [ ] Form validation matching web (min 10 cards, category required)

#### 8.3 Deepen iOS Marketplace Detail

**File:** `mobile/app/(tabs)/marketplace/[id].tsx`

- [ ] Show preview cards (scrollable list or carousel)
- [ ] Show seller info, purchase count, average rating
- [ ] Show full description
- [ ] Rating display (stars + count)
- [ ] Share button (already exists, verify it works well)
- [ ] Clear messaging for purchase availability based on feature flag

#### 8.4 iOS Profile Parity

- [ ] Verify account management features match web where appropriate
- [ ] Add seller section to profile if user is a seller
- [ ] Add subscription management section (RevenueCat restore + manage subscription)

#### 8.5 App Store Submission Preparation

### Research Insights: App Store Review Notes

**Learnings Researcher finding:** `docs/solutions/feature-patterns/pre-launch-checklist.md` (lines 210-232) contains a battle-tested App Store reviewer notes template:

> AI Notecards offers Pro subscriptions through Apple In-App Purchase in the Profile tab. Reviewers can sign in with the demo account below, open Profile, and view monthly / annual subscription options plus Restore Purchases. Existing subscribers from the web may sign in and retain access because subscription entitlement is synced server-side. Marketplace deck purchases use a browser checkout flow for creator marketplace transactions; if required for review, marketplace purchasing can be disabled while browsing remains available.

**Operational checklist before submission:**
- [ ] Confirm demo account works on current build
- [ ] Confirm subscription products match App Store Connect configuration
- [ ] Confirm Restore Purchases and "Manage in Apple" are visible
- [ ] Confirm `IOS_MARKETPLACE_WEB_PURCHASES_ENABLED` value matches reviewer notes
- [ ] Generate App Store screenshots (6.7" and 6.1" iPhone)
- [ ] Write App Store description and keywords
- [ ] Create `apple-app-site-association` file for universal links
- [ ] TestFlight beta distribution for testing

### Acceptance Criteria

- [ ] Seller dashboard shows real data, not placeholders
- [ ] Listing creation works end-to-end on iOS
- [ ] Marketplace detail shows cards, ratings, seller info
- [ ] TestFlight build passes basic smoke test
- [ ] App Store review notes prepared using tested template

---

## Summary: Critical Path to Web Launch

### Research Insights: Corrected Dependency Graph

**Architecture Strategist review (P2):** Phases 2 and 4 have NO dependency on Phase 1. Only Phase 3 (E2E tests that verify CSP headers) depends on Phase 1. Starting Phases 2 and 4 immediately saves up to half a day of idle time.

```
START (all three begin immediately in parallel)
    |
    +--- Phase 1 (half day) — Security Hardening
    |
    +--- Phase 2 (1-2 days) — Web UX Polish
    |
    +--- Phase 4 (1 day) — Analytics
    |
    +--- Phase 5 (1-2 days) — iOS Compliance (independent, any time)
    |
    └─── After Phases 1+2+4 complete ───→ Phase 3 (2-3 days)
                                              E2E Tests (validates all)
                                              |
                                        WEB LAUNCH READY
                                              |
                                        Phase 6 (1 day, post-launch)
                                              |
                                        Phase 7 (2-3 days, post-launch)
                                              |
                                        Phase 8 (3-5 days, deferred)
```

**Minimum viable web launch (Phases 1-4, with 1/2/4 parallel):** ~4-5 days of focused work
**Full web launch with iOS compliance (+ Phase 5):** ~5-6 days
**Complete including post-launch polish:** ~12-16 days total

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Helmet CSP breaks Stripe/Google/PostHog | Medium | High | Per-directive allowlist provided above; test each integration; `crossOriginEmbedderPolicy: false` for Google |
| Vite inline scripts blocked by CSP | High if misconfigured | Critical | Use `'unsafe-inline'` for v1; migrate to nonce strategy post-launch |
| react-hot-toast inline styles blocked | High if misconfigured | Medium | `style-src 'unsafe-inline'` included in config |
| E2E tests flaky in CI | Medium | Medium | Use Chromium only; `storageState` for auth; retry once; screenshot on failure |
| App Store rejects marketplace browser checkout | Medium | High | Feature flag already exists to disable; reviewer notes template prepared |
| Node 22 upgrade breaks mobile dependencies | Low | Medium | Vitest v4 requires Node 22; test in isolation; keep package-lock committed |

---

## References

### Audit
- `docs/2026-03-17-sprint/prelaunch-launch-readiness-audit.md`

### Institutional Learnings Applied
- `docs/solutions/feature-patterns/pre-launch-checklist.md` — App Store review notes template (lines 210-232), ErrorBoundary patterns, Sentry PII scrubbing
- `docs/solutions/feature-patterns/account-settings-experience.md` — Modal patterns (SellerTermsModal), ARIA menu, debounce/serialize
- `docs/solutions/integration-issues/ios-offline-study-sync-and-local-storage.md` — Node 22 requirement, offline sync patterns
- `docs/solutions/auth-implementation-guide.md` — JWT patterns, token revocation

### Completed Plans (all FINISHED)
- `docs/plans/2026-03-14-feat-pre-launch-blockers-plan.md` — Sentry, legal, error boundary, meta, email verification
- `docs/plans/2026-03-14-feat-ux-polish-and-retention-plan.md` — PostHog, onboarding, deck duplication
- `docs/plans/2026-03-12-feat-marketplace-production-readiness-plan.md` — Stripe Connect, webhooks, schema
- `docs/plans/2026-03-15-feat-ios-monetization-and-subscriptions-plan.md` — RevenueCat, IAP
- `docs/plans/2026-03-15-feat-ios-native-experience-and-app-store-launch-plan.md` — Push, universal links, App Store

### Key Implementation Files
- `server/src/index.js` — Express setup (add helmet here, line ~70 after cors)
- `server/src/services/analytics.js` — Server-side PostHog (already exists)
- `client/src/pages/Settings.jsx:511` — "Email delivery coming soon"
- `client/src/pages/Settings.jsx:9` — Duplicated SellerTermsModal (also in Dashboard.jsx:9)
- `client/src/pages/Dashboard.jsx:197` — confirm() dialog
- `client/src/pages/SellerDashboard.jsx:88` — confirm() dialog
- `client/src/lib/analytics.js` — Client PostHog integration
- `server/src/services/notifications.js` — Push notification service
- `mobile/app/seller.tsx` — Placeholder seller dashboard
- `mobile/app/sell/[deckId].tsx` — Placeholder list deck screen
- `mobile/app/(tabs)/marketplace/[id].tsx` — Marketplace detail with feature flag
