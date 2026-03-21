# Polsia Phase 3 Plan

## Goal

Use the confirmed Polsia structure to converge runtime surfaces and route boundaries without starting a broad file migration.

## Scope

- Add a Polsia-aligned DB adapter seam around the current `pg` pool
- Identify which routes belong in the web-core slice and which remain optional/deferred
- Reduce remaining deploy/runtime assumptions that still point at the old split-host model
- Keep all work inside `mint-apps/ai-notecards-polsia`

## Proposed tasks

1. Add a DB compatibility surface
   - Introduce a single server DB entrypoint that can become the future `server/db/index.js`
   - Keep `pg` and raw SQL, but document Neon-specific expectations clearly

2. Write a route compatibility inventory
   - Mark current routes as:
     - target-core
     - target-optional
     - target-deferred
   - Expect `auth`, `decks`, `study`, `generate`, `settings`, and marketplace browse/read to be closest to target-core
   - Expect `seller`, `stripe`, `revenuecat`, notifications, and some admin flows to remain optional or deferred

3. Prepare the copied app for final path migration
   - Identify the minimum import rewrite set needed when `server/src/*` eventually moves under `server/*`
   - Add only adapters or aliases that reduce later move-risk

4. Tighten unified deployment assumptions
   - Treat `render.yaml` as the primary deployment draft
   - Demote `client/vercel.json` to legacy compatibility and document its removal trigger

5. Re-verify the web-core run path
   - Once dependencies are available, verify root `build`, `start:render`, and `/api/health`

## Out of scope

- Broad folder moves
- Schema rewrites
- Stripe removal
- RevenueCat removal
- Mobile refactors
- UI redesign

## Exit criteria

- There is a documented DB entrypoint path that matches Polsia’s convention
- The route surface is classified into core vs deferred with exact file references
- The copied app can be described as “ready for phase 4 packaging/move work” without further architecture guessing
