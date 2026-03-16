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
    network.tsx         # Reachability + foreground sync provider
    offline/            # SQLite schema, repository, download/sync helpers
    query-client.ts     # TanStack Query client + MMKV persister + PERSISTABLE_ROOTS
    study/              # Local study session orchestration + mode metadata
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
        NetworkProvider  ← offline sync + downloaded deck refresh triggers
          AuthGate       ← redirects unauthenticated users to (auth)/login
            OfflineBanner
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
1. Reads the access token and refresh token from SecureStore
2. Attaches the access token as `Authorization: Bearer <token>`
3. Uses `X-Client-Platform: ios-native` for native auth contracts
4. Attempts a single-flight token refresh on eligible `401` responses
5. Throws `ApiError` on non-2xx responses (check `err.status`)

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
| SQLite | `src/lib/offline/*` | Durable offline deck snapshots + pending study session queue |
| SecureStore | `expo-secure-store` | Access + refresh tokens only (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`) |

SecureStore has a 2 KB value limit — store only tokens, not user data.

## Offline Study Architecture

- SQLite is the source of truth for downloaded decks, cards, and pending study sessions.
- MMKV-backed React Query persistence is still used for warm cache hydration, but not for durable offline study state.
- `src/lib/offline/downloads.ts` handles deck snapshot save/refresh work.
- `src/lib/offline/sync.ts` batches queued study sessions to `/api/study/sync`.
- `src/lib/network.tsx` listens to reachability + foreground transitions and triggers best-effort sync/refresh.
- The first offline study cut uses a simple local card-review loop in `app/study/[deckId].tsx`.

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
node ./node_modules/vitest/vitest.mjs run  # Run unit tests with Node 22 in this repo
```

## Supported iOS Workflow

Use a custom dev client workflow for this app.

- Local simulator development: `APP_ENV=development npm run ios:simulator`
- Local Metro for dev client: `APP_ENV=development npm run start:dev-client`
- Device build via EAS: `npm run build:ios:development`
- Preview build via EAS: `npm run build:ios:preview`
- Production build via EAS: `npm run build:ios:production`

Do not treat Expo Go as the primary path for this app. It uses native capabilities and should be developed against a dev build.

For the simulator path, do not use Expo CLI's `--device` flag. `npm run ios:simulator` should use the default simulator flow and must not require iOS code signing.
The local iOS scripts pre-generate React Native codegen artifacts before `expo run:ios` to avoid missing `ReactCodegen` build inputs in Xcode.

`app.config.js` is the source of truth for environment-specific app identity:

- `development` uses a non-production bundle identifier and disables production-only iOS capabilities
- `preview` and `production` use production-like capabilities

## AI Output Contract

When implementing features in this directory:

- No new global state patterns — use TanStack Query for server state, MMKV for local state
- No Zustand, no Redux, no MobX
- Query keys must use factories from `src/types/query-keys.ts`
- New query roots must be added to `PERSISTABLE_ROOTS` in `query-client.ts` to enable offline caching
- New API endpoints must be added to `src/lib/api.ts`; add types when implementing each endpoint
- Auth tokens are stored via `setSessionTokens()` / `clearSessionTokens()` in `api.ts` — do not write to SecureStore directly
