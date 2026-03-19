# Atlas Start Here

This document is the fastest reliable orientation path for Atlas inside AI Notecards.

## Project Purpose

AI Notecards is an AI-powered flashcard product with a marketplace and a native iOS companion. Users can generate decks from notes or a topic, study across surfaces, and buy or sell decks in the marketplace.

## Current Stage

The project is in a launch-oriented stage with both product growth and release-hardening concerns active at the same time. Atlas should optimize for shipping quality, reliability, and minimal-risk improvements rather than architectural exploration.

## Product Surfaces

- `mobile/` — native mobile app built with Expo / React Native
- `client/` — web product built with React + Vite
- `server/` — Express API with PostgreSQL / Supabase production backend

## Atlas Ownership Bias

Atlas should begin with the mobile surface and only widen scope when the mobile app depends on backend or contract changes.

Primary ownership bias:
- iOS product quality
- mobile UX and behavior
- offline study flows
- app environment and release config
- App Store / review-sensitive implementation details

## How To Run Mobile Locally

From `ai-notecards/` repo root:

```bash
npm run app
```

Useful related commands:

```bash
npm run app:ios:simulator
npm run app:ios:device
npm run app:ios:preview
npm run app:ios:production
npm run inspect:ios:config
```

Inside `mobile/`, the app uses a custom Expo dev client workflow rather than an Expo Go-only flow.

## Read These First

1. `README.md`
2. `CLAUDE.md`
3. `AGENTS.md`
4. `docs/contracts/mobile-backend-contracts.md`
5. `docs/agent-priorities/current-mobile-priorities.md`
6. `mobile/app.config.js`
7. `mobile/package.json`
8. root `package.json`

## Important Folders And Files

- `mobile/` — primary Atlas surface
- `mobile/app.config.js` — environment-specific app identity and plugin setup
- `mobile/package.json` — mobile commands and build profiles
- `server/src/routes/` — API contract surfaces mobile may depend on
- `server/src/services/` — backend implementation details that can affect mobile behavior
- `server/src/db/migrations/` — schema changes and data-contract evolution
- `README.md` — setup, local workflow, deployment assumptions
- `CLAUDE.md` — project structure, routes, conventions, product/system context

## Known Risk Areas

- offline study sync correctness
- auth and session continuity
- environment-specific bundle identity and capabilities
- subscription and entitlement behavior
- marketplace purchase behavior and purchased-deck access
- backend contract drift between mobile assumptions and API reality
- reviewer-sensitive iOS capabilities and production-only integrations

## Rules For Cross-Layer Changes

- Do not change backend contracts casually.
- Prefer mobile-only fixes when they are safe and do not create long-term product debt.
- If backend contract changes are necessary, document them in `docs/contracts/mobile-backend-contracts.md`.
- If a migration or route behavior changes, update both code and docs together.
- Call out breaking changes explicitly.

## What Mobile Currently Supports

At minimum, Atlas should assume the mobile app is intended to support:
- authenticated study use cases
- local/offline study behavior
- environment-specific app identity
- launch-oriented iOS workflows

Atlas should verify exact feature coverage in code before claiming parity with web.

## What Mobile Should Not Assume

- Do not assume every web feature is fully owned by mobile.
- Do not assume undocumented backend behavior is stable.
- Do not assume production capabilities should be enabled in local simulator flows.
- Do not assume launch readiness without checking auth, offline behavior, and environment correctness.

## What “Done” Means For Mobile Work

A change is closer to done when:
- the user-facing behavior is clear and stable
- edge cases are handled thoughtfully
- environment assumptions are correct
- offline behavior is not made less trustworthy
- cross-layer dependencies are documented
- the repo is clearer after the change than before it

## Default Posture

Atlas should be a scoped execution specialist, not a free-roaming repo agent. Start narrow, read first, change carefully, and document contract-sensitive work.
