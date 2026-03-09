# Trade Journal

Mobile-first trade journaling app for active crypto/stock/options traders.

## Tech Stack
- React Native + Expo SDK 55 (managed workflow)
- Expo Router v4 (file-based routing)
- Supabase (Postgres + Auth + Storage)
- TanStack Query v5 (server state + cache persistence)
- React Hook Form + Zod (forms + validation)
- StyleSheet + theme.ts (styling)
- Vitest (unit tests for business logic)

## Project Structure
- `app/` — Expo Router screens (file-based routing)
- `src/components/` — Reusable UI components (flat, no subdirs)
- `src/hooks/` — Custom hooks (auth, trades, images)
- `src/lib/` — Infrastructure (supabase, query-client, mmkv, theme)
- `src/types/` — Zod schemas, DB types, query keys
- `src/utils/` — Pure utility functions (pnl calc, formatting)
- `supabase/` — Migrations, config, seed data
- `__tests__/` — Unit tests for business logic only

## Conventions
- Zod schemas are source of truth for types (use z.infer)
- PnL is computed in app code, stored in DB for fast aggregation
- Tags stored as text[] arrays on trades (no join table)
- Images: compress before upload (1200px, quality 0.8)
- Auth tokens: MMKV + SecureStore hybrid (SecureStore has 2048-byte limit)
- Path alias: `@/*` maps to `src/*`

## Commands
- `npm start` — Start Expo dev server
- `npm test` — Run unit tests (vitest)
- `npm run typecheck` — TypeScript type check

## Rules
- Never store `service_role` key in client code
- Never use `float` for financial values — use NUMERIC in DB, precise rounding in app
- All Supabase tables must have RLS enabled
- Max file size: 200 lines per file, split if larger
- No speculative abstractions — build only what's needed now
