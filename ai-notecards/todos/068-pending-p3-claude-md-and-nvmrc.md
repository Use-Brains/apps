---
status: pending
priority: p3
issue_id: "068"
tags: [code-review, mobile, documentation, dx]
dependencies: []
---

# CLAUDE.md Should Be 6 Sections (Not 11) + Add .nvmrc

## Problem Statement

The plan's CLAUDE.md outline has 11 sections, which is too detailed for a pre-feature scaffold. `apps/trade-journal/CLAUDE.md` has 6 top-level sections. Three of the plan's proposed sections add noise without agent value:

- **Section 9 (TypeScript Rules)** — restates type fixes that will already be done; no ongoing value
- **Section 11 (AI Output Contract)** — "no Zustand, no Redux" belongs in workspace CLAUDE.md, not per-app CLAUDE.md; over-specifying negatives
- **Section 6 (TanStack Query internals)** — staleTime/gcTime values and dehydrateOptions specifics are implementation details, not agent guidance; compress to 1–2 lines

Additionally, `apps/trade-journal/` has a `.nvmrc` file pinning Node to `22`. `mobile/` has `"node": ">=20.19.4"` in `package.json` engines but no `.nvmrc`. This means `nvm use` does nothing in this directory, creating version inconsistency in the workspace.

## Findings

- **Simplicity Reviewer (Review Round 3):** confirms 6-7 sections, not 11; cut TypeScript Rules, AI Output Contract, compress TanStack internals
- **Pattern Recognition Specialist (Review Round 3):** Medium — `.nvmrc` present in trade-journal with value `22`; absent in mobile project

Affected: `mobile/CLAUDE.md` (to be created), `mobile/.nvmrc` (to be created)

## Proposed Solutions

### Option A: 6-section CLAUDE.md + .nvmrc (Recommended)

**Target CLAUDE.md sections:**
1. **Stack** — one sentence per technology
2. **Provider Hierarchy** — `ThemeProvider > ErrorBoundary > PersistQueryClientProvider > AuthProvider > AuthGate > Slot` with ordering rationale
3. **Expo Router v4 Notes** — `router.navigate()` always pushes; use `router.dismissTo()` for back-navigation; auth group is `(auth)/`, tabs are `(tabs)/`
4. **API Client Pattern** — Bearer token, not cookies; `BASE_URL` from `EXPO_PUBLIC_API_URL`; methods return `Promise<unknown>`, typed per-feature
5. **Storage Layers** — MMKV = non-sensitive (theme prefs, query cache); SecureStore = tokens only (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); query cache allowlist: decks, marketplace, study only
6. **Commands** — `npx expo start`, `npx expo start --ios`, `npx expo start --go`

**`.nvmrc`:** single line: `22`

**Pros:** Matches trade-journal pattern length; focused on what agents need to avoid mistakes; no stale implementation details
**Cons:** Less comprehensive than 11 sections
**Effort:** Small
**Risk:** None

## Acceptance Criteria

- [ ] `mobile/CLAUDE.md` created with 6 top-level sections matching the outline above
- [ ] No TypeScript Rules section (type fixes are done, not ongoing rules)
- [ ] No AI Output Contract section
- [ ] TanStack Query compressed to ≤3 lines of agent guidance
- [ ] `mobile/.nvmrc` created with content `22`
- [ ] All commands in CLAUDE.md verified to work from the `mobile/` directory
