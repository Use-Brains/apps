# Polsia Route Matrix

This matrix classifies the current server route surface against the confirmed Polsia target convention.

## Classification rules

- `target-core`
  - Belongs in the first Polsia web-core slice.
- `target-optional`
  - Can remain in the codebase, but should be isolated behind flags or adapters.
- `target-deferred`
  - Should not define the first Polsia packaging/migration pass.

## Route inventory

| file | current role | target classification | notes |
|---|---|---|---|
| `server/src/routes/auth.js` | web auth, session serialization, native refresh flow | target-core | keep web auth; keep native refresh support isolated |
| `server/src/routes/auth-google.js` | Google sign-in | target-core | still fits Polsia auth surface |
| `server/src/routes/auth-magic.js` | magic-link auth | target-core | still fits Polsia auth surface |
| `server/src/routes/auth-apple.js` | Apple Sign-In | target-deferred | native/iOS-specific |
| `server/src/routes/decks.js` | deck CRUD | target-core | core app surface |
| `server/src/routes/generate.js` | AI generation | target-core | core app surface |
| `server/src/routes/study.js` | study sessions/stats | target-core | core app surface |
| `server/src/routes/settings.js` | settings/preferences | target-core | core app surface |
| `server/src/routes/account.js` | account maintenance/avatar/password | target-core | core app surface |
| `server/src/routes/marketplace.js` | browse, detail, purchase availability, purchase handoff | target-optional | browsing/detail can survive; purchase flow remains optional |
| `server/src/routes/ratings.js` | marketplace ratings | target-optional | tied to marketplace purchase/study coupling |
| `server/src/routes/seller.js` | seller onboarding and listing management | target-deferred | Stripe Connect and seller ops are not first-pass Polsia scope |
| `server/src/routes/stripe.js` | subscriptions, billing portal, webhooks, purchase fulfillment side effects | target-deferred | Stripe-first billing and commerce |
| `server/src/routes/revenuecat.js` | native billing sync | target-deferred | native billing only |
| `server/src/routes/notifications.js` | push token + notification work | target-deferred | native/mobile-biased subsystem |
| `server/src/routes/admin.js` | moderation/admin queue | target-optional | keep only if moderation is required for marketplace browse |

## Import rewrite priority when packaging moves happen

- Lowest-risk first
  - `decks.js`
  - `generate.js`
  - `study.js`
  - `settings.js`
  - `account.js`
- After DB/runtime convergence
  - `auth.js`
  - `auth-google.js`
  - `auth-magic.js`
  - `marketplace.js`
  - `ratings.js`
- Last or separately
  - `seller.js`
  - `stripe.js`
  - `revenuecat.js`
  - `notifications.js`
  - `auth-apple.js`

## Legacy deployment artifact removal trigger

Phase 4 status:

1. `client/vercel.json` has been removed from the handoff path.
2. Express static serving of `client/dist` is now the default runtime expectation.
3. Buyer purchase, seller, Stripe, and admin deferred areas remain registered only as placeholder or shell surfaces in the sandbox handoff build.
