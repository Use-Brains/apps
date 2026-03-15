---
title: iOS Mobile Scaffold — Gap Fixes
type: feat
date: 2026-03-15
deepened: 2026-03-15
reviewed: 2026-03-15
---

# iOS Mobile Scaffold — Gap Fixes

## Enhancement Summary

**Deepened on:** 2026-03-15
**Reviewed on:** 2026-03-15
**Agents run:** TypeScript reviewer, security sentinel, architecture strategist, performance oracle, simplicity reviewer, best practices researcher, framework docs researcher, learnings researcher (8 total); then architecture strategist, security sentinel, TypeScript reviewer, simplicity reviewer, pattern recognition specialist, performance oracle (6 total)

### Key Improvements Discovered
1. **Server does not accept Bearer tokens** — `authenticate` middleware only reads cookies. `requireXHR` also blocks all mutations. The mobile app cannot communicate with the server as-is. Two-line server fix required before any mobile auth testing.
2. **API paths confirmed wrong** — all four paths in `api.ts` are wrong. Authoritative source is `server/src/index.js` + web client cross-reference. No "verify first" step needed.
3. **MMKV encryption key has two bugs** — `Math.random()` is not a CSPRNG (use `Crypto.randomUUID()`), and the catch path never persists the generated key (data-loss vector on next launch). Note: `getRandomBytesAsync` is async and breaks sync module init — use `randomUUID()` instead.
4. **User type must be Must Fix** — `auth.tsx` inline type has 6 missing fields + `plan: string`. Three unsafe `as` casts survive unification and silently carry malformed state. `displayName: string | null` will produce strict-mode compile errors at call sites.
5. **`dehydrateOptions` filter targets phantom keys** — `'me'` is never in the query cache; `api.me()` is called imperatively. Use an allowlist (`PERSISTABLE_ROOTS`) instead of a blocklist.
6. **Expo Router v4 breaking change** — `router.navigate()` always pushes a new screen. Use `router.dismissTo()` to return to an existing screen.
7. **Auth cold-start spinner should be fixed now** — `AuthProvider` is a clean shell before brainstorm #2 adds auth screens; harder to retrofit after.
8. **`expo-crypto` must be installed via `npx expo install`** — not `npm install`, to get the SDK-pinned compatible version.

---

## Overview

The Expo SDK 55 scaffold at `ai-notecards/mobile/` was built from the platform & architecture brainstorm. A post-build audit against the brainstorm spec, the Express server routes, and trade-journal patterns found **5 scaffold-blocking issues** and **several important improvements** that should be resolved before moving to brainstorm #2 (auth/onboarding).

The scaffold correctly implements: Expo SDK 55 config, 4-tab navigation, full theme system (mode/style/palette), MMKV + SecureStore hybrid storage, TanStack Query v5 with persistence, Bearer token API client structure, auth context shell, ErrorBoundary, types, query keys, and constants. **42 files, TypeScript compiles clean.**

## Problem Statement

Five categories of issues were found:

1. **Server cannot accept mobile auth** — `authenticate` middleware reads cookies only; `requireXHR` blocks all mutations. The mobile app is completely non-functional against the current server.
2. **Wrong API paths** — 4 endpoints in `api.ts` use paths that do not match Express mount paths. Confirmed against `server/src/index.js` and web client cross-reference.
3. **Missing asset files** — `app.json` references 4 PNG files that don't exist; Expo will warn/fail
4. **Missing `.gitignore`** — `node_modules/` and `.env` will be committed on next `git add`
5. **No `CLAUDE.md`** — project convention requires each app subdirectory to have one; brainstorms 2-5 will work in this directory without context

## Acceptance Criteria

### Must Fix (Scaffold-Blocking)

- [x] **Add Bearer token support to server** — two-line change to unblock all mobile auth:
  - `server/src/middleware/auth.js`: `const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');`
  - `server/src/middleware/csrf.js`: bypass `requireXHR` when request has `Authorization: Bearer` header
  - Existing web cookie-based auth must remain unchanged
