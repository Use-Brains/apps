# Polsia First Pass Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prepare the copied AI Notecards app for Polsia collaboration by hardening runtime boundaries, abstracting storage, and isolating seller/native complexity without rewriting the product.

**Architecture:** Add a small server runtime/config layer, move storage behavior behind a provider-oriented service boundary, and make seller/native features explicitly flaggable while preserving current behavior by default. Keep the current folder structure and product logic intact; focus on containment, not reinvention.

**Tech Stack:** Express 4, Node.js ES modules, PostgreSQL via `pg`, React 19 + Vite, raw SQL migrations, node:test

---

### Task 1: Add runtime/config boundary

**Files:**
- Create: `server/src/config/runtime.js`
- Test: `server/src/config/runtime.test.js`
- Modify: `server/.env.example`

**Step 1: Write the failing test**

Write tests for:
- feature flag parsing with safe defaults
- storage config inference from env
- marketplace iOS purchase availability derived from config

**Step 2: Run test to verify it fails**

Run: `npm --prefix server test -- src/config/runtime.test.js`
Expected: FAIL because `server/src/config/runtime.js` does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- `getRuntimeConfig(env = process.env)`
- `getStorageConfig(env = process.env)`
- `getFeatureFlags(env = process.env)`
- `getMarketplacePurchaseAvailability(env = process.env)`

**Step 4: Run test to verify it passes**

Run: `npm --prefix server test -- src/config/runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/config/runtime.js server/src/config/runtime.test.js server/.env.example
git commit -m "refactor(polsia): add runtime config boundary"
```

### Task 2: Add storage abstraction boundary

**Files:**
- Modify: `server/src/services/storage.js`
- Modify: `server/src/routes/account.js`
- Modify: `server/src/routes/auth.js`
- Test: `server/src/services/storage.test.js`

**Step 1: Write the failing test**

Write tests for:
- public storage URL generation through the storage service
- avatar URL resolution using configured public base URL
- fallback behavior when storage is not configured

**Step 2: Run test to verify it fails**

Run: `npm --prefix server test -- src/services/storage.test.js`
Expected: FAIL because the new helper API does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- `buildPublicStorageUrl()`
- `resolveAvatarUrl()`
- provider-aware `uploadAvatar()` / `deleteAvatar()`
- route/auth call sites updated to use storage helpers instead of direct Supabase URL construction

**Step 4: Run test to verify it passes**

Run: `npm --prefix server test -- src/services/storage.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/services/storage.js server/src/services/storage.test.js server/src/routes/account.js server/src/routes/auth.js
git commit -m "refactor(polsia): abstract storage boundary"
```

### Task 3: Isolate seller/native features behind flags

**Files:**
- Modify: `server/src/routes/seller.js`
- Modify: `server/src/routes/revenuecat.js`
- Modify: `server/src/routes/auth.js`
- Modify: `server/src/routes/marketplace.js`

**Step 1: Write the failing test**

Write tests for:
- disabled seller tools return a consistent disabled response
- disabled native billing blocks RevenueCat endpoints
- marketplace iOS purchase availability is sourced from runtime config

**Step 2: Run test to verify it fails**

Run: `npm --prefix server test -- src/config/runtime.test.js`
Expected: FAIL on the missing feature-gate behavior.

**Step 3: Write minimal implementation**

Implement small route-level checks using runtime feature flags while keeping current behavior when flags are unset.

**Step 4: Run test to verify it passes**

Run: `npm --prefix server test -- src/config/runtime.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add server/src/routes/seller.js server/src/routes/revenuecat.js server/src/routes/auth.js server/src/routes/marketplace.js
git commit -m "refactor(polsia): gate seller and native features"
```

### Task 4: Decouple web API base assumptions

**Files:**
- Modify: `client/src/lib/api.js`
- Modify: `client/.env.example`
- Modify: `README.md`

**Step 1: Write the failing test**

Configuration-only task. No dedicated automated test added in this pass.

**Step 2: Verify the current assumption**

Inspect: `client/src/lib/api.js`
Expected: hard-coded `'/api'` base path.

**Step 3: Write minimal implementation**

Use `import.meta.env.VITE_API_URL ?? '/api'` so the copied app can run in split or unified deployment modes.

**Step 4: Run verification**

Run: `npm --prefix server test`
Expected: existing server tests still pass.

**Step 5: Commit**

```bash
git add client/src/lib/api.js client/.env.example README.md
git commit -m "refactor(polsia): make web api base env-driven"
```

### Task 5: Update Polsia prep documentation

**Files:**
- Modify: `POLSIA_REFACTOR_PLAN.md`
- Modify: `POLSIA_PORTING_NOTES.md`
- Create: `POLSIA_DELTA_MAP.md`
- Create: `POLSIA_FIRST_PASS_CHECKLIST.md`

**Step 1: Write the docs**

Capture:
- current architecture inventory
- blockers and delta map
- first-pass tasks safe now vs later
- exact boundary decisions for seller/native/storage/runtime

**Step 2: Verify completeness**

Re-read the user requirements and ensure each requested section/file is present.

**Step 3: Commit**

```bash
git add POLSIA_REFACTOR_PLAN.md POLSIA_PORTING_NOTES.md POLSIA_DELTA_MAP.md POLSIA_FIRST_PASS_CHECKLIST.md docs/plans/2026-03-20-polsia-first-pass-implementation-plan.md
git commit -m "docs(polsia): document first-pass refactor strategy"
```
