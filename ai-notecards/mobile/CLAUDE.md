# AI Notecards Mobile

Expo managed-workflow app for the AI Notecards platform.

## Stack

- **Runtime:** Expo SDK 55 (managed workflow)
- **Routing:** Expo Router v4 (file-based)
- **Language:** TypeScript (strict mode)
- **Framework:** React Native 0.83

## Project Structure

```
app/                    # Expo Router screens (file-based routing)
  (auth)/               # Login / signup screens (public)
  (tabs)/               # Main tab navigation (authenticated)
  _layout.tsx           # Root layout — provider hierarchy
src/
  components/           # Reusable UI components
  lib/
    api.ts              # HTTP client with Bearer token auth
    auth.tsx            # AuthProvider + useAuth hook
    mmkv.ts             # MMKV storage with SecureStore fallback
    query-client.ts     # TanStack Query client + MMKV persister + PERSISTABLE_ROOTS
    theme.ts            # Theme system (mode × style × palette)
  types/
    api.ts              # Canonical API types (User, Deck, Card, StudyMode, etc.)
    query-keys.ts       # TanStack Query key factories
assets/                 # Placeholder PNGs (replace before App Store submission)
```

## Provider Hierarchy

```
ThemeProvider
  ErrorBoundary          ← uses useThemedStyles (requires ThemeProvider)
    PersistQueryClientProvider
      AuthProvider
        AuthGate         ← redirects unauthenticated users to (auth)/login
          Slot
```

Each layer is intentionally ordered — do not reorder without understanding the dependency chain.

## Theme System

Three-axis composition: `mode` (light/dark/system) × `style` (default/minimal/…) × `palette` (parchment/…).

- Hook: `useThemedStyles(factory)` — pass a `(theme: AppTheme) => StyleSheet` factory
- Storage key: `THEME_STORAGE_KEY` in MMKV
- Access theme tokens: `const { theme } = useTheme()`

## API Client

All requests go through `src/lib/api.ts`. The client:
1. Reads the JWT from SecureStore (`auth-token` key)
2. Attaches it as `Authorization: Bearer <token>`
3. Throws `ApiError` on non-2xx responses (check `err.status`)

To add a new endpoint, add a method to the `api` object following the existing pattern. For typed responses, add the response type as a generic: `request<MyResponseType>(...)`.

## TanStack Query

- Query key factories: `src/types/query-keys.ts` — always use factories, never inline strings
- `staleTime`: 5 minutes / `gcTime`: 24 hours
- MMKV persistence via `queryPersister` (survives app restarts)

### PERSISTABLE_ROOTS allowlist

Only queries whose `queryKey[0]` is in `PERSISTABLE_ROOTS` are persisted to MMKV:

```typescript
const PERSISTABLE_ROOTS = new Set(['decks', 'marketplace', 'study']);
```

**When adding a new feature:** explicitly add its root key to this set if offline caching is needed. Default is no persistence (default-deny).

## Storage Layers

| Layer | Module | Use for |
|-------|--------|---------|
| MMKV | `src/lib/mmkv.ts` | Fast non-sensitive data (query cache, theme prefs, user cache) |
| SecureStore | `expo-secure-store` | Auth tokens only (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) |

SecureStore has a 2 KB value limit — store only tokens, not user data.

## Expo Router v4 Navigation

`router.navigate()` **always pushes** a new entry — it does NOT go back to an existing screen.

- To return to an existing screen: `router.dismissTo('/(tabs)/home')`
- To push a new screen: `router.navigate('/some/screen')`
- To replace current screen: `router.replace('/some/screen')`

This affects `AuthGate` redirects and any "go home" buttons in stack screens.

## TypeScript Rules

- **No `as` casts on API responses** — add typed generics when implementing each endpoint
- `plan` is `'free' | 'trial' | 'pro'` — not `string`
- `displayName` is `string | null` — always null-guard at render sites
- `StudyMode` is `'flip' | 'multiple_choice' | 'type_answer' | 'match'` — import from `@/types/api`
- Query keys must use factories from `@/types/query-keys`

## Commands

```bash
npx expo start          # Start Expo dev server (Expo Go)
npx expo start --ios    # Start with iOS simulator
npm run typecheck       # TypeScript check (tsc --noEmit)
npm run lint            # Expo lint
```

## AI Output Contract

When implementing features in this directory:

- No new global state patterns — use TanStack Query for server state, MMKV for local state
- No Zustand, no Redux, no MobX
- Query keys must use factories from `src/types/query-keys.ts`
- New query roots must be added to `PERSISTABLE_ROOTS` in `query-client.ts` to enable offline caching
- New API endpoints must be added to `src/lib/api.ts`; add types when implementing each endpoint
- Auth token is stored via `setToken()` / `clearToken()` in `api.ts` — do not write to SecureStore directly