- [x] **Fix API paths in `mobile/src/lib/api.ts`** — paths are confirmed wrong against `server/src/index.js`. Direct fixes (no verification step needed):

  | Line | Current | Fix |
  |------|---------|-----|
  | 84 | `/auth-google` | `/auth/google` |
  | 88 | `/auth-magic/request` | `/auth/magic-link/request` |
  | 89 | `/auth-magic/verify` | `/auth/magic-link/verify` |
  | 114 | `/study/start` | `/study` |

- [x] **Unify `User` type** — this is a live bug, not a nice-to-have:
  - Delete the inline 7-field `User` type in `auth.tsx` (lines 4–12)
  - Add `import type { User } from '../types/api';`
  - Run `npx tsc --noEmit` — fix every compile error that surfaces (they are real bugs, not regressions)
  - Null-guard every `user.displayName` render site (`displayName: string | null` will fail strict mode)
  - Update the three `as` casts at lines 34, 46, 52 to typed generic calls (minimum: typed as `{ user: User }` with correct import)
- [x] Create placeholder asset files in `mobile/assets/`
  - `icon.png` (1024×1024)
  - `splash-icon.png` (200×200 minimum)
  - `adaptive-icon.png` (1024×1024)
  - `favicon.png` (48×48)
- [x] Add `mobile/.gitignore` with complete Expo exclusions (see Research Insights below for full content)
- [x] Create `mobile/CLAUDE.md` documenting: stack, structure, provider hierarchy, theme system overview, API client patterns, commands (see Research Insights for full outline)

### Should Fix (Reduces Friction for Brainstorm #2)

- [x] **Install `expo-crypto` and fix MMKV encryption key** — two bugs to fix together:
  - Run `npx expo install expo-crypto` (not `npm install` — must use Expo CLI for SDK-pinned version)
  - Replace `Math.random()` with `Crypto.randomUUID().replace(/-/g, '')` — synchronous CSPRNG, no async propagation
  - Fix the catch path: generate a key, attempt to persist it, then return it (prevents data-loss on next launch when a different key is generated)
  - `export const storage = createStorage()` must remain synchronous
- [x] **Fix `SecureStoreFallback.remove()` async bug** — `void SecureStore.deleteItemAsync(key)` discards the promise. Either `await` it (make `remove` async) or accept the race condition knowingly with a comment.
- [x] **Fix `dehydrateOptions` allowlist in `query-client.ts`** — the current filter targets `'me'` which is never in the query cache (`api.me()` is called imperatively). Use an allowlist:
  ```typescript
  const PERSISTABLE_ROOTS = new Set(['decks', 'marketplace', 'study']);

  export const dehydrateOptions = {
    shouldDehydrateQuery: (query: Query) =>
      PERSISTABLE_ROOTS.has(query.queryKey[0] as string),
  };
  ```
  Pass to `PersistQueryClientProvider`. Document the allowlist in `CLAUDE.md` so brainstorm #2 adds new roots explicitly.
- [x] **Fix `userInterfaceStyle` in `app.json`** — change `"light"` → `"automatic"`. One-character change; prevents the OS dark mode signal from being permanently blocked when dark mode is implemented.
- [x] **Fix `startSession` mode type** — `api.startSession()` line 113 accepts `mode: string`. `StudyMode` type already exists in `types/api.ts`. One-word fix: `mode: StudyMode`. Add import.
- [x] **Add auth cold-start MMKV hydration** — `AuthProvider` is a clean shell now; harder to retrofit after brainstorm #2. On mount, read cached user from MMKV synchronously and initialize `loading: false` immediately. Kick off `api.me()` in background to verify freshness. Write user to MMKV on every successful `api.me()`. Clear on logout. Spinner only appears on first install (no cache) or after logout.
- [x] **Remove broken test scripts from `mobile/package.json`** — delete `"test"` and `"test:unit"` script entries. Keep `vitest` in devDependencies for future use. Adding a smoke test config is scope creep at this stage.

