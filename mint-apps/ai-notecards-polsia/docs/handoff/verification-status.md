# Verification Status

Last updated: 2026-03-22

This document records what is currently verified in the Polsia sandbox and what is still assumed, blocked, placeholder-only, or unverified.

## Commands run

Verified in this sandbox:

```bash
npm run build
```

Previously verified in the sandbox docs:

```bash
npm --prefix server ci
npm --prefix client ci
npm --prefix server test -- config/runtime.test.js routes/marketplace.test.js routes/seller.test.js
npm --prefix client run build
```

Attempted here but limited by sandbox permissions:

```bash
npm run test:server
```

## What currently passes

- root web build through `npm run build`
- client production build into `client/dist`
- current top-level route/runtime packaging imports cleanly after the Phase 4 cleanup

## What currently fails or is blocked

- full `npm run test:server` is not fully verifiable in this sandbox because some route tests attempt to bind sockets and hit `listen EPERM: operation not permitted 0.0.0.0`

Interpretation:

- this is an environment limitation in the current sandbox
- it is not evidence that the route logic is broken
- it is also not a substitute for a real local test pass on a machine with normal socket permissions

## What is intentionally placeholder

- `POST /api/stripe/checkout`
- `POST /api/stripe/cancel`
- `POST /api/stripe/portal`
- `POST /api/stripe/webhook`
- `POST /api/marketplace/:id/purchase`
- seller flows when `FEATURE_SELLER_TOOLS=false`
- admin surfaces in the handoff build

## What remains unverified here

- `npm run setup:handoff` against a real Postgres database
- `npm run start` against a real database and browser session
- local end-to-end auth flows on a real running backend
- mobile end-to-end auth/session flows
- RevenueCat package loading and reconcile flow
- Apple Sign In on device
- push notification registration on device
- offline study sync on device
- preview and production EAS build pipeline execution

## What should be verified next on a real machine

1. `npm run setup:handoff`
2. `npm run start`
3. browser test of auth, deck CRUD, generation, study, marketplace browse/detail
4. mobile preview build against a stable backend
5. RevenueCat restore and reconcile
6. offline study sync

## Confidence summary

High confidence:

- current repo structure
- route classification
- runtime flag surfaces
- web build path

Medium confidence:

- handoff boot path, pending real database verification
- current marketplace browse/detail backend behavior

Low confidence until re-verified on-device:

- iOS auth production readiness
- RevenueCat production readiness
- final launch purchase behavior for marketplace decks
