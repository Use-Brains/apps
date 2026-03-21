---
status: pending
priority: p2
issue_id: "064"
tags: [code-review, mobile, git, security]
dependencies: []
---

# .gitignore Missing Security-Critical and Pattern-Inconsistent Entries

## Problem Statement

The plan's proposed `.gitignore` for `mobile/` is missing several entries present in `apps/trade-journal/.gitignore`, including two security-relevant signing artifact patterns.

**Security-relevant omissions:**
- `*.p8` — Apple APNs authentication key (pushed to git = anyone can send push notifications to the app)
- `*.p12` — Apple certificate export (pushed to git = signing identity compromise)

**Pattern inconsistencies vs trade-journal:**
- `ios/` and `android/` should be `/ios` and `/android` (root-anchored with leading slash, matching trade-journal exactly)
- Missing `*.tsbuildinfo` — TypeScript incremental build info
- Missing `npm-debug.*`, `yarn-debug.*`, `yarn-error.*` — debug log files
- Missing `*.orig.*` — merge conflict originals

## Findings

- **Pattern Recognition Specialist (Review Round 3):** High — `*.p8`, `*.p12` are Apple signing artifacts; security gap for iOS-focused app
- **Pattern Recognition Specialist (Review Round 3):** Medium — `ios/` → `/ios`, `android/` → `/android` root-anchor inconsistency with trade-journal

Affected: `mobile/.gitignore` (to be created)

## Proposed Solutions

### Option A: Add all missing entries to the plan's proposed content (Recommended)

Complete `.gitignore` content for `mobile/`:

```gitignore
# Expo
node_modules/
.expo/
dist/
web-build/
expo-env.d.ts

# Native build output (root-anchored, matching trade-journal)
/ios
/android
.kotlin/

# EAS
eas-build-local-nodejs/
credentials.json

# Environment
.env
.env.local
.env.*.local

# Metro
.metro-health-check*

# TypeScript
*.tsbuildinfo

# Debug logs
npm-debug.*
yarn-debug.*
yarn-error.*

# OS / signing artifacts
.DS_Store
*.jks
*.p8
*.p12
*.key
*.mobileprovision
*.orig.*
```

**Effort:** Trivial
**Risk:** None — gitignore additions are non-breaking

## Acceptance Criteria

- [ ] `mobile/.gitignore` created with all entries listed above
- [ ] `*.p8` and `*.p12` present (Apple signing artifacts)
- [ ] `/ios` and `/android` root-anchored (not `ios/` and `android/`)
- [ ] `*.tsbuildinfo` present
- [ ] Debug log patterns present
