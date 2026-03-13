# Trade Journal

Mobile-first trade journaling app for active crypto/stock/options traders.

## Tech Stack
- React Native + Expo SDK 55 (managed workflow)
- Expo Router v4 (file-based routing)
- Supabase (Postgres + Auth + Storage)
- TanStack Query v5 (server state + cache persistence)
- React Hook Form + Zod (forms + validation)
- Theme system with 5 styles (classic, modern, ios_glass, android_material, high_contrast) and 6 palettes
- Vitest (unit tests for business logic)
- RevenueCat (subscriptions)

## Project Structure
- `app/` — Expo Router screens (file-based routing)
- `src/components/` — Reusable UI components (flat, no subdirs)
- `src/hooks/` — Custom hooks (auth, trades, images, strategies)
- `src/lib/` — Infrastructure (supabase, query-client, mmkv, theme-system)
- `src/types/` — Zod schemas, DB types, query keys (trades, strategies, common)
- `src/utils/` — Pure utility functions (pnl calc, formatting, strategy payloads/queries)
- `supabase/` — Migrations, config, seed data
- `__tests__/unit/` — Unit tests
- `__tests__/integration/` — Integration tests
- `.maestro/flows/` — Smoke E2E flows for Lane C
- `docs/feature-briefs/` — Required feature intake briefs
- `docs/feature-process/` — Integration framework and release checklists

## Conventions
- Zod schemas are source of truth for types (use z.infer)
- PnL is computed in app code, stored in DB for fast aggregation
- Strategies link to trades via `trade_strategies` join table
- Tags (setup_tags, mistake_tags) stored as text[] arrays on trades
- Images: compress before upload (1200px, quality 0.8)
- Auth tokens: MMKV + SecureStore hybrid (SecureStore has 2048-byte limit)
- Path alias: `@/*` maps to `src/*`

## Commands
- `nvm use` — Use Node version from `.nvmrc` (22)
- `npm start` — Start Expo dev server
- `npm test` — Run full Vitest suite
- `npm run test:unit` — Unit tests
- `npm run test:integration` — Integration tests
- `npm run test:smoke` — Maestro smoke flow (Lane C)
- `npm run typecheck` — TypeScript type check
- `npm run verify:baseline` — Unit + integration + typecheck + lint
- `npm run verify:lane:a` — Lane A automated checks
- `npm run verify:lane:b` — Lane B automated checks
- `npm run verify:lane:c` — Lane C automated checks

## Rules
- Never store `service_role` key in client code
- Never use `float` for financial values — use NUMERIC in DB, precise rounding in app
- All Supabase tables must have RLS enabled
- Max file size: 200 lines per file, split if larger
- No speculative abstractions — build only what's needed now
- Every feature must start with a brief in `docs/feature-briefs/`
- Every feature PR must declare risk lane: A, B, or C
- Lane C requires smoke evidence + rollback plan + human sign-off

## AI Output Contract
Every feature implementation summary must include:
- impacted files
- lane classification and rationale
- required gate list and pass/fail status
- verification command results
- residual risks/deferred work
- explicit human sign-off checklist
