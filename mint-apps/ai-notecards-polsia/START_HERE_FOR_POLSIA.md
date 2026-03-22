# Start Here For Polsia

This is the current handoff entry point for the AI Notecards Polsia sandbox.

Use this document first. It summarizes what this repo is, what is actually live in the handoff build, what is intentionally deferred, and what Polsia can safely work on now.

## What this repo is

`ai-notecards-polsia` is the refactor and handoff-prep copy of AI Notecards.

It preserves the current three-surface product:

- `client/`: React + Vite web app
- `server/`: Express + PostgreSQL backend
- `mobile/`: Expo / React Native iOS app

The current handoff shape is intentionally web-core first. The backend and deployment surfaces were stabilized first so Polsia can collaborate without taking ownership of the entire product at once.

## Current product and launch stance

What is strategically in scope:

- AI flashcard generation from text and photos
- deck CRUD and study flows
- iOS as a serious launch surface
- a real buyer-facing marketplace experience

What is currently active in the handoff build:

- web auth
- deck CRUD
- AI generation
- study flows
- marketplace browse
- marketplace listing detail

What is intentionally present as shell or placeholder behavior:

- `/api/stripe/*` returns placeholder billing responses
- marketplace purchase checkout returns a placeholder response
- seller routes and pages remain present but default to shell mode when seller tools are disabled
- admin routes and pages remain present but are not launch-ready production surfaces

What is still intentionally founder-owned or decision-sensitive:

- final iOS marketplace purchase stance
- Apple / RevenueCat production setup
- seller marketplace reintroduction timing
- legal, App Store review, and submission credentials

## What Polsia can work on now

Safe-now work:

- repo orientation and implementation audits
- web-core backend cleanup
- documentation and handoff materials
- route and contract verification
- launch-readiness analysis grounded in current repo truth
- deployment-shape work around the unified Express-serves-client model

Work that should stay founder-owned unless explicitly reassigned:

- App Store Connect operations
- Apple capability setup
- RevenueCat production configuration
- Stripe / seller payout reintroduction
- any work requiring real credentials or external account access

## What not to assume

Do not assume:

- seller tooling is part of v1 launch
- marketplace purchase flow on iOS is already settled
- web billing is live
- the mobile app is ready for blind ownership transfer
- older planning docs describe current runtime truth better than the current runtime files

## Primary source-of-truth files

Read these in this order:

1. [README.md](README.md)
2. [POLSIA_REFACTOR_PLAN.md](POLSIA_REFACTOR_PLAN.md)
3. [POLSIA_PORTING_NOTES.md](POLSIA_PORTING_NOTES.md)
4. [POLSIA_STRUCTURE_MAP.md](POLSIA_STRUCTURE_MAP.md)
5. [POLSIA_ROUTE_MATRIX.md](POLSIA_ROUTE_MATRIX.md)
6. [mobile-backend-contracts.md](docs/contracts/mobile-backend-contracts.md)
7. [mobile-api-runtime-contract.md](docs/contracts/mobile-api-runtime-contract.md)
8. [environment-manifest.md](docs/deployment/environment-manifest.md)
9. [verification-status.md](docs/handoff/verification-status.md)
10. [launch-scope-decision.md](docs/handoff/launch-scope-decision.md)
11. [execution-boundaries.md](docs/handoff/execution-boundaries.md)
12. [decision-log.md](docs/handoff/decision-log.md)
13. [secrets-access-scrub.md](docs/handoff/secrets-access-scrub.md)

Launch-planning context outside the repo:

- [2026-03-22-polsia-task-realignment.md](../ops/2026-03-22-polsia-task-realignment.md)
- [2026-03-22-ios-pre-flight-checklist.md](../ops/2026-03-22-ios-pre-flight-checklist.md)
- [2026-03-22-app-store-listing-copy.md](../ops/2026-03-22-app-store-listing-copy.md)
- [2026-03-21-aso-keyword-strategy.md](../ops/2026-03-21-aso-keyword-strategy.md)

## Current engineering collaboration point

The repo is now prepared for Polsia collaboration at the web-core handoff layer.

That means:

- active and deferred system boundaries are documented
- the mobile/backend contract is documented more concretely
- environment setup is documented
- verification status is documented
- launch-scope ambiguity is reduced

It does not mean:

- all optional systems are production-ready
- mobile monetization is fully settled
- seller tooling is launch-ready

## Fast orientation path

If time is limited, use this sequence:

1. read the launch-scope decision memo
2. read the execution boundaries
3. read the route matrix
4. read the mobile API runtime contract
5. read the verification and env docs

That sequence is enough to avoid the main misunderstandings that previously showed up in launch-planning output.
