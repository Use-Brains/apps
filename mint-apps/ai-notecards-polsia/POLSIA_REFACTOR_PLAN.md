# Polsia Refactor Plan

## Executive summary

`ai-notecards-polsia` is a full in-repo working copy of the current AI Notecards app intended as a refactor sandbox. The copy preserves the existing three-surface architecture: a React + Vite web client, an Express + PostgreSQL backend, and an Expo/React Native iOS app. For Polsia collaboration, the safest path is not a full rewrite up front. Keep the core Express domain logic and PostgreSQL schema shape where practical, then replace hosting assumptions, storage boundaries, environment wiring, and Supabase-coupled edges in phases.

The main technical risk is not Express itself. The highest-coupling areas are seller marketplace payments, Supabase storage assumptions, and iOS-specific auth/offline/billing systems that are mixed into the wider product story. A web-first Polsia alignment should happen before any serious mobile or marketplace parity work.

## First-pass status

This first pass is intentionally narrow. It does not rewrite auth, payments, or the mobile app. It does:

- add a server runtime/config boundary in `server/src/config/runtime.js`
- move storage URL resolution behind `server/src/services/storage.js`
- make seller tools and native billing/session behavior explicitly flaggable
- make the web API base env-driven instead of assuming a Vercel rewrite
- centralize public app URL construction for checkout, onboarding, email, and notification links
- add an opt-in Express-serves-client mode for unified deployment prep
- add a web seller read-only boundary so seller pages remain visible when seller tools are disabled

This means the copied app is closer to a Polsia-ready web-core architecture without deleting existing seller or native product logic.

## Current stack inventory

- Monorepo app with `client/`, `server/`, `mobile/`, `docs/`, `scripts/`, and `todos/`
- Web frontend built with React 19, Vite 6, Tailwind, React Router
- Backend built with Express 4, `pg`, SQL migrations, JWT auth, Stripe, Resend
- Mobile app built with Expo 55, React Native 0.83, Expo Router, React Query
- PostgreSQL schema managed by raw SQL migrations in `server/src/db/migrations/`
- Production web rewrite currently points Vercel frontend traffic at a Railway-hosted API

## Current frontend stack

- React 19 with Vite 6 in `client/`
- React Router for page routing
- Tailwind CSS for styling
- `@react-oauth/google` for Google auth on web
- `posthog-js`, `@vercel/analytics`, and Sentry for analytics/observability
- Direct API access through `/api` rewrite in `client/vercel.json`

## Current backend stack

- Express 4 API in `server/src/`
- PostgreSQL access through `pg` and a shared pool in `server/src/db/pool.js`
- Schema evolution via versioned SQL migrations in `server/src/db/migrations/`
- JWT cookie sessions for web and access-token + refresh-token sessions for native clients
- AI providers via OpenAI and Google Gemini SDKs
- Email via Resend
- Stripe billing, Stripe Connect marketplace flows, and webhook handling
- Sentry and PostHog server-side instrumentation

## Auth dependencies

- Email/password auth using `bcrypt` and JWT
- Google Sign-In on web and mobile
- Apple Sign-In support on native iOS
- Magic-link flow via emailed verification codes
- Web session cookies plus CSRF-style `X-Requested-With` checks
- Native refresh-token lifecycle, device metadata, SecureStore-backed session restore
- Optional biometric session lock in mobile auth

## Database dependencies

- PostgreSQL is the system of record
- Existing schema already models:
  - users and auth state
  - decks/cards/study sessions/streaks
  - marketplace listings, purchases, ratings, moderation
  - refresh tokens
  - notification device tokens
  - billing platform state and RevenueCat reconciliation
- Current docs and config suggest Supabase-hosted Postgres or Supavisor-style pooling, but the app code itself only requires standard Postgres URLs

## Storage dependencies

- Avatar upload/delete uses Supabase Storage directly in `server/src/services/storage.js`
- The storage layer is thin and replaceable, but URL construction and public object paths are currently hard-coded around Supabase
- Marketplace and deck media appear lighter than avatar/storage concerns today, but future seller assets would likely follow the same storage path

## Payments dependencies

- Stripe subscriptions for web Pro billing
- Stripe billing portal for web account management
- Stripe Connect for seller onboarding and payout readiness
- Marketplace purchase fulfillment via Stripe webhooks and destination-charge style logic
- RevenueCat on iOS for native subscription handling
- Shared user billing state across Stripe and Apple/RevenueCat increases coupling

## Mobile/iOS-specific dependencies

- Expo app config and EAS build profiles in `mobile/app.config.js` and `mobile/eas.json`
- Apple Sign-In and associated domains
- SecureStore token persistence
- RevenueCat subscriptions
- Expo Notifications
- Offline deck download and session sync using Expo SQLite + MMKV
- Expo Router navigation and device-specific auth/session bootstrapping

## Deployment assumptions

- Web frontend expects Vercel-style deployment and rewrites
- API is currently wired to a Railway-hosted URL in `client/vercel.json`
- Backend expects environment-managed Postgres, Stripe, Supabase, Resend, and auth secrets
- Mobile assumes Expo/EAS workflows for internal and production builds
- Current setup is split-deployment oriented, not a single-service Render-style template yet

## Marketplace/seller-specific complexity

- Seller onboarding depends on Stripe Connect account state and webhooks
- Listing lifecycle is tied to payout readiness, seller terms, and moderation
- Purchase flow copies decks/cards transactionally after successful payment webhooks
- Ratings require purchase + completed study session
- Subscription platform state intersects with seller capabilities in account/settings surfaces
- This is the highest business-logic complexity area and the worst candidate for an initial porting sprint

## Target Polsia-aligned assumptions

### Express backend

