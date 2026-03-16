# iOS Dev Client Workflow Design

**Date:** 2026-03-15

**Goal:** Establish a durable iOS development workflow for `ai-notecards/mobile` that supports local simulator testing, physical-device testing, and a clean path to future TestFlight and App Store deployment.

## Decision

Adopt an Expo custom dev client workflow backed by EAS-managed app identity and build profiles.

## Why This Direction

- `ai-notecards` already depends on native iOS capabilities and native modules, including Apple Sign In, notifications, secure storage, SQLite, Google Sign-In, and RevenueCat-related native libraries.
- Expo Go is not a durable primary workflow for this app class.
- Local `expo run:ios` against a production-shaped bundle identifier and production-only capabilities creates unnecessary signing friction.
- EAS-managed identities and environment-specific app config align local development with how the app will be tested and shipped.

## Design

### 1. Dynamic Expo App Config

Replace static `mobile/app.json` with dynamic Expo config so iOS bundle identifiers, display names, app scheme details, EAS project metadata, and optional capabilities can vary by environment.

### 2. Environment Separation

Define three app environments:

- `development`
  - Local simulator and local device dev builds
  - Safe non-production bundle identifier
  - Local-friendly capability set
- `preview`
  - Internal QA / pre-release builds
  - Production-like capabilities enabled
- `production`
  - Final App Store identity and capabilities

### 3. EAS as the Primary Build Surface

Use `eas.json` profiles as the supported build entrypoints for:

- simulator dev build
- device dev build
- preview build
- production build

### 4. Local Developer Workflow

The supported local flow becomes:

1. install dependencies
2. ensure backend is running
3. install a simulator or device dev build
4. start Metro with dev-client mode
5. launch the installed development app

### 5. Capability Management

Production-only capabilities should not block routine local development. Capability configuration should be explicit, environment-aware, and documented.

### 6. Root Developer Command

After the workflow is correct, expose a root `npm run app` command from `ai-notecards/` that orchestrates the supported local development flow instead of bypassing it.

## Expected Outcomes

- Local simulator testing stops depending on ad hoc Xcode behavior.
- Device testing follows the same app identity model used for release.
- TestFlight and App Store deployment become an extension of the same workflow.
- Root commands become simpler because they sit on top of a correct build model.
