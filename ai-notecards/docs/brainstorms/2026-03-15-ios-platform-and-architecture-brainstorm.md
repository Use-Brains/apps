---
date: 2026-03-15
topic: ios-platform-and-architecture
---

# iOS Platform & Architecture Strategy

## What We're Building

The iOS native client for AI Notecards. The web app (React SPA + Express API) is v1 complete and deployed. The backend API is already structured for mobile consumption (JSON endpoints, JWT auth, proper rate limiting, `GOOGLE_IOS_CLIENT_ID` already configured). We need to decide the framework, project structure, navigation model, state management, and API integration strategy for building an iOS app that delivers all existing features with native-quality UX.

This is brainstorm #1 of 5 for the iOS effort. It covers platform-level decisions. Subsequent brainstorms will handle auth/onboarding, study mode UX, offline/sync, and App Store launch.

## Why This Approach

Three options were evaluated: Swift/SwiftUI, React Native CLI, and Expo (React Native). **Expo wins decisively.**

- **trade-journal already uses Expo SDK 55** in the same workspace. Shared toolchain knowledge, shared EAS build infrastructure, shared Expo organization (`blue-expos-organization`). Running two different mobile frameworks in the same workspace is irrational.
- **Code sharing with the web app** is possible at the type/validation layer. The web app is React -- React Native shares the component mental model, hooks, and state patterns. SwiftUI shares nothing.
- **Study mode UX** (card flips, drag-and-drop match, gesture-based rating) is well-served by `react-native-reanimated` + `react-native-gesture-handler`, both already proven in trade-journal. SwiftUI animations are excellent but lock us into a single platform forever.
- **React Native CLI** (without Expo) offers no advantage. Expo SDK 55's managed workflow handles everything we need, and trade-journal already uses it.
- **Time to ship matters.** An Expo app reusing patterns from trade-journal ships in 4-6 weeks. A SwiftUI app from scratch is 8-12 weeks minimum with a steeper learning curve.

## Feature Details

### 1. Framework: Expo SDK 55

**Problem:** Choosing a framework that balances native UX quality, development speed, and maintainability.

**Approach:** Expo SDK 55, managed workflow, matching trade-journal exactly. Key dependencies carry over directly: Expo Router v4 (file-based routing), `react-native-reanimated` (card flip and match animations), `react-native-gesture-handler` (swipe gestures for study modes), `expo-image-picker` (photo-to-flashcard), `expo-secure-store` (token storage), TanStack Query v5 (server state). Use EAS Build for App Store submissions through the existing `blue-expos-organization` account. TypeScript from day one (trade-journal is TypeScript; the web app is JavaScript, but the mobile app should be typed).

### 2. Project Structure

**Problem:** Where does the iOS project live? How does it relate to the existing `client/` and `server/` directories?

**Approach:** `apps/ai-notecards/mobile/` as a sibling to `client/` and `server/`. This mirrors how trade-journal is structured (`apps/trade-journal/` is a standalone Expo project). The mobile app is a separate Expo project with its own `package.json`, `app.json`, `tsconfig.json`, and `app/` directory for Expo Router screens. It shares nothing at the npm dependency level with `client/` -- no monorepo tooling (Turborepo, Nx) needed. Shared code (types, validation schemas) lives in `mobile/src/types/` and is manually synced or copy-pasted from the web app. YAGNI on a shared packages directory until there's real pain.

```
apps/ai-notecards/
  client/          # React web app (existing)
  server/          # Express API (existing)
  mobile/          # Expo iOS app (new)
    app/           # Expo Router screens
    src/
      components/  # Reusable UI components
      hooks/       # Custom hooks
      lib/         # API client, auth, query client, theme
      types/       # Zod schemas, API types
      utils/       # Pure functions
    assets/        # App icon, splash, images
    app.json
    package.json
    tsconfig.json
    eas.json
```

### 3. Navigation Architecture

**Problem:** The web app has ~20 routes. How do these map to native navigation patterns?

**Approach:** Tab bar with 4 tabs + stack navigation within each tab. Matches trade-journal's `(tabs)/_layout.tsx` pattern.

