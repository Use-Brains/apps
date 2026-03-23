# Polsia Refactor Plan

## Executive summary

`ai-notecards-polsia` is a full in-repo working copy of the current AI Notecards app intended as a refactor sandbox. The copy preserves the existing three-surface architecture: a React + Vite web client, an Express + PostgreSQL backend, and an Expo/React Native iOS app. For Polsia collaboration, the safest path is not a full rewrite up front. Keep the core Express domain logic and PostgreSQL schema shape where practical, then replace hosting assumptions, storage boundaries, environment wiring, and Supabase-coupled edges in phases.

The main technical risk is not Express itself. The highest-coupling areas are seller marketplace payments, Supabase storage assumptions, and iOS-specific auth/offline/billing systems that are mixed into the wider product story. A web-first Polsia alignment should happen before any serious mobile or marketplace parity work.

## First-pass status

This first pass is intentionally narrow. It does not rewrite auth, payments, or the mobile app. It does:

- add a server runtime/config boundary in `server/config/runtime.js`
- move storage URL resolution behind `server/src/services/storage.js`
- make seller tools and native billing/session behavior explicitly flaggable
- make the web API base env-driven instead of assuming a Vercel rewrite
- centralize public app URL construction for checkout, onboarding, email, and notification links
- add an opt-in Express-serves-client mode for unified deployment prep
- add a web seller read-only boundary so seller pages remain visible when seller tools are disabled

This means the copied app is closer to a Polsia-ready web-core architecture without deleting existing seller or native product logic.

## Confirmed Polsia target structure

Polsia has now confirmed the target repo convention:

- single root `package.json`
- `server/index.js` as the Express entrypoint
- `server/db/index.js` as the standard Neon `pg` entrypoint
- `client/dist` served statically by Express in the deployed app
- `render.yaml` as the deployment config surface
- no separate frontend deployment in the final shape

This removes a major unknown. The remaining work should now optimize for compatibility adapters and path mapping, not for speculative abstractions.

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
- Direct API access now assumes env-driven or same-origin `/api` usage in the unified handoff shape

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

- The handoff build now assumes Express can serve `client/dist`
- Backend still expects environment-managed Postgres, Stripe, Supabase, Resend, and auth secrets
- Mobile still assumes Expo/EAS workflows for internal and production builds
- The copied sandbox is now materially closer to a single-service Render-style template than to the older Vercel + Railway split

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

Status: complete

- Keep the copied app isolated under `mint-apps/ai-notecards-polsia`
- Introduce a migration inventory and dependency map
- Mark web-first scope for the Polsia prep branch

### Phase 2: Structure and deployment alignment

Status: complete

- Keep the current `client/` and `server/` directories in place, but make the root control surface look more like Polsia
- Add root build/start/migrate scripts that operate the web app as a single service
- Add a draft `render.yaml` for the copied app
- Add thin compatibility entrypoints like `server/index.js` where they reduce future move-risk
- Unified Express static-serving mode is now the default handoff expectation

### Phase 3: Runtime and route convergence

Status: complete

- Add a Polsia-aligned DB entry surface and document Neon runtime expectations
- Inventory current routes against the confirmed Polsia route convention
- Mark seller, Stripe Connect, RevenueCat, and native-only surfaces as optional or deferred with exact file references
- Remove `client/vercel.json` from the active handoff path and treat it as completed legacy cleanup
- Root build flow is now verified in the sandbox; runtime boot still depends on real env and database availability

Phase 3 batch 1 now includes:

- `server/src/db/index.js` as the internal DB compatibility surface
- `server/db/index.js` as the future-facing compatibility wrapper
- DB runtime config parsing for pooled vs direct URLs and Neon-friendly pool tuning
- `POLSIA_ROUTE_MATRIX.md` as the route classification artifact for later packaging moves

### Phase 4: Packaging and path migration

Status: complete for the web-core handoff slice

