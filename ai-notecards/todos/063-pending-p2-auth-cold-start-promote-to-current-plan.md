---
status: pending
priority: p2
issue_id: "063"
tags: [code-review, mobile, auth, performance, ux]
dependencies: ["056", "059"]
---

# Auth Cold-Start Spinner Should Be Fixed Now, Not Deferred to Brainstorm #5

## Problem Statement

`AuthProvider` initializes with `loading: true` and only sets it to `false` after `api.me()` completes or throws. `AuthGate` renders a full-screen `ActivityIndicator` while `loading` is true. Every app open — not just first install — shows a blank spinner until the server round-trip resolves (100–300ms on good network; several seconds on bad network with 2 retries).

The plan defers this to "Brainstorm #5 (polish)." The performance agent recommends promoting it to the current plan: `AuthProvider` is a clean shell right now, before brainstorm #2 adds auth screens. Adding optimistic MMKV hydration now is simpler than retrofitting it after additional state handling is added.

The fix: on mount, synchronously read a cached `user` object from MMKV and initialize `loading: false` immediately. Kick off `api.me()` in the background to verify freshness and update state if the user changed (plan upgrade, account deletion). The spinner only appears on first install (no cached state) or after explicit logout.

## Findings

- **Performance Oracle (Review Round 3):** P2 — promotes from brainstorm #5; AuthProvider is clean shell now; harder to retrofit later
- **Architecture Strategist (Review Round 3):** P1-C — dual state (AuthProvider + TanStack Query) is a correctness risk; optimistic hydration would reduce the race window

Affected: `mobile/src/lib/auth.tsx`, `mobile/src/lib/mmkv.ts`

## Proposed Solutions

### Option A: MMKV-backed optimistic user hydration (Recommended)

```typescript
const USER_CACHE_KEY = 'cached-user';

// On successful api.me(), also write to MMKV:
storage.set(USER_CACHE_KEY, JSON.stringify(user));

// In AuthProvider initial state:
const cachedUserJson = storage.getString(USER_CACHE_KEY);
const cachedUser = cachedUserJson ? JSON.parse(cachedUserJson) as User : null;

const [user, setUser] = useState<User | null>(cachedUser);
const [loading, setLoading] = useState(cachedUser === null);  // only show spinner on first install
```

Background verification then updates state if the server response differs.

**Pros:** Eliminates spinner on every app open after first install; architecturally simpler to add now than post-brainstorm #2; reduces server load on cold start
**Cons:** Slightly more complex AuthProvider initialization
**Effort:** Small
**Risk:** Low — optimistic state is immediately overwritten by verified server state

### Option B: Keep current deferred status

Accept spinner on every cold start. Fix in brainstorm #5.

**Cons:** Every user sees spinner on every open; harder to retrofit after auth screens added
**Effort:** None now; Medium in brainstorm #5
**Risk:** Medium — deferred complexity accumulates

## Acceptance Criteria

- [ ] `AuthProvider` initializes with cached `user` from MMKV if present (no spinner on warm starts)
- [ ] `AuthProvider` writes user to MMKV on every successful `api.me()` response
- [ ] `AuthProvider` clears MMKV cached user on logout
- [ ] First install (no cache) still shows spinner until `api.me()` resolves
- [ ] Network failure on background verify retains cached user state (does not log out)
