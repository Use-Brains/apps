---
status: pending
priority: p2
issue_id: "061"
tags: [code-review, mobile, dependencies, setup]
dependencies: ["058"]
---

# expo-crypto Not in package.json — Must Install via npx expo install

## Problem Statement

The plan prescribes using `expo-crypto` for CSPRNG key generation (todo 058) but `expo-crypto` is not in `mobile/package.json`'s dependencies. Installing with `npm install expo-crypto` would get the latest npm version, which may not be compatible with Expo SDK 55. Expo packages must be installed via `npx expo install` to get the SDK-pinned compatible version.

## Findings

- **Architecture Strategist (Review Round 3):** P2-D — `expo-crypto` absent from `package.json`; `npx expo install` required

Affected: `mobile/package.json`

## Proposed Solutions

### Option A: Install via Expo CLI (Required)

```bash
cd apps/ai-notecards/mobile
npx expo install expo-crypto
```

This automatically resolves the version compatible with Expo SDK 55 and adds it to `package.json`.

**Pros:** Correct version pinned automatically; the Expo way
**Cons:** None
**Effort:** Trivial
**Risk:** None

## Acceptance Criteria

- [ ] `expo-crypto` added to `mobile/package.json` dependencies via `npx expo install expo-crypto`
- [ ] Version is compatible with Expo SDK 55 (the command handles this automatically)
- [ ] `import * as Crypto from 'expo-crypto'` resolves without error in `mmkv.ts`