- Move code toward the confirmed `server/*` and `client/*` package layout
- Rewrite imports in one controlled pass after the compatibility surfaces from phases 2 and 3 exist
- Validate auth, deck CRUD, generation, and study flows on the moved layout
- Keep marketplace selling, native billing, and mobile parity out of the first production candidate
- Run a human-relayed prompt loop with Polsia so migration assumptions, missing prep tasks, and any expected data handoff format are clarified before irreversible packaging moves

### Phase 5: Reintroduce optional systems

- Status: in progress

- Reassess storage, subscriptions, marketplace, and mobile in that order
- Only reintroduce each system after its boundary is explicit and testable
- Continue the Polsia prompt loop for deferred systems like storage migration, payments replacement, and any eventual data import/export responsibilities

## Top technical blockers

- Supabase storage is still directly embedded in avatar handling and user serialization
- Billing is still split between Stripe web flows and RevenueCat iOS flows
- Marketplace logic still depends on Stripe Connect webhooks and transactional copy-on-purchase semantics
- Native auth/offline/session systems are still substantial and not aligned to a web-first Polsia collaboration goal

## Highest-risk subsystems

- `server/routes/stripe.js` and `server/services/purchase.js`
- `server/routes/seller.js`
- `server/services/billing.js`
- `server/routes/auth.js` native-session branch
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
3. Keep using `server/config/runtime.js` as the single place for new runtime flags.
4. Extend the storage adapter so avatar/media URLs never require route-level Supabase knowledge.
5. Replace remaining direct `CLIENT_URL` usage with a centralized public app URL helper.
6. Add a seller capability/read-only availability layer for the client so seller pages can render disabled states cleanly.
7. Add a unified web-core deployment mode where Express can serve built frontend assets when needed.
8. Isolate Stripe Connect webhook and seller onboarding logic behind explicit optional runtime boundaries.
9. Isolate RevenueCat and native refresh-token support from shared billing/auth code paths.
10. Once the Polsia repo structure is known, port only the web-core slice first: auth, generation, decks, study, settings, marketplace browse/read.

## Phase 2 deliverables

- Root scripts in `package.json` that reflect single-service build/start/migrate flows
- Draft `render.yaml`
- Thin `server/index.js` entry alignment
- Current-to-target structure mapping in `POLSIA_STRUCTURE_MAP.md`
- Updated migration docs that treat the Polsia repo shape as confirmed rather than hypothetical
- Completed: root build flow now works from the copied sandbox

## Phase 3 deliverables

- DB entrypoint compatibility plan and implementation target
- Route compatibility matrix with exact files
- Clear classification of web-core, optional, and deferred surfaces
- Removal conditions for legacy deploy artifacts like `client/vercel.json`
- Completed: `client/vercel.json` is no longer part of the active handoff path

## Current status summary

- Phase 1: complete
- Phase 2: complete
- Phase 3: complete
- Phase 4: complete for the web-core handoff slice
- Phase 5: started; handoff-hardening docs are complete and optional-system reintroduction remains later work

## Collaboration track

- Use a human-relayed prompt loop with Polsia to exchange:
  - current repo-state summaries
  - structure and deployment assumptions
  - database and storage migration expectations
  - any requested prep work before code/data handoff
- Keep those prompts grounded in the current copied sandbox state rather than hypothetical final architecture
- Track this in `POLSIA_COLLAB_PROMPTS.md`

## Additional handoff-hardening tasks

These tasks are now part of the refactor/handoff plan. They are not optional polish. They reduce Polsia ramp time, remove ambiguity, and make collaboration safer.

### H1. Add a single handoff entry document

- Status: complete

- Create `START_HERE_FOR_POLSIA.md` at repo root
- Purpose:
  - give Polsia one reliable orientation path
  - summarize current repo shape, current launch scope, deferred systems, and collaboration boundaries
  - link out to `README.md`, `POLSIA_PORTING_NOTES.md`, `POLSIA_STRUCTURE_MAP.md`, `POLSIA_ROUTE_MATRIX.md`, `docs/contracts/mobile-api-runtime-contract.md`, and current launch docs under `ops/`
