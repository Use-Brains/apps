# Mobile Start Here

This document is the fastest repo-local orientation path for mobile-focused work inside AI Notecards.

Use it after [START_HERE_FOR_POLSIA.md](../../START_HERE_FOR_POLSIA.md) when the task is specifically about iOS behavior, mobile contracts, or release-sensitive app details.

## Current purpose

AI Notecards is a study product with three active surfaces:

- `mobile/` for the iOS app
- `client/` for the web app
- `server/` for the Express API

For current launch work, the mobile surface matters most for:

- auth and session continuity
- AI generation UX
- offline study behavior
- subscriptions and restore flow
- marketplace browse/detail behavior
- App Store and reviewer-sensitive implementation details

## Read these first

1. `START_HERE_FOR_POLSIA.md`
2. `README.md`
3. `docs/contracts/mobile-api-runtime-contract.md`
4. `docs/deployment/environment-manifest.md`
5. `docs/handoff/launch-scope-decision.md`
6. `mobile/app.config.js`
7. `mobile/package.json`
8. root `package.json`

## Important folders and files

- `mobile/app/(tabs)/generate.tsx` for the current AI generation entry point
- `mobile/src/lib/api.ts` for the mobile/backend contract surface
- `mobile/src/lib/auth.tsx` for native session and SecureStore behavior
- `mobile/src/lib/subscriptions.ts` for RevenueCat behavior
- `mobile/src/lib/offline/` for offline study and sync behavior
- `mobile/app.config.js` for environment-specific app identity
- `mobile/eas.json` for preview and production build profiles
- `server/routes/` for backend routes mobile depends on
- `server/routes/settings.js` for persisted user preferences

## Current risk areas

- auth and refresh-token continuity
- offline study sync correctness
- AI-generation review sensitivity and consent requirements
- RevenueCat restore and entitlement reconciliation
- marketplace purchase messaging on iOS
- environment-specific bundle ID and associated-domain correctness

## Rules for cross-layer changes

- Do not change mobile-facing backend contracts casually.
- Prefer mobile-only fixes when they solve the problem cleanly.
- If backend changes are necessary, update `docs/contracts/mobile-api-runtime-contract.md`.
- If a route, request shape, or response shape changes, update docs in the same pass.
- Call out launch-sensitive behavior changes explicitly.

## What mobile should not assume

- seller tooling is launch-ready
- marketplace purchase behavior is fully settled for iOS
- undocumented backend behavior is stable
- production-only capabilities should be enabled by default in local dev flows

## What done means for mobile work

- the user-facing behavior is clear and stable
- environment assumptions are correct
- offline or session trust is not weakened
- launch/review-sensitive implications are documented
- the repo is clearer after the change than before it
