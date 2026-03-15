---
status: pending
priority: p1
issue_id: "059"
tags: [code-review, typescript, mobile, auth, type-safety]
dependencies: []
---

# User Type Unification Is Must-Fix, Not Should-Fix

## Problem Statement

The plan lists User type unification as "Should Fix." It should be **Must Fix**. `auth.tsx` has an inline 7-field User type with `plan: string` and 6 missing fields. `types/api.ts` has a 14-field User type with `plan: 'free'|'trial'|'pro'`. Brainstorm #2 will write plan-gated auth screens on day one — every conditional on `user.plan` will silently accept invalid values without the type fix.

Two additional issues the plan does not address:

**Issue 1 — Three unsafe `as` casts survive unification.** After importing the canonical User, the three `as { user: User }` casts in `auth.tsx` (lines 34, 46, 52) still compile. They will silently accept API responses that are missing fields. Any component reading `user.sellerTermsAccepted` (needed for seller gate) or `user.trialEndsAt` (needed for upgrade prompt) will get `undefined` instead of a type error. The plan defers fixing these casts — that is wrong for `api.me()` specifically, which is called on every mount and drives auth state.

**Issue 2 — `displayName: string | null` will produce strict-mode compile errors at call sites.** The canonical User has `displayName: string | null`. Any screen rendering `user.displayName` directly (greeting text, profile header) will fail to compile under `strict: true` after unification. These sites must be null-guarded.

## Findings

- **TypeScript Reviewer (Review Round 3):** P1-A — three unsafe casts in auth.tsx will survive unification and carry malformed state
- **TypeScript Reviewer (Review Round 3):** P1-B — `displayName: string | null` will cause strict-mode compile errors at call sites
- **Architecture Strategist (Review Round 3):** P2-B — 6 missing fields (longestStreak, trialEndsAt, sellerTermsAccepted, stripeConnectId, stripeConnectOnboarded, createdAt) cause runtime `undefined` for seller flow
- **Simplicity Reviewer (Review Round 3):** confirms User type unification is Must Fix, not Should Fix

Affected: `mobile/src/lib/auth.tsx` lines 4–12, 34, 46, 52

## Proposed Solutions

### Option A: Import canonical type + run tsc to find call site errors (Recommended)

1. Delete inline User type in `auth.tsx` (lines 4–12)
2. Add `import type { User } from '../types/api';`
3. Run `npx tsc --noEmit` — fix every compile error that surfaces (these are real bugs, not regressions)
4. For the three `as` casts: widen to `api.me<{ user: User }>()` at minimum, noting that full Zod validation is deferred to brainstorm #2

**Pros:** Catches all 6 missing-field access sites before runtime; unblocks brainstorm #2; one import + delete
**Cons:** Will surface compile errors at call sites (intended — they are real bugs)
**Effort:** Small
**Risk:** None — surfacing errors is the goal

## Acceptance Criteria

- [ ] Inline 7-field User type removed from `auth.tsx`
- [ ] `auth.tsx` imports User from `../types/api`
- [ ] `npx tsc --noEmit` passes with zero errors after change
- [ ] Every `user.displayName` render site null-guarded
- [ ] Three `as` casts updated to typed generic calls (minimum: `as { user: User }` with correct import)