**Tabs:**
- **Home** -- Dashboard (decks list, search, sort, streaks, study score)
- **Generate** -- AI flashcard generation (text + photo input, preview flow)
- **Marketplace** -- Browse, search, filter, purchase
- **Profile** -- Settings, preferences, subscription, seller section

**Stack screens (pushed on top of tabs):**
- Deck detail (`/decks/[id]`)
- Study session (`/study/[deckId]`) -- presented as a full-screen modal
- Marketplace listing detail (`/marketplace/[id]`)
- List deck for sale (`/sell/[deckId]`)
- Seller dashboard (`/seller`)

**Auth screens** live outside the tab navigator in an `(auth)/` group, matching trade-journal's pattern. Welcome/onboarding is a separate flow gating the main app.

### 4. State Management

**Problem:** Managing auth state, server data (decks, sessions, marketplace), and local UI state across the app.

**Approach:** Match trade-journal's stack exactly:

- **TanStack Query v5** for all server state (decks, marketplace listings, study sessions, profile). Handles caching, background refetch, optimistic updates, and offline persistence via `@tanstack/react-query-persist-client` + MMKV.
- **React context** for auth state only (current user, token, login/logout actions). One `AuthProvider` wrapping the app, matching the web app's `AuthContext.jsx` pattern.
- **No Zustand, no Redux.** TanStack Query eliminates the need for a client-side store for server data. Local component state (`useState`) handles UI concerns (form inputs, modal visibility, study session progress). If something doesn't need to survive navigation, it doesn't need global state.
- **MMKV** for fast synchronous storage (query cache persistence, user preferences). `expo-secure-store` for the auth token only (encrypted, 2048-byte limit).

### 5. API Integration

**Problem:** The Express backend exists and serves JSON. How does the mobile client authenticate and communicate?

