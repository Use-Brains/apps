---
status: pending
priority: p3
issue_id: "067"
tags: [code-review, mobile, testing, dx]
dependencies: []
---

# vitest: Remove Scripts Definitively — Don't Add a Smoke Test

## Problem Statement

`mobile/package.json` has `test` and `test:unit` scripts that reference `vitest run __tests__/unit`, but there is no `__tests__/` directory and no `vitest.config.ts`. Running `npm test` fails.

The plan presents this as "remove scripts OR add vitest config + smoke test." That framing is wrong — the smoke test option is scope creep at this scaffold stage. `vitest` is already in devDependencies (install isn't free); `react-native-mmkv` v4 and `react-native-reanimated` require mock setup to not crash on import; creating `vitest.config.ts` + mocks + `__tests__/` + one test is ~5 files for zero brainstorm #2 value.

The right action: remove the two broken script entries from `package.json`. The `vitest` devDependency can stay for when tests are actually written. `npm test` should either not be present or be present and work.

## Findings

- **Simplicity Reviewer (Review Round 3):** confirms remove scripts; smoke test option is scope creep
- **TypeScript Reviewer (Review Round 3):** P3-B — "remove OR add" is not actionable; pick one
- **Architecture Strategist (Review Round 3):** P3-C — leaving phantom scripts creates false CI confidence

Affected: `mobile/package.json` lines 10–11

## Proposed Solutions

### Option A: Remove test scripts (Recommended)

Delete `"test"` and `"test:unit"` from `package.json` scripts. Keep `vitest` in devDependencies for future use.

```json
// Remove:
"test": "vitest",
"test:unit": "vitest run __tests__/unit",
```

**Pros:** `npm test` no longer fails; clean; no phantom scripts
**Cons:** No test runner configured (acceptable — tests are deferred)
**Effort:** Trivial
**Risk:** None

### Option B: Add vitest.config.ts + mocks + smoke test

Create `vitest.config.ts`, mock native modules, add `__tests__/unit/shuffle.test.ts`.

**Pros:** `npm test` works; one real test
**Cons:** 5 files; requires native module mocking; zero brainstorm #2 value; scope creep
**Effort:** Small-Medium
**Risk:** Low but unjustified for a scaffold

## Acceptance Criteria

- [ ] `npm test` does not appear in `package.json` scripts (or points to a working config)
- [ ] No `__tests__/unit` reference in scripts without a corresponding directory
- [ ] `vitest` devDependency retained for future test authoring