### Should Fix (Security — Before Any Real Auth Tokens Are Stored)

- [x] **Add `keychainAccessible` flag to SecureStore writes** in `api.ts`:
  ```typescript
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  ```
  Prevents token from migrating to a new device via iCloud Keychain backup.
- [x] **Fix `sanitizeUser()` on the server** — the function returns `role` (reveals admin accounts), raw Stripe customer/connect IDs, `suspended`, and internal usage tracking fields to all clients. Remove these before public beta. Expose only: `id`, `email`, `displayName`, `plan`, `avatarUrl`, `studyScore`, `currentStreak`, `longestStreak`, `trialEndsAt`, `sellerTermsAccepted`, `stripeConnectOnboarded` (boolean), `createdAt`. Audit web client first to confirm no client code reads `role` or Stripe IDs.

### Deferred to Feature Brainstorms (Do NOT fix now)

| Item | Deferred To | Rationale |
|------|------------|-----------|
| Zod validation schemas | Brainstorm #2 (auth) | No API calls happening yet; add per-feature |
| RevenueCat dependency | Marketplace brainstorm | Requires dev client build, not needed for Expo Go |
| Typed API responses (`Promise<unknown>`) | Each feature brainstorm | Add type params when implementing each endpoint |
| Missing API methods (avatar, stripe, generate preview) | Respective brainstorms | Dead code until features exist |
| Tab bar icons | Brainstorm #2 or #3 | Need icon assets; cosmetic |
| EAS projectId | Brainstorm #5 (App Store) | Only needed for EAS Build; requires account access |
| `@shopify/flash-list` | Dashboard brainstorm | Feature optimization concern |
| RootErrorBoundary outside ThemeProvider | Brainstorm #2 | Low risk; `parseThemeSelection` handles corrupt MMKV gracefully |
| Type auth methods (`login`, `signup`, `me`) | Brainstorm #2 | Eliminate `as` casts when implementing the actual auth screens |

## Technical Considerations

### Server Bearer Token Support (Scaffold-Blocking — Fix First)

The mobile app sends `Authorization: Bearer <token>` on every authenticated request. The server's `authenticate` middleware reads exclusively from `req.cookies?.token`. Every authenticated mobile request returns `401`. Additionally, `requireXHR` requires `X-Requested-With: XMLHttpRequest` — a header React Native `fetch` does not send. All state-changing endpoints return `403` from mobile.

**Fix (2 lines, zero architecture change):**

`server/src/middleware/auth.js`:
```js
const token = req.cookies?.token
  || req.headers.authorization?.replace('Bearer ', '');
```

`server/src/middleware/csrf.js`:
```js
// In requireXHR: bypass for Bearer-authenticated requests (native app)
if (req.headers.authorization?.startsWith('Bearer ')) return next();
```

Existing cookie-based web auth is unchanged (additive change).

### API Path Verification

Paths in `mobile/src/lib/api.ts` are confirmed wrong. Authoritative source: `server/src/index.js` mount points, cross-confirmed by `client/src/lib/api.js`:

```
/api/auth/google              (not /api/auth-google)
/api/auth/magic-link/request  (not /api/auth-magic/request)
/api/auth/magic-link/verify   (not /api/auth-magic/verify)
POST /api/study               (not /api/study/start)
```

The `updateDeck` and `duplicateDeck` routes ARE confirmed to exist on server (decks.js lines 254, 168) — no changes needed there.

### Research Insights: MMKV Encryption Key Security

**Problem 1 — PRNG:** `Math.random()` is predictable; keys derived from it have far less entropy than claimed.

**Problem 2 — Data-loss in catch path:** If `SecureStore.setItem` fails on first write, execution falls to catch. The catch generates a new key but never persists it. On next app launch, another different key is generated and MMKV opens with a mismatched key — all previously written data becomes permanently unreadable.

