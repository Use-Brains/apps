---
status: pending
priority: p2
issue_id: "060"
tags: [code-review, mobile, tanstack-query, caching, security]
dependencies: []
---

# dehydrateOptions Filter Targets Non-Existent Query Keys

## Problem Statement

The plan's proposed `shouldDehydrateQuery` filter in `query-client.ts` blocks `'me'` and `'profile'` as root keys. Neither key exists in the TanStack Query cache:
- `'me'` is never a query key — `api.me()` is called imperatively inside `refreshUser`, not via `useQuery`
- `'profile'` root exclusion would incorrectly block `profileKeys.settings()` = `['profile', 'settings']`, which is user preferences (safe to persist offline)

The filter as written provides zero protection — it will never match any real query.

An allowlist (explicitly permit known-safe roots) is safer than a blocklist (attempt to deny sensitive roots). Future brainstorms adding new queries will be blocked until explicitly allowlisted, rather than silently persisting sensitive data.

## Findings

- **Performance Oracle (Review Round 3):** P2 — `'me'` key does not exist; `api.me()` is not in the query cache; filter matches nothing
- **Security Sentinel (Review Round 3):** P3 — `'profile'` exclusion over-broad; should use allowlist not blocklist
- **Architecture Strategist (Review Round 3):** P2-A — seller dashboard (`sellerKeys.dashboard()`) contains earnings data; also not protected by current filter

Affected: `mobile/src/lib/query-client.ts`

## Proposed Solutions

### Option A: Explicit allowlist (Recommended)

```typescript
const PERSISTABLE_ROOTS = new Set(['decks', 'marketplace', 'study']);

export const dehydrateOptions = {
  shouldDehydrateQuery: (query: Query) =>
    PERSISTABLE_ROOTS.has(query.queryKey[0] as string),
};
```

**Pros:** Default-deny; new queries require explicit allowlisting; future brainstorms can't accidentally persist sensitive data
**Cons:** Slightly more restrictive than necessary now (profile settings won't persist)
**Effort:** Small
**Risk:** Low

### Option B: Blocklist with corrected keys

Block `profileKeys.all[0]` = `'profile'` and `sellerKeys.all[0]` = `'seller'`. Remove the phantom `'me'` block.

**Pros:** Less restrictive for profile settings
**Cons:** Default-allow means future brainstorms can accidentally persist sensitive queries; ongoing maintenance burden
**Effort:** Small
**Risk:** Medium — easy to miss new sensitive query types

## Acceptance Criteria

- [ ] `shouldDehydrateQuery` uses an allowlist of known-safe query root keys
- [ ] `decks`, `marketplace`, `study` are explicitly permitted to persist
- [ ] `profile` and `seller` queries do not persist to MMKV
- [ ] `dehydrateOptions` exported from `query-client.ts` and passed to `PersistQueryClientProvider`
- [ ] CLAUDE.md documents the allowlist and instructs future brainstorms to add new roots explicitly
