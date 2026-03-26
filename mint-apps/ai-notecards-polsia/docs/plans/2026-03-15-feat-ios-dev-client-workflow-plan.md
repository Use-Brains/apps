# iOS Dev Client Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert `ai-notecards/mobile` from an ad hoc local iOS build flow into a structured Expo dev-client and EAS workflow with environment-specific app identity and a root-level launch command.

**Architecture:** Keep the mobile app Expo-managed, move app identity into dynamic Expo config, define explicit EAS profiles for development/preview/production, and add root orchestration scripts only after the build workflow is stable. Avoid committing to long-term native project ownership unless native customization becomes a sustained need.

**Tech Stack:** Expo SDK 55, Expo Router, EAS Build, Node.js scripts, npm workspaces-style root scripting, iOS simulator/dev client, Xcode for local native toolchain.

---

### Task 1: Audit and normalize current mobile app identity inputs

**Files:**
- Modify: `mobile/app.json`
- Modify: `mobile/eas.json`
- Inspect: `mobile/package.json`

**Step 1: Write the failing test**

Document a configuration contract test target:
- development config must not use the production bundle identifier
- preview and production profiles must be explicitly named
- EAS project metadata must not be blank

**Step 2: Run test to verify it fails**

Run: `node -e "const cfg=require('./mobile/app.json'); if (cfg.expo.extra?.eas?.projectId) process.exit(0); process.exit(1)"`
Expected: FAIL because project ID is blank.

**Step 3: Write minimal implementation**

- Replace static config with a dynamic config file in a later task.
- Update `eas.json` profile naming and expectations to match the new environment model.

**Step 4: Run test to verify it passes**

Run a config inspection command against the new config.
Expected: all environments resolve explicit bundle IDs and EAS metadata.

**Step 5: Commit**

```bash
git add mobile/app.* mobile/eas.json
git commit -m "chore: define ios app identity environments"
```

### Task 2: Introduce dynamic Expo config

**Files:**
- Create: `mobile/app.config.js`
- Remove or minimize: `mobile/app.json`
- Create: `mobile/.env.example` updates if needed

**Step 1: Write the failing test**

Create a config inspection script or command that asserts:
- `APP_ENV=development` resolves a development bundle ID
- `APP_ENV=preview` resolves a preview bundle ID
- `APP_ENV=production` resolves `com.ainotecards.app`

**Step 2: Run test to verify it fails**

Run environment-specific config reads before implementation.
Expected: FAIL because static config cannot vary by environment.

**Step 3: Write minimal implementation**

Implement `app.config.js` to derive:
- app name suffix
- bundle identifier
- associated domains
- Apple Sign In enablement
- EAS project ID
- optional public runtime config values

**Step 4: Run test to verify it passes**

Run config inspection for all environments.
Expected: PASS for all three.

**Step 5: Commit**

```bash
git add mobile/app.config.js mobile/app.json mobile/.env.example
git commit -m "feat: add dynamic expo app config"
```

### Task 3: Define supported EAS build profiles

**Files:**
- Modify: `mobile/eas.json`
- Modify: `mobile/package.json`

**Step 1: Write the failing test**

Define expected profiles:
- `development-simulator`
- `development-device`
- `preview`
- `production`

**Step 2: Run test to verify it fails**

Run a JSON validation command that checks for all profile names.
Expected: FAIL because `development-device` is missing and profile behavior is underspecified.

**Step 3: Write minimal implementation**

Add explicit EAS profiles and package scripts for:
- simulator dev build
- device dev build
- starting Metro in dev-client mode

**Step 4: Run test to verify it passes**

Run the same validation command.
Expected: PASS.

**Step 5: Commit**

```bash
git add mobile/eas.json mobile/package.json
git commit -m "chore: standardize eas development profiles"
```

### Task 4: Add root-level orchestration scripts

**Files:**
- Create: `package.json`
- Create: `scripts/app.mjs`
- Modify: `README.md`

**Step 1: Write the failing test**

Define the desired root command contract:
- `npm run app` from repo root starts the supported local workflow
- it verifies prerequisites and surfaces actionable errors

**Step 2: Run test to verify it fails**

Run: `cd /repo/ai-notecards && npm run app`
Expected: FAIL because no root script exists.

**Step 3: Write minimal implementation**

Add a root package manifest and orchestration script that:
- checks for mobile/server dependencies
- starts the backend dev server
- starts Metro in dev-client mode
- prints the correct next-step instruction for installing or launching the simulator dev build

**Step 4: Run test to verify it passes**

Run: `npm run app`
Expected: PASS with backend + Metro workflow starting successfully.

**Step 5: Commit**

```bash
git add package.json scripts/app.mjs README.md
git commit -m "feat: add root local app workflow"
```

### Task 5: Document the official iOS development lifecycle

**Files:**
- Modify: `README.md`
- Modify: `mobile/CLAUDE.md`

**Step 1: Write the failing test**

Define required documentation sections:
- local simulator setup
- local device setup
- dev build install/update flow
- preview and production build flow

**Step 2: Run test to verify it fails**

Manually inspect docs.
Expected: FAIL because the current instructions are incomplete and mix Expo Go with native-dev assumptions.

**Step 3: Write minimal implementation**

Document:
- first-time machine setup
- simulator build install command
- Metro start command
- root command usage
- when to use EAS vs local Xcode

**Step 4: Run test to verify it passes**

Manual review of docs for completeness and consistency.
Expected: PASS.

**Step 5: Commit**

```bash
git add README.md mobile/CLAUDE.md
git commit -m "docs: document ios dev client workflow"
```

### Task 6: Verify the full local development workflow

**Files:**
- Verify only: `mobile/app.config.js`
- Verify only: `mobile/eas.json`
- Verify only: `package.json`
- Verify only: `scripts/app.mjs`

**Step 1: Write the failing test**

Define end-to-end verification targets:
- config resolves for development
- root command starts supported services
- Metro starts in dev-client mode
- simulator build command is discoverable and documented

**Step 2: Run test to verify it fails**

Run each verification before the final fix set is complete.
Expected: one or more failures.

**Step 3: Write minimal implementation**

Apply only the final fixes needed to make the workflow coherent.

**Step 4: Run test to verify it passes**

Run:
- `node --input-type=module -e "import('./mobile/app.config.js').then(() => console.log('ok'))"`
- `cd mobile && npm run start -- --dev-client --offline`
- `cd /repo/ai-notecards && npm run app`

Expected: commands start cleanly or fail only with documented external prerequisites.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: verify ios dev client workflow"
```