**Fix:**
```typescript
import * as Crypto from 'expo-crypto';

function generateEncryptionKey(): string {
  // Synchronous CSPRNG — randomUUID() is backed by the native secure RNG
  return Crypto.randomUUID().replace(/-/g, '');  // 32 hex chars, 122 bits entropy
}

// In catch path — persist the key even if first attempt failed:
const newKey = generateEncryptionKey();
try { SecureStore.setItem(ENCRYPTION_KEY_ID, newKey); } catch { /* log */ }
return newKey;
```

**Important:** Do NOT use `getRandomBytesAsync` — it is async and breaks the synchronous `export const storage = createStorage()` module-level initialization. `randomUUID()` is synchronous.

**Install:** `npx expo install expo-crypto` (not `npm install` — Expo CLI pins the SDK-compatible version). `expo-crypto` is included in Expo SDK 55 but must be explicitly added to `package.json`.

### Research Insights: `dehydrateOptions` Allowlist

The original filter `key !== 'me'` matches nothing — `api.me()` is called imperatively, not via `useQuery`, so `'me'` is never a query key. An allowlist is safer than a blocklist (default-deny instead of default-allow):

```typescript
const PERSISTABLE_ROOTS = new Set(['decks', 'marketplace', 'study']);

export const dehydrateOptions = {
  shouldDehydrateQuery: (query: Query) =>
    PERSISTABLE_ROOTS.has(query.queryKey[0] as string),
};
```

Pass to `PersistQueryClientProvider`:
```tsx
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister: queryPersister }}
  dehydrateOptions={dehydrateOptions}
>
```

Document `PERSISTABLE_ROOTS` in `CLAUDE.md` — future brainstorms must explicitly add new roots to permit offline caching.

### Research Insights: `.gitignore` Complete Content

```gitignore
# Expo
node_modules/
.expo/
dist/
web-build/
expo-env.d.ts

# Native build output (root-anchored)
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

Note: `/ios` and `/android` are root-anchored (leading slash), matching `apps/trade-journal/.gitignore` exactly. `*.p8` and `*.p12` are Apple signing artifacts — committing them would allow anyone to send push notifications or compromise the signing identity.

### Research Insights: CLAUDE.md Outline

The `mobile/CLAUDE.md` should document (in order):

1. **Stack** — Expo SDK 55 managed, Expo Router v4, TypeScript strict, React Native
2. **Structure** — directory tree with purpose annotations
3. **Provider Hierarchy** — `ThemeProvider > ErrorBoundary > PersistQueryClientProvider > AuthProvider > AuthGate > Slot` with reason for each position
4. **Theme System** — `mode × style × palette` composition; `useThemedStyles(factory)` pattern; `THEME_STORAGE_KEY` in MMKV
5. **API Client** — Bearer token flow; `api.ts` method signatures; how to add a new endpoint
6. **TanStack Query** — query key factories in `types/query-keys.ts`; staleTime/gcTime; MMKV persistence; `PERSISTABLE_ROOTS` allowlist (must add new roots explicitly to permit offline caching)
7. **Storage Layers** — MMKV (fast, non-sensitive), SecureStore (tokens only, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`)
8. **Expo Router v4 Notes** — `router.navigate()` always pushes; use `router.dismissTo()` for back-navigation to existing screens
9. **TypeScript Rules** — no `as` casts on API responses; `plan` is `'free'|'trial'|'pro'` not `string`; `displayName` is `string | null`, always null-guard; add types when implementing each endpoint
10. **Commands** — `npx expo start`, `npx expo start --ios`
11. **AI Output Contract** — no new global state patterns; no Zustand; no Redux; query keys must use factories from `types/query-keys.ts`; new query roots must be added to `PERSISTABLE_ROOTS` to persist

### Auth Cold-Start Behavior

`AuthProvider` initializes with `loading: true` and only sets `false` after `api.me()` completes. `AuthGate` renders a full-screen spinner while loading. Every app open shows a spinner until the server round-trip resolves (100–300ms good network; several seconds on bad network with retries).