- Keep Express as the API layer for the initial Polsia-aligned version
- Retain route/service split where it already exists
- Keep raw SQL migrations unless Polsia has a hard ORM requirement

### PostgreSQL on Neon

- Swap infra assumptions from Supabase-hosted/pooler-oriented Postgres to Neon-compatible Postgres URLs
- Confirm connection settings and migration path for pooled and direct connections
- Avoid changing schema semantics in the first porting pass unless required by Neon or deployment tooling

### React + Vite frontend

- Keep the current web stack
- Replace Vercel-specific rewrite assumptions with environment-based API base URLs suitable for Render-style deployment
- Preserve current route and component structure unless Polsia needs a different shell

### Render-style deployment assumptions

- Treat frontend and backend as separately deployable services
- Move from Vercel + Railway coupling toward explicit frontend env vars and backend public URL assumptions
- Normalize health checks, CORS, and callback URLs around Render-style domains

### R2-like object storage assumptions where relevant

- Replace Supabase avatar storage with a narrow storage adapter that can target R2-style object storage
- Prefer signed/server-mediated upload flows or a simple server upload abstraction
- Do not keep provider-specific public URL composition in auth/user serialization

## What can likely stay

- Express server structure and most route/service logic
- Raw PostgreSQL schema and migration history
- React + Vite web client foundation
- Most study/deck/product logic
- JWT-based auth concepts
- Email/password, Google auth, and magic-link concepts
- Existing testing approach for server and some mobile units

## What must be replaced

- Supabase storage integration and URL assumptions
- Vercel-to-Railway rewrite coupling
- Environment naming and deployment assumptions tied to current infra
- Any backend logic that assumes Supavisor-specific pool/direct URL behavior without abstraction
- Brand/app-specific naming and config if the Polsia collaboration expects a different product shell

## What should be cut or feature-flagged off

- Seller onboarding and payout setup should be feature-flagged, not deleted
- RevenueCat reconcile endpoints should be feature-flagged in non-native deployments
- Native refresh-token session paths should be feature-flagged in web-core deployments
- Push notification infrastructure should be feature-flagged in web-core deployments
- Stripe Connect webhook handling should be treated as optional/deferred infrastructure

## What should be deferred or cut from initial Polsia collaboration

- Stripe Connect seller marketplace
- Marketplace purchase fulfillment
- Seller dashboards and listing management
- RevenueCat/Apple subscription parity
- Offline mobile sync parity
- Push notifications
- Advanced moderation/admin flows

## Recommended phased migration plan

### Phase 1: Freeze boundaries

- Keep the copied app isolated under `mint-apps/ai-notecards-polsia`
- Introduce a migration inventory and dependency map
- Mark web-first scope for the Polsia prep branch

### Phase 2: Decouple infrastructure

- Replace hard-coded Vercel/Railway assumptions with env-driven frontend/backend URLs
- Add a storage adapter boundary for avatars/files
- Make Postgres config Neon-friendly without changing application behavior

### Phase 3: Narrow the product slice

- Disable or isolate seller marketplace paths behind clear boundaries
- Identify the minimum web product slice: auth, generate, decks, study, settings
- Document mobile-only logic as non-blocking for the Polsia collaboration phase

### Phase 4: Port web-first runtime

- Stand up backend and web frontend under Polsia-aligned env/deploy assumptions
- Validate auth, deck CRUD, generation, and study flows on the new stack
- Keep marketplace and native billing out of the first production candidate

### Phase 5: Reintroduce optional systems

- Reassess storage, subscriptions, marketplace, and mobile in that order
- Only reintroduce each system after its boundary is explicit and testable

## Top technical blockers

- Supabase storage is directly embedded in avatar handling and user serialization
- `client/vercel.json` still assumes a Vercel rewrite path even though the copied app now has env-driven and unified-serve prep modes
- Billing is split between Stripe web flows and RevenueCat iOS flows
- Marketplace logic depends on Stripe Connect webhooks and transactional copy-on-purchase semantics
- Native auth/offline/session systems are substantial and not aligned to a web-first Polsia collaboration goal

## Highest-risk subsystems

- `server/src/routes/stripe.js` and `server/src/services/purchase.js`
- `server/src/routes/seller.js`
- `server/src/services/billing.js`
- `server/src/routes/auth.js` native-session branch
- `mobile/src/lib/auth.tsx`, `mobile/src/lib/subscriptions.ts`, and `mobile/src/lib/offline/*`

## Open questions

- Is Polsia collaboration web-first only, or does it need mobile parity in scope one?
- Does Polsia require preserving the seller marketplace, or can that be deferred entirely?
- Will Polsia provide its own auth layer, or should current auth be adapted?
- Should Neon be the only database target, or should direct local Postgres compatibility remain first-class?
- What storage provider and upload model does Polsia prefer?
- Does the collaboration require keeping AI generation provider logic unchanged?

## Suggested first 10 refactor tasks

1. Keep `ai-notecards-polsia` as the only refactor sandbox and avoid touching the original app.
2. Preserve the current folder structure until the real Polsia repo layout is available.
3. Keep using `server/src/config/runtime.js` as the single place for new runtime flags.
4. Extend the storage adapter so avatar/media URLs never require route-level Supabase knowledge.
5. Replace remaining direct `CLIENT_URL` usage with a centralized public app URL helper.
6. Add a seller capability/read-only availability layer for the client so seller pages can render disabled states cleanly.
7. Add a unified web-core deployment mode where Express can serve built frontend assets when needed.
8. Isolate Stripe Connect webhook and seller onboarding logic behind explicit optional runtime boundaries.
9. Isolate RevenueCat and native refresh-token support from shared billing/auth code paths.
10. Once the Polsia repo structure is known, port only the web-core slice first: auth, generation, decks, study, settings, marketplace browse/read.