- Include:
  - what Polsia can work on now
  - what remains founder-owned for now
  - what is intentionally placeholder or deferred

### H2. Add a concrete mobile API contract document

- Status: complete

- Create a practical mobile contract doc such as `docs/contracts/mobile-api-runtime-contract.md`
- Purpose:
  - describe the actual mobile-to-backend contract, not just conceptual sensitivity areas
- Include:
  - exact endpoints mobile currently calls
  - required headers, especially native-client headers
  - auth/session expectations
  - critical request/response shapes
  - which fields are high-risk to change
  - which routes are active, optional, or deferred

### H3. Add an environment manifest

- Status: complete

- Create `docs/deployment/environment-manifest.md` or equivalent
- Purpose:
  - make local boot, preview, production, and handoff setup explicit
- Include:
  - required env vars
  - optional env vars
  - deferred env vars
  - which variables are needed for web-core only
  - which are needed for mobile / RevenueCat / notifications / seller / storage
  - current known backend URL expectations for preview and production

### H4. Add a verification status document

- Status: complete

- Create `docs/handoff/verification-status.md` or equivalent
- Purpose:
  - show what is currently proven vs assumed
- Include:
  - exact commands used for verification
  - what currently passes
  - what currently fails
  - what is intentionally placeholder
  - what remains unverified
  - last verification date

### H5. Add a launch-scope decision memo

- Status: complete

- Create `docs/handoff/launch-scope-decision.md` or equivalent
- Purpose:
  - make current product and launch assumptions explicit so Polsia does not infer the wrong scope
- Include:
  - buyer marketplace importance
  - seller tooling deferral stance
  - current Apple subscription / RevenueCat stance
  - current iOS marketplace purchase stance
  - what is firm vs flexible for launch

### H6. Add a handoff decision log

- Status: complete

- Create `docs/handoff/decision-log.md`
- Purpose:
  - track major decisions that affect Polsia collaboration
- Seed with:
  - web-core first collaboration boundary
  - seller tools deferred by default
  - native/mobile parity not first-pass Polsia scope
  - current backend/deployment target assumptions
  - any decisions on marketplace purchase behavior for iOS

### H7. Run a secrets/access scrub pass before deeper collaboration

- Status: complete

- Audit the copied sandbox for:
  - checked-in secrets
  - config files with sensitive values
  - URLs or credentials that should not be shared
  - hidden assumptions about access to external services
- Document the result in a short note under `docs/handoff/`

### H8. Define Polsia-ready execution boundaries explicitly

- Status: complete

- Add a short section to the handoff entry doc or a dedicated `docs/handoff/execution-boundaries.md`
- Include:
  - safe-now Polsia work
  - unsafe / founder-only work
  - work that requires explicit founder approval
  - work that depends on Apple/RevenueCat/real credentials

## Completion criteria for engineering collaboration point

Treat the repo as having reached the Polsia engineering collaboration point only when all of the following are true:

- the web-core structure and route classification are stable
- the active/deferred system boundaries are explicit in docs
- the mobile API contract is documented concretely
- environment setup is documented concretely
- verification status is documented concretely
- launch-scope decisions are documented concretely
- secrets/access scrub is complete
- Polsia can be pointed at one handoff entry document instead of reconstructing context from multiple files

## Immediate next focus

Until the items in "Additional handoff-hardening tasks" are complete, treat them as the highest-priority work under this refactor plan.

Sequence:

1. `START_HERE_FOR_POLSIA.md`
2. concrete mobile API contract doc
3. environment manifest
4. verification status doc
5. launch-scope decision memo
6. decision log
7. secrets/access scrub note
8. execution boundaries doc
