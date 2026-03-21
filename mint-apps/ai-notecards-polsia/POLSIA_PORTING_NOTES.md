# Polsia Porting Notes

## Likely folders/files to refactor first

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
- defer: seller marketplace, Stripe Connect, RevenueCat, native mobile parity, offline sync

If that scope is accepted, the first code refactor should be an infrastructure boundary pass:

1. centralize env/config access
2. remove Vercel-to-Railway assumptions
3. abstract storage away from Supabase
