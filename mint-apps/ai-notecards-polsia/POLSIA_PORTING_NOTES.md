# Polsia Porting Notes

## Likely folders/files to refactor first

- `server/src/config/runtime.js`
  - New first-pass config boundary. Keep expanding this instead of adding new env parsing ad hoc.
- `POLSIA_STRUCTURE_MAP.md`
  - Current-to-target path map for the confirmed Polsia repo convention.
- `client/src/lib/api.js`
  - Central web API boundary and a good first place to remove deployment coupling.
- `client/vercel.json`
  - Current web routing depends on a Railway-hosted API URL.
- `server/src/services/storage.js`
  - Thin Supabase-specific storage seam and one of the safest first abstractions.
- `server/src/db/pool.js`
  - Central place to normalize Neon-friendly Postgres configuration.
- `server/src/routes/auth.js`
  - Core auth shape, including native-session branching and user serialization.
- `server/src/routes/stripe.js`
  - High-complexity payment logic that should be isolated early, even if not rewritten immediately.
- `mobile/src/lib/api.ts`
  - Shows the native-specific token/session contract with the backend.
- `mobile/src/lib/auth.tsx`
  - Reveals how far native session behavior diverges from web.
- `mobile/src/lib/subscriptions.ts`
  - RevenueCat boundary and a likely defer target.
- `server/src/db/migrations/015` through `019`
  - Useful marker set for mobile auth, RevenueCat, offline sync, device tokens, and deck archive scope creep.

## Likely Supabase dependencies to unwind

- Avatar upload and delete in `server/src/services/storage.js`
- Public avatar URL generation in auth user serialization
- Operational assumptions around `DATABASE_URL` plus `DATABASE_URL_DIRECT`
- Documentation and env naming that assume Supabase as both Postgres host and storage provider

Supabase is not equally embedded everywhere. The database layer is relatively portable because it already uses `pg` and raw SQL. The harder Supabase dependency is storage, not SQL.

## Likely Stripe Connect / seller marketplace complexity to defer

- Seller onboarding and account refresh flows
- Connect webhook handling
- Listing payout readiness logic
- Marketplace purchase fulfillment
- Deck-copy-on-purchase transactions
- Ratings gated by purchase + completed study
- Seller/admin tooling tied to marketplace safety and moderation

This area is operationally heavy and easy to break. It is a poor candidate for an early Polsia collaboration sprint unless the collaboration is explicitly marketplace-first.

## Likely Apple/iOS-specific logic to isolate from web logic

- Apple Sign-In
- Refresh-token-backed native sessions
- SecureStore token persistence
- Biometric re-entry lock
- RevenueCat subscription identity and purchase flows
- Expo Notifications and device token registration
- Offline deck downloads and queued study sync
- EAS build profiles and associated domain configuration

The key rule: do not let native conveniences drive the first Polsia architecture. Treat mobile as an integration client, not as the system-defining surface.

## Recommended boundary between work to keep in my own codebase and work to prep for Polsia collaboration

### Keep in my own codebase

- Marketplace/seller product evolution
- RevenueCat and Apple billing details
- Offline-first mobile sophistication
- Native auth polish and biometric/session restoration
- App Store-specific configuration and review strategy

### Prep for Polsia collaboration

- Web-first deployment decoupling
- Storage abstraction
- Neon-compatible database configuration
- Backend configuration cleanup
- Feature-boundary identification for marketplace/mobile-only modules
- Clear “core app” slice definition: auth, generate, decks, study, settings

## Concrete warnings about risky areas

- Do not refactor the original `ai-notecards` app in place. Use only `mint-apps/ai-notecards-polsia` for the porting work.
- Do not start by changing database schema semantics unless Polsia has a hard requirement. The schema already carries significant product knowledge.
- Do not start with Stripe Connect. It mixes payments, seller lifecycle, webhooks, and transactional fulfillment.
- Do not start with mobile parity. Native auth, offline sync, and RevenueCat substantially widen the migration surface.
- Do not preserve Vercel/Railway coupling as an implicit default. Make frontend/backend URLs explicit first.
- Do not leave storage provider details embedded in user serialization. That will keep Supabase assumptions alive even if storage is swapped.
- Be careful with shared billing state. The app already distinguishes `subscription_platform` between Stripe and Apple; collapsing that too early risks subtle regressions.
- Be careful with callback URLs and cookies when moving hosting. Auth, Stripe redirects, and CORS all depend on correct public URL assumptions.
- The copied app includes real config-style files because this sandbox was created as a close working copy. Review secrets handling before external collaboration access.

## Recommended first prep move

Define the minimum Polsia web slice and lock it in writing before code changes:

- keep: web auth, deck CRUD, AI generation, study flows, basic settings
- defer: Stripe Connect payout machinery, RevenueCat, native mobile parity, offline sync
- keep visible but disable behind flags: seller tools and native-only billing/session paths

If that scope is accepted, the first code refactor should be an infrastructure boundary pass:

1. centralize env/config access
2. remove Vercel-to-Railway assumptions
3. abstract storage away from Supabase

## First-pass changes completed