**Approach:** Bearer token auth over HTTPS. The web app uses httpOnly cookies + CSRF headers, but cookies are a poor fit for native apps. The backend needs a small update: the `authenticate` middleware currently only reads `req.cookies?.token`. It needs to also check the `Authorization: Bearer <token>` header. This is a one-line change (`const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '')`). The CSRF `requireXHR` middleware should pass through requests with a valid Bearer token (native apps aren't vulnerable to CSRF).

**API client:** A typed fetch wrapper in `mobile/src/lib/api.ts` that mirrors the web app's `client/src/lib/api.js` but uses Bearer auth instead of cookies. Define response types with Zod schemas that double as runtime validators.

**Base URL:** Environment-configured. Dev: `http://localhost:3001/api`. Production: `https://api.ainotecards.com/api` (or whatever the production domain is). Use Expo Constants for environment switching.

### 6. Code Sharing Strategy

**Problem:** The web and mobile apps share a backend. Can they share any client code?

**Approach:** Share types and validation logic, nothing else. UI components, navigation, and platform APIs are too different to share between React DOM and React Native.

**What gets shared (manually copied + adapted):**
- API endpoint paths and request/response shapes (the web `api.js` becomes a typed `api.ts`)
- Zod validation schemas for forms (generate input, listing creation, profile updates)
- Business logic constants (tier limits, pricing, category list, study mode definitions)
- Utility functions (shuffle algorithm for study modes, score calculations)

**What stays separate:**
- All UI components (React DOM elements vs React Native Views)
- Navigation (react-router-dom vs Expo Router)
- Auth flow (cookies vs Bearer tokens)
- Image handling (File API vs expo-image-picker)
- Storage (localStorage vs MMKV/SecureStore)

**No shared npm package.** The overhead of maintaining a shared package for ~10 files of types and utils isn't justified. Copy the files, type them properly in the mobile project, move on.

### 7. Design System Translation

**Problem:** The web app has a warm parchment palette. How does this translate to iOS native patterns?

**Approach:** Keep the palette, adapt the patterns. The warm parchment colors (#FAF7F2 background, #1B6B5A accent green, #C8A84E gold) are the brand -- they work on iOS. But the implementation should follow iOS conventions.

**Theme system:** A `theme.ts` file exporting color tokens, spacing scale, and typography. No dark mode in v1 (the web app doesn't have it either). Light mode only, matching the parchment aesthetic.

**Platform adaptations:**
- Use iOS-native tab bar styling (not custom) with brand colors for active/inactive tints
- Cards and surfaces use `#FFFFFF` with subtle shadows (iOS convention) rather than the web's flat parchment cards
- Study mode uses full-screen presentation with the dark gradient background (`#0d4a3d`), matching web
- Buttons follow iOS sizing (44pt minimum touch target) with the green accent
- Use `expo-blur` for glass effects on modals/overlays (trade-journal already uses this)
- Typography: system font (San Francisco), not custom fonts -- matches iOS feel, zero config

**No component library.** Build components from scratch using React Native primitives + Reanimated. Component libraries (NativeBase, Tamagui, etc.) add bloat and fight the framework. trade-journal builds its own components; this should too.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Framework | Expo SDK 55 (managed) | Same as trade-journal; shared toolchain, EAS builds, proven stack |
| Language | TypeScript | Type safety for API integration; trade-journal is TS |
| Project location | `apps/ai-notecards/mobile/` | Sibling to `client/` and `server/`, standalone Expo project |
| Navigation | 4-tab bar + stacks | Maps cleanly to web routes; matches trade-journal pattern |
| Server state | TanStack Query v5 | Caching, persistence, background refetch; same as trade-journal |
| Auth state | React context | Simple, matches web app's AuthContext pattern |
| Client store | None (YAGNI) | TanStack Query + local state covers everything |
| Token storage | expo-secure-store | Encrypted storage for JWT; MMKV for non-sensitive data |
| API auth | Bearer token | Cookies don't work well on native; one-line backend change |
| Code sharing | Manual copy of types/utils | No shared package overhead; ~10 files max |
| Design system | Brand colors + iOS conventions | Parchment palette is the brand; adapt layout patterns to iOS |
| Component library | None (build from scratch) | Fewer dependencies, full control; matches trade-journal approach |
| Dark mode | Not in v1 | Web doesn't have it; ship without, add later |
| Payments | RevenueCat | Required for iOS subscriptions (Apple mandates IAP); trade-journal uses it |

## Open Questions

- **Backend bearer auth:** The `authenticate` middleware needs updating to support `Authorization: Bearer` header. Is this a separate PR or part of the mobile project setup?
- **RevenueCat vs direct StoreKit:** The web app uses Stripe for subscriptions. iOS requires in-app purchases for subscriptions. RevenueCat simplifies this and trade-journal already uses it (`react-native-purchases`). But this means maintaining two billing systems (Stripe for web, RevenueCat for iOS). How do we sync subscription state?
- **Push notifications:** Not in v1, but worth considering during project setup so the infrastructure (`expo-notifications`) is easy to add later.
- **Offline study sessions:** Users should be able to study downloaded decks without internet. TanStack Query persistence handles read caching, but writing session results while offline needs a queue. Defer to brainstorm #4 (offline/sync)?

## Implementation Priority

1. **Project scaffolding** -- `expo init`, Expo Router, base navigation, theme system
2. **Auth flow** -- Bearer token middleware update, login/signup screens, secure token storage
3. **Dashboard + deck detail** -- TanStack Query setup, deck list, deck view with cards
4. **Study modes** -- Flip first (simplest), then MC, type, match (hardest -- drag-and-drop)
5. **Generation** -- Text input + photo capture, preview flow, save
6. **Marketplace** -- Browse, search, listing detail, purchase (RevenueCat or Stripe mobile)
7. **Seller flow** -- Stripe Connect deep link for onboarding, listing management
8. **Profile + settings** -- Avatar upload, preferences, subscription management

## Scope Boundaries

**In scope:** Framework decision, project structure, navigation model, state management, API integration strategy, code sharing approach, design system translation plan.

**Out of scope:**
- Offline/sync strategy (brainstorm #4)
- Auth/onboarding native UX details (brainstorm #2)
- Study mode gesture and animation specifics (brainstorm #3)
- App Store submission, ASO, TestFlight (brainstorm #5)
- Android (iOS first, Android later -- Expo makes this easy to add)
- Push notifications (v2)
- Widget / Live Activities (v2)
- iPad-specific layouts (v2 -- `supportsTablet: true` but no iPad-optimized UI)

## Next Steps

--> `/workflows:plan` for implementation details
