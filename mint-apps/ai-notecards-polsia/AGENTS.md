# AGENTS.md

This file defines how Atlas should operate in `apps/ai-notecards/`.

## Repo Context

AI Notecards lives inside the parent `apps/` monorepo. Atlas should treat `ai-notecards/` as its working product unless explicitly asked to do otherwise.

Primary surfaces already present in this project:
- `mobile/` — Expo / React Native iOS app
- `client/` — React + Vite web app
- `server/` — Express + PostgreSQL backend
- `docs/` — handoff, priorities, and contract documentation

Read these first before making changes:
1. `README.md`
2. `CLAUDE.md`
3. `docs/agent-handoff/atlas-start-here.md`
4. `docs/contracts/mobile-backend-contracts.md`
5. `docs/agent-priorities/current-mobile-priorities.md`

## Primary Scope

Atlas is primarily responsible for:
- `mobile/`
- mobile configuration, environment, and release surfaces
- iOS-specific product quality, launch readiness, and offline behavior

Atlas may inspect and make scoped changes in these areas when mobile work requires it:
- `server/src/routes/`
- `server/src/services/`
- `server/src/db/migrations/`
- shared documentation under `docs/`

Atlas should avoid broad changes outside AI Notecards and should not roam the wider monorepo unless explicitly asked.

## Working Rules

- Prefer small, targeted, reversible changes.
- Preserve existing naming, structure, and conventions unless there is a strong reason to change them.
- Do not do broad refactors, renames, or reorganizations without explicit approval.
- Before changing backend behavior for mobile, first check whether the problem can be solved safely at the mobile layer.
- When backend contract changes are necessary, update the relevant contract docs in the same body of work.
- Treat offline sync, auth, purchases, entitlements, and environment-specific identity as high-risk areas.
- Be explicit about uncertainty, partial completion, and follow-up verification needs.

## Repo-Specific Guidance

- The mobile app is a custom Expo dev client app, not an Expo Go-only app.
- Local mobile development is coordinated from the AI Notecards repo root.
- Root scripts include `npm run app`, `npm run app:ios:simulator`, `npm run app:ios:device`, `npm run app:ios:preview`, and `npm run app:ios:production`.
- The mobile app defines separate `development`, `preview`, and `production` environments.
- Environment-specific app identity lives in `mobile/app.config.js`.
- Offline study is a first-class product and architecture concern, not a side feature.

## What To Check Before Editing

For mobile work, inspect these areas first when relevant:
- `mobile/app/`
- `mobile/components/`
- `mobile/lib/`
- `mobile/app.config.js`
- `mobile/package.json`
- root `package.json`
- relevant API routes in `server/src/routes/`
- relevant services in `server/src/services/`
- relevant SQL migrations in `server/src/db/migrations/`

Also read any nearby docs before changing cross-layer behavior.

## Documentation Expectations

After meaningful work, Atlas should keep the repo legible by updating or adding docs when needed, especially when changing:
- mobile/backend contracts
- environment behavior
- auth expectations
- purchase or entitlement flows
- offline sync behavior
- release or reviewer-sensitive behavior

## Approval Boundaries

Get explicit approval before:
- changing pricing or plan logic
- changing marketplace business rules
- changing auth flows in a user-visible way
- changing purchase fulfillment behavior
- renaming major folders or moving large parts of the repo
- introducing major dependencies or architecture shifts

## Definition of Good Work

Good work is:
- scoped
- evidence-based
- safe for launch
- documented when cross-layer behavior changes
- honest about risks, tradeoffs, and unknowns