- Added runtime/feature flag parsing in `server/src/config/runtime.js`
- Moved iOS marketplace purchase availability onto the shared runtime config surface
- Added provider-aware public storage URL helpers in `server/src/services/storage.js`
- Updated auth/account routes to stop constructing Supabase public URLs directly
- Added seller/native feature gates that preserve current behavior by default and disable cleanly when flags are turned off
- Made the web client API base env-driven via `VITE_API_URL`
- Added a shared public app URL helper in `server/src/config/runtime.js` and moved checkout/onboarding/email link construction onto it
- Added opt-in unified deployment prep so `server/src/index.js` can serve the built client when `SERVE_CLIENT_BUILD=true`
- Added a client-side seller availability helper in `client/src/lib/runtime.js` so `/seller`, `/sell/:deckId`, `Settings`, and seller-entry points degrade into read-only states instead of falling into failed seller actions

## Phase 2 structure-alignment changes

- Added root scripts in `package.json` so the copied app can be built, started, and migrated from a single control surface
- Added a draft `render.yaml` that assumes Express serves `client/dist`
- Added `server/index.js` as a thin compatibility entrypoint ahead of any future path migration
- Added `POLSIA_STRUCTURE_MAP.md` to map the current copied app layout onto the confirmed Polsia target convention

## Phase 3 next focus

- Create a DB entry surface that matches the eventual `server/db/index.js` convention
- Produce a route compatibility inventory before any large file move
- Demote `client/vercel.json` from active deployment assumption to legacy compatibility artifact

## Phase 3 batch 1 completed

- Added `server/src/db/index.js` as the internal DB export surface
- Added `server/db/index.js` as a compatibility wrapper toward the confirmed Polsia path
- Centralized pooled vs direct Postgres config parsing in `server/src/db/runtime.js`
- Added `POLSIA_ROUTE_MATRIX.md` to classify route files into core, optional, and deferred groups

## Phase 4 handoff prep completed

- Added a squashed handoff migration at `server/db/migrations/001_initial.sql`
- Added an idempotent handoff seed at `server/db/seed.js`
- Added guarded handoff DB scripts so the squashed path does not run on top of the legacy migration history
- Switched the default runtime expectation to unified Express-serves-client
- Removed `client/vercel.json` from the handoff path
- Removed `server/src/routes/stripe.js` from Express registration and replaced `/api/stripe/*` with placeholder responses
- Converted buyer purchase checkout to a placeholder response while keeping marketplace browse/detail active
- Kept seller and admin surfaces present as shell routes/pages for the handoff build

## Packaging / path-move prep started

- Added future-facing `server/routes/*` wrappers over the current route implementations
- Added future-facing `server/middleware/*` wrappers over the current middleware implementations
- Added future-facing `server/services/*` wrappers over the current service implementations
- This should reduce the next move from a logic-heavy migration to a mostly mechanical relocation/import-rewrite pass

## Packaging / path-move prep in progress

- Promoted all current live route implementations into `server/routes/*`
- Converted `server/src/routes/*` into a compatibility re-export layer
- Promoted middleware into `server/middleware/*` and converted `server/src/middleware/*` into compatibility re-exports
- Promoted services into `server/services/*` and converted `server/src/services/*` into compatibility re-exports
- Promoted DB runtime/pool/query surfaces into `server/db/*` and converted `server/src/db/*` into compatibility shims
- Promoted `server/index.js` into the live runtime entry
- Promoted `server/app.js` into the live shared Express app module and converted `server/src/app.js` into a compatibility shim
- Promoted `server/config/runtime.js` into the live runtime/config module and converted `server/src/config/runtime.js` into a compatibility shim
- Promoted the legacy sequential migrator and legacy DB scripts into `server/db/*` and converted `server/src/db/migrator.js`, `server/src/db/migrate.js`, and `server/src/db/seed.js` into compatibility shims
- Verified the promoted route/runtime/service surfaces still import cleanly, boot cleanly, and pass the current server test suite

## Remaining direct infra coupling points

- `server/src/services/storage.js`
  - The boundary exists, but the only concrete upload/delete implementation is still Supabase.
- `server/src/services/billing.js`
  - Shared Stripe and Apple/RevenueCat billing state remains coupled here.
- `server/src/routes/stripe.js`
  - Web subscription and marketplace purchase side effects are still Stripe-first.
- `server/src/routes/seller.js`
  - Seller onboarding is still Stripe Connect-specific even though it is now easier to disable.
- `server/src/routes/account.js`
  - Account settings still couple avatar upload, password flows, and best-effort Stripe cleanup into one legacy route module.
- `server/src/routes/auth-apple.js`
  - Native auth remains isolated but has not yet been promoted onto the future-facing route path as a real implementation.
- `server/src/services/purchase.js`
  - Marketplace checkout still assumes Stripe destination-charge style fulfillment.
- `server/src/routes/revenuecat.js`
  - Native billing is gated, but the integration remains present and provider-specific.
- `mobile/src/lib/auth.tsx`
  - Native session restore and device-specific auth remain outside the web-core boundary.
- `mobile/src/lib/subscriptions.ts`
  - RevenueCat product identity and purchase logic remain native-coupled.
