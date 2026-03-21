# AI Notecards Prelaunch Audit

Date: 2026-03-16
Audited repo: `/Users/kashane/app-dev/apps/ai-notecards`

## 1. Executive verdict

- Overall launch-readiness: **6.4/10**
- Web app readiness: **7.6/10**
- iOS readiness: **2.8/10**
- Confidence: **medium-high**
- Recommendation: **Do not market the product broadly yet. Finish a focused Phase 1, then market web-first. Do not market iOS yet.**

Why:

- The web app is materially real and close enough to reach a strong launch threshold with a short, disciplined polish pass.
- The backend is better than average for a prelaunch app: auth, payments, AI fallback, offline sync, and billing logic are not toy implementations.
- The iOS app is not launchable yet. Two native monetization surfaces are still placeholders, and the current marketplace purchase path opens browser-based Stripe checkout for digital goods from inside the iOS app, which is likely an App Store blocker.
- Verification is mixed: server tests pass and the web build passes, but mobile `npm test` and `npm run lint` fail in the current environment because the repo requires a newer Node runtime than the machine running the checks.

## 2. What is already strong

- Backend architecture is real, not aspirational. Auth, billing, marketplace, ratings, moderation, notifications, and study sync are all implemented in Express with database-backed flows.
- Auth is stronger than typical prelaunch work. The repo supports cookie sessions for web plus refresh-token mobile sessions in [`server/src/routes/auth.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/routes/auth.js), and uses revocation checks in [`server/src/middleware/auth.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/middleware/auth.js).
- Marketplace fulfillment is thoughtfully implemented. Purchase creation, idempotent webhook fulfillment, deck-copy creation, seller/buyer notifications, and fee calculation are all present in [`server/src/services/purchase.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/services/purchase.js) and [`server/src/routes/stripe.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/routes/stripe.js).
- AI generation is production-shaped. Text generation has provider fallback, photo generation validates mime types and content, and failures are mapped to user-facing errors in [`server/src/routes/generate.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/routes/generate.js) and [`server/src/services/ai.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/services/ai.js).
- Offline study work on mobile is substantive. There is real local storage, offline snapshotting, and sync reconciliation in [`mobile/src/lib/offline/`](/Users/kashane/app-dev/apps/ai-notecards/mobile/src/lib/offline) and [`server/src/services/study-sync.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/services/study-sync.js).
- Observability is started correctly. Client and server both initialize Sentry, and analytics are consent-gated rather than blindly on by default in [`client/src/lib/analytics.js`](/Users/kashane/app-dev/apps/ai-notecards/client/src/lib/analytics.js) and [`client/src/components/ConsentBanner.jsx`](/Users/kashane/app-dev/apps/ai-notecards/client/src/components/ConsentBanner.jsx).
- Verification today:
  - Server tests: **pass** (`32/32`)
  - Web build: **pass**
  - Mobile typecheck: **pass**
  - Mobile tests: **fail in current environment**
  - Mobile lint: **fail in current environment**

## 3. Critical blockers before marketing

### Blocker 1: iOS seller flow is still placeholder-only

- Why it matters: the app is marketed as having a marketplace, buying, and selling. Native sellers currently cannot manage listings or complete a credible seller workflow.
- Evidence:
  - [`mobile/app/seller.tsx`](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/seller.tsx#L5) is only a title/subtitle placeholder.
  - [`mobile/app/sell/[deckId].tsx`](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/sell/[deckId].tsx#L6) only renders “List for Sale” plus the deck id.
- Affected platform: **iOS**
- Severity: **critical**
- Recommended fix: either remove seller entry points from iOS and ship web-first, or finish the seller dashboard and listing creation/edit flow to parity with web.
- Rough effort: **M**

### Blocker 2: current iOS marketplace purchase path is likely App Store non-compliant

- Why it matters: the native app currently initiates purchase of digital study content by opening browser-based checkout. That is likely to trigger App Store review rejection under Apple’s digital goods purchase rules.
- Evidence:
  - [`mobile/app/(tabs)/marketplace/[id].tsx`](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/(tabs)/marketplace/%5Bid%5D.tsx#L53) calls `api.createPurchase(id)` and then opens the returned URL with `WebBrowser.openBrowserAsync`.
  - The CTA explicitly says “Buy in Browser” at [`mobile/app/(tabs)/marketplace/[id].tsx`](/Users/kashane/app-dev/apps/ai-notecards/mobile/app/(tabs)/marketplace/%5Bid%5D.tsx#L111).
- Affected platform: **iOS**
- Severity: **critical**
- Recommended fix: do not market or submit iOS with this flow. Either disable marketplace purchasing in the iOS app, reposition iOS as a reader/study companion, or redesign monetization for App Store compliance.
- Rough effort: **M-L**

### Blocker 3: reminder/notification promise is not fully delivered

- Why it matters: the product exposes notification controls, but the implementation only clearly sends marketplace push notifications. Study reminders are presented in settings without a real delivery path.
- Evidence:
  - Web settings says “Email delivery coming soon” in [`client/src/pages/Settings.jsx`](/Users/kashane/app-dev/apps/ai-notecards/client/src/pages/Settings.jsx#L509).
  - `notifyUser` exists in [`server/src/services/notifications.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/services/notifications.js#L84), but its only production call sites are marketplace purchase events in [`server/src/routes/stripe.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/routes/stripe.js#L301).
- Affected platform: **web / iOS / backend**
- Severity: **high**
- Recommended fix: either remove reminder promises from launch surfaces or implement one real reminder channel end to end, with scheduling, retry, and opt-out handling.
- Rough effort: **M**

### Blocker 4: mobile verification workflow is not healthy in the current toolchain

- Why it matters: launching iOS without a working local verification baseline is risky. Right now the mobile repo requires a newer Node version than the environment used for checks, and that breaks routine validation.
- Evidence:
  - [`mobile/package.json`](/Users/kashane/app-dev/apps/ai-notecards/mobile/package.json#L71) requires `node >=20.19.4`.
  - `npm test` failed under Node `20.10.0` with a `node:util` export error.
  - `npm run lint` failed under Node `20.10.0` with Expo env parsing/runtime errors.
- Affected platform: **iOS / CI / developer workflow**
- Severity: **high**
- Recommended fix: align project, CI, and local Node versions, then make mobile test/lint pass reliably before any iOS launch claims.
- Rough effort: **S**

### Blocker 5: security hardening is incomplete at the HTTP layer

- Why it matters: once you start marketing, traffic quality changes. You need baseline hardening for headers and browser attack surface, not just route logic.
- Evidence:
  - [`server/src/index.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/index.js#L62) sets JSON, cookies, and CORS, but I found no `helmet`, CSP, HSTS, frame protections, or similar header middleware anywhere in the server stack.
- Affected platform: **backend / infra**
- Severity: **high**
- Recommended fix: add `helmet` with an explicit CSP posture, HSTS in production, and review any cross-origin/embed requirements before launch.
- Rough effort: **S**

### Blocker 6: frontend and E2E coverage are too thin for an aggressive launch

- Why it matters: the most fragile launch paths are frontend auth, generation, Stripe redirects/webhooks, seller onboarding, and purchase/rating flows. The repo’s automated coverage does not yet match that risk.
- Evidence:
  - Server tests exist in [`server/src/routes/generate.test.js`](/Users/kashane/app-dev/apps/ai-notecards/server/src/routes/generate.test.js) and related files.
  - I found **no client tests** under `client/`.
  - I found **no Playwright/Cypress E2E suite** in the app repo.
  - Mobile tests exist, but are currently not runnable in this environment.
- Affected platform: **web / iOS / backend**
- Severity: **high**
- Recommended fix: add a small but real E2E suite for signup/login, generate/save/study, subscribe, marketplace purchase, and seller onboarding return flow.
- Rough effort: **M**

## 4. Remaining work by category

### Core product

- Decide the actual launch surface: **web-first** or **web+iOS**. Right now the repo supports web-first much better.
- Tighten premium polish around destructive actions, success states, and empty states.

### Onboarding / activation

- Confirm first-session path from landing/login -> welcome -> generate -> save -> study -> return to dashboard.
- Add event coverage for drop-off points, not just positive actions.

### Flashcard generation flow

- Run real prompt QA on poor inputs, long notes, blurry photos, and hallucination-prone topics.
- Add better user guidance when vision generation fails.

### Marketplace

- Web marketplace is close.
- iOS marketplace is still thin and not launch-quality.
- Add stronger trust indicators: seller history, purchases, maybe “generated by seller” versus “study-tested”.

### Subscriptions / payments

- Web subscription flow is real.
- iOS deck purchase flow is not App Store safe in its current form.
- Rehearse webhook replay, delayed webhook, and failed email/push scenarios operationally.

### Auth

- Auth implementation is solid, but should be tested end to end on deployed domains and native devices.
- Confirm Apple Sign-In and universal-link flows on preview/production iOS builds.

### Profile / settings

- Web settings is broad, but one part is still aspirational: notifications/reminders.
- Mobile settings is strong for device-local controls, but still lighter than web account management.

### Mobile responsiveness

- Web appears generally responsive, but I did not manually run visual QA across breakpoints in this audit.
- A focused browser QA pass is still needed before launch.

### iOS app

- Finish seller dashboard.
- Finish listing creation/edit flow.
- Decide marketplace purchase compliance strategy.
- Expand marketplace detail beyond a thin browser-handoff screen.

### Performance

- Web bundle is acceptable for now but not tiny: build output includes a ~446 kB JS bundle before gzip.
- Review initial dashboard loading and any unvirtualized long lists before heavier traffic.

### Analytics

- Consent pattern is good.
- Funnel instrumentation is still light relative to a real launch.

### Trust / legal / support

- Terms and privacy pages exist.
- Support email exists.
- Seller trust/safety is basic but present.
- Consider adding a visible support/contact route in-product, not just legal pages.

### QA / testing

- Add client and E2E coverage.
- Make mobile verification deterministic under the declared Node version.

### Deployment / ops

- Confirm all production env vars, webhook endpoints, Stripe products/prices, RevenueCat config, and Supabase buckets in non-local environments.
- Add rollback/runbook notes for billing and marketplace incidents.

### Observability

- Sentry exists on web/server/mobile.
- Push more structured operational logging around webhook failures, AI provider failures, and notification send failures.

### App Store readiness

- Current iOS monetization and placeholder screens make the app **not App Store ready**.
- I did not find App Store metadata/screenshots automation in-repo; if it exists elsewhere, it is not visible from this audit.

## 5. Web app polish review

The web app feels materially closer to “marketable” than the mobile app. Routing, auth, dashboard, generation, deck editing, marketplace, seller tooling, and admin surfaces all exist. The tone is coherent and the product does not read like a scaffold.

The main polish gaps are around trust and finish rather than missing architecture:

- Settings still exposes a notifications section with “Email delivery coming soon” in [`client/src/pages/Settings.jsx`](/Users/kashane/app-dev/apps/ai-notecards/client/src/pages/Settings.jsx#L509), which weakens perceived completeness.
- Some destructive or important flows still use browser `confirm()` dialogs instead of product-grade modals:
  - [`client/src/pages/Dashboard.jsx`](/Users/kashane/app-dev/apps/ai-notecards/client/src/pages/Dashboard.jsx#L193)
  - [`client/src/pages/Settings.jsx`](/Users/kashane/app-dev/apps/ai-notecards/client/src/pages/Settings.jsx#L306)
  - [`client/src/pages/SellerDashboard.jsx`](/Users/kashane/app-dev/apps/ai-notecards/client/src/pages/SellerDashboard.jsx#L87)
- I did not verify visual consistency or accessibility via live browser QA in this audit, so that remains a residual risk even though the codebase shape is good.

Verdict on web polish: **above average for a serious beta, not yet fully premium.**

## 6. iOS app review

What is good:

- Real auth flows exist, including Apple/Google/magic-link support.
- Offline study architecture is real.
- Home, deck detail, study, generate, notifications, and subscription settings have meaningful implementation.
- App config and EAS profiles are present in [`mobile/app.config.js`](/Users/kashane/app-dev/apps/ai-notecards/mobile/app.config.js) and [`mobile/eas.json`](/Users/kashane/app-dev/apps/ai-notecards/mobile/eas.json).

What is not good enough:

- Seller dashboard is placeholder-only.
- Sell/list deck screen is placeholder-only.
- Marketplace detail is too thin for launch quality and currently punts purchase into browser checkout.
- I did not see broad native parity for profile/account-management richness compared with web.

Shippability:

- **Not shippable as a marketed iOS product yet.**
- Best current role for iOS: internal preview / companion app / private beta while web launches first.

Exact remaining work to reach launch quality:

- Finish seller dashboard and listing management.
- Finish deck listing creation/edit flow.
- Resolve App Store-compliant marketplace purchase strategy.
- Deepen marketplace detail experience with preview cards, ratings, seller trust, and better failure states.
- Make mobile test/lint/build verification reliable under the project’s stated Node version.

## 7. Security and trust review

What looks good:

- JWT auth with cookie sessions for web and bearer/refresh sessions for mobile.
- Token revocation and deleted/suspended-user enforcement.
- Stripe webhook signature verification.
- Avatar upload content-type and magic-byte checks.
- Sentry PII scrubbing on server and client.

What still needs work:

- Missing baseline HTTP security headers/hardening in the Express app.
- Marketplace trust/safety is present but still v1-level: flagging, admin moderation, suspension, and delisting exist, but there is no deeper fraud/trust layer yet.
- Reminder/notification preference UX is ahead of the actual delivery system.

## 8. Production readiness review

Good:

- Environment examples exist in [`server/.env.example`](/Users/kashane/app-dev/apps/ai-notecards/server/.env.example).
- Health check exists.
- Migrations are versioned and transactional.
- Sentry and PostHog are wired.

Risks:

- No evidence of formal rollback/runbook documentation in-repo for billing or marketplace incidents.
- AI, email, and push failures are mostly logged and surfaced, but operational recovery is still lightweight.
- Mobile verification depends on upgrading Node to the required version.

## 9. Missing analytics / growth readiness

Missing or too light before marketing:

- Funnel metrics for landing -> signup/login -> welcome -> first deck generated -> first saved deck -> first study session.
- Conversion attribution basics.
- Subscription funnel metrics beyond start/cancel.
- Marketplace metrics beyond view and purchase start/completion.
- In-product support / feedback collection.
- Referral/share loops beyond listing/share primitives.

## 10. Prioritized action plan

### Phase 1: must fix before marketing

1. Commit to a **web-first launch** and remove or hide incomplete iOS marketplace/seller promises.
2. Resolve iOS App Store purchase compliance by disabling native deck purchasing or redesigning it.
3. Finish or remove placeholder iOS seller/listing surfaces.
4. Implement one real reminder channel or remove reminder language from launch UX.
5. Add `helmet` and baseline production security headers.
6. Make mobile test/lint pass under the required Node version.
7. Add a minimal E2E suite for critical web revenue/auth flows.

### Phase 2: should fix very soon after launch

1. Replace browser `confirm()` dialogs with branded modal confirmations.
2. Add richer marketplace trust signals and seller credibility UI.
3. Expand analytics for activation, conversion, and retention.
4. Improve operational logging and runbooks for webhooks, notifications, and AI failures.

### Phase 3: nice-to-have polish / optimization

1. Reduce JS bundle size and tighten perceived performance.
2. Add stronger lifecycle messaging for reminders, study streaks, and reactivation.
3. Deepen native marketplace detail and sharing UX.

## 11. Fastest path to “ready to market”

The fastest realistic path is:

1. Treat the launch as **web-first**.
2. Fix the six blockers above.
3. Keep iOS private or clearly secondary.
4. Do one hard manual QA pass across auth, generation, save/edit, study, subscribe, seller onboarding, purchase, and rating.

If you do that, the web product can plausibly cross into a strong launch threshold without overbuilding.

## 12. Exceed-the-standard recommendations

- Add one strong trust layer to the marketplace: seller profile credibility, “X purchases / Y rating / Z study score” prominence, and clearer moderation messaging.
- Add “first-success” polish: better generated-deck success moments, next-best action prompts, and re-engagement after first study.
- Add a support/contact entry inside the authenticated product.
- Build a tiny launch war room dashboard: signup count, first deck rate, first study rate, subscription conversion, purchase conversion, AI failure rate, Stripe webhook failures, and Sentry fatal count.

## Verification appendix

Commands run during this audit:

- `server: npm test` -> **pass**
- `client: npm run build` -> **pass**
- `mobile: npm run typecheck` -> **pass**
- `mobile: npm test` -> **failed in current environment (Node 20.10.0 below repo requirement)`
- `mobile: npm run lint` -> **failed in current environment (Node 20.10.0 below repo requirement)`

Audit limitation:

- I did not run the full stack manually against live third-party services or a real iOS device build in this audit, so UI/runtime confidence is lower than code-structure confidence.
