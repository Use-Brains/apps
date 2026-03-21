# Polsia First Pass Checklist

## Safe to do now

- Keep all work confined to `mint-apps/ai-notecards-polsia`
- Centralize runtime/env parsing in `server/src/config/runtime.js`
- Keep expanding the storage adapter instead of building provider URLs in routes
- Make web client API origin env-driven
- Add feature flags for seller tools, native billing, native auth sessions, and push notifications
- Update Polsia prep docs with exact file-level blockers and migration phases

## Wait until the real Polsia repo structure exists

- Moving files to a unified `mintapps/server` + `mintapps/client` structure
- Reworking the root package layout
- Adding `render.yaml` tied to the final service topology
- Converting frontend static serving to the final production shape
- Renaming product/app identifiers to match the eventual Polsia integration target

## Stay out of scope for now

- Rewriting auth from scratch
- Rewriting the database schema from first principles
- Rewriting Stripe/Connect commerce flows
- Refactoring the native iOS app for parity
- Porting RevenueCat, offline sync, notifications, or deep links first
- Broad UI redesign or page reorganization