**Fix (simpler to add now before auth screens are built):**
```typescript
const USER_CACHE_KEY = 'cached-user';

// In AuthProvider initial state:
const cachedUserJson = storage.getString(USER_CACHE_KEY);
const cachedUser = cachedUserJson ? JSON.parse(cachedUserJson) as User : null;

const [user, setUser] = useState<User | null>(cachedUser);
const [loading, setLoading] = useState(cachedUser === null); // spinner only on first install

// On successful api.me():
storage.set(USER_CACHE_KEY, JSON.stringify(user));

// On logout:
storage.delete(USER_CACHE_KEY);
```

Background `api.me()` call still runs to verify freshness and update state if server response differs.

### Provider Ordering Note

Current: `ThemeProvider > ErrorBoundary > PersistQueryClientProvider > AuthProvider > AuthGate > Slot`

The `ErrorBoundary` component uses `useThemedStyles` (requires `ThemeProvider`). If `ThemeProvider` throws during init, there's no error boundary above it. The `parseThemeSelection` function handles corrupt MMKV data gracefully, so the risk is low. A bare-bones RootErrorBoundary (plain `View` with no theme hooks) could be added outside `ThemeProvider` — defer to brainstorm #2.

### Research Insights: Expo Router v4 Breaking Change

`router.navigate()` in Expo Router v4 **always pushes** a new entry to the stack. To return to a screen that already exists in the stack, use:

```typescript
router.dismissTo('/(tabs)/home');  // returns to existing screen
// NOT: router.navigate('/(tabs)/home')  // would push a duplicate
```

This affects `AuthGate`'s redirect logic and any "go home" buttons in stack screens. Document in CLAUDE.md so brainstorm #2 doesn't introduce navigation bugs.

## References

### Files to Modify

- `server/src/middleware/auth.js` — Add Bearer token reading (one line)
- `server/src/middleware/csrf.js` — Bypass `requireXHR` for Bearer-authenticated requests
- `mobile/src/lib/api.ts:84,88-89,114` — Fix API paths; fix `startSession` mode type; add `keychainAccessible` to SecureStore writes
- `mobile/src/lib/mmkv.ts` — Replace `Math.random()` with `Crypto.randomUUID()`; fix `remove()` async bug; fix catch path to persist key
- `mobile/src/lib/auth.tsx:5-12` — Remove inline User type, import from `types/api`; fix `as` casts; add MMKV cold-start hydration
- `mobile/src/lib/query-client.ts` — Replace dehydrateOptions with PERSISTABLE_ROOTS allowlist
- `mobile/package.json:10-11` — Remove `test` and `test:unit` scripts
- `mobile/app.json` — Change `userInterfaceStyle` from `"light"` to `"automatic"`
- `apps/ai-notecards/server/src/routes/auth.js` — Fix `sanitizeUser()` to remove `role`, raw Stripe IDs, and other internal fields (audit web client first)

### Files to Create

- `mobile/.gitignore`
- `mobile/CLAUDE.md`
- `mobile/assets/icon.png`, `splash-icon.png`, `adaptive-icon.png`, `favicon.png`

### Reference Files

- `server/src/index.js:86-98` — **Authoritative** Express route mount paths
- `server/src/middleware/auth.js` — Current cookie-only token extraction
- `server/src/middleware/csrf.js` — Current requireXHR implementation
- `apps/ai-notecards/docs/auth-implementation-guide.md` — Auth context
- `client/src/lib/api.js:34,37-38,72` — Web client paths (cross-reference, confirmed correct)
- `apps/trade-journal/.gitignore` — Reference for complete Expo .gitignore
- `apps/trade-journal/CLAUDE.md` — Reference for mobile CLAUDE.md format

### Audit Sources

- Brainstorm: `docs/brainstorms/2026-03-15-ios-platform-and-architecture-brainstorm.md`
- Trade-journal patterns: `apps/trade-journal/` (same SDK, same conventions)
- Web app API contract: `apps/ai-notecards/client/src/lib/api.js`
