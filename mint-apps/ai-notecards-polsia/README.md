# AI Notecards Polsia Sandbox

This sandbox is the Polsia handoff-prep copy of AI Notecards. Phase 4 now assumes a unified Express-serves-client runtime, a squashed handoff migration, and placeholder shells for deferred billing, seller, and admin workflows.

## Current handoff shape

- Web core stays active:
  - auth
  - deck CRUD
  - AI generation
  - study flows
  - marketplace browse and listing detail
- Deferred surfaces stay present as shells:
  - buyer purchase routes return `{ status: "unavailable", message: "Deck purchases coming soon" }`
  - `/api/stripe/*` returns billing placeholders
  - seller routes/pages stay present as coming-soon shells
  - admin moderation routes/pages stay present as coming-soon shells
- Unified runtime is now the default:
  - Express serves `client/dist` by default
  - `client/vercel.json` is removed from the handoff path

## Install

```bash
npm --prefix server ci
npm --prefix client ci
```

## Environment

Copy `server/.env.example` to `server/.env` and set at least:

```env
DATABASE_URL=postgresql://localhost:5432/notecards_polsia_handoff
DATABASE_URL_DIRECT=postgresql://localhost:5432/notecards_polsia_handoff
JWT_SECRET=replace-me
GROQ_API_KEY=gsk_xxx
GEMINI_API_KEY=your-gemini-key
CLIENT_URL=http://localhost:3001
SERVE_CLIENT_BUILD=true
FEATURE_SELLER_TOOLS=false
```

Notes:

- `SERVE_CLIENT_BUILD=true` is already the default runtime behavior.
- `FEATURE_SELLER_TOOLS=false` is the default handoff mode and keeps seller pages in shell/read-only mode.
- Billing env vars can remain unset for the handoff path because `/api/stripe/*` is placeholder-only.

## Fresh handoff boot path

Use this path for a fresh Polsia-style local boot on a new database.

```bash
createdb notecards_polsia_handoff
npm run build
npm run setup:handoff
npm run start
```

That flow does the following:

- builds the web client into `client/dist`
- applies `server/db/migrations/001_initial.sql`
- seeds curated marketplace/sample data from `server/db/seed.js`
- starts Express, which serves both the API and the built client

Open `http://localhost:3001`.

Seed login:

- `maya.chen@example.com / password123`

## Handoff DB commands

```bash
npm run migrate:handoff
npm run seed:handoff
npm run setup:handoff
```

Safety note:

- `npm run migrate:handoff` refuses to run against a database that already contains the legacy multi-file migration history.
- The legacy chain is still available via `npm run migrate` and `npm run seed`, now backed by `server/db/legacy-migrate.js` and `server/db/legacy-seed.js`.
- The legacy multi-file SQL chain now lives under `server/db/legacy-migrations/`, while the old `server/src/db/*` copies remain as compatibility artifacts during packaging prep.

## Legacy dev split

If you still want the separate Vite dev server while working inside the sandbox:

```bash
npm run dev:server
npm run dev:client
```

In that mode the client talks to `/api` through `VITE_API_URL` instead of a Vercel rewrite.

## Files that matter for phase 4

- `server/db/migrations/001_initial.sql`
- `server/db/migrate.js`
- `server/db/seed.js`
- `server/src/routes/marketplace.js`
- `server/src/routes/handoff-billing.js`
- `server/src/routes/seller.js`
- `server/src/routes/admin.js`
- `server/src/config/runtime.js`

## Verification run

Verified locally in this sandbox:

- `npm --prefix server ci`
- `npm --prefix client ci`
- `npm --prefix server test -- src/config/runtime.test.js src/routes/marketplace.test.js src/routes/seller.test.js`
- `npm --prefix client run build`

Not verified here:

- `npm run setup:handoff`
- `npm run start` against a real Postgres database

## Next phase

- Decide when the legacy `server/src/db/migrations/*` chain can be retired from the sandbox
- Wire real billing/purchase infrastructure in the eventual Polsia repo
- Replace shell seller/admin areas with production flows only after the target environment owns payments and moderation
