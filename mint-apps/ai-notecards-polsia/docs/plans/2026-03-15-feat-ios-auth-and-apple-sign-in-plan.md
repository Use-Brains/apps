---
title: iOS Auth & Apple Sign-In
type: feat
date: 2026-03-15
origin: docs/brainstorms/2026-03-15-ios-auth-and-apple-sign-in-brainstorm.md
deepened: 2026-03-15
reviewed: 2026-03-15
---

<!-- FINISHED -->

# iOS Auth & Apple Sign-In

## Enhancement Summary

**Deepened on:** 2026-03-15
**Technical review:** 2026-03-15
**Brainstorm found:** `docs/brainstorms/2026-03-15-ios-auth-and-apple-sign-in-brainstorm.md`
**Local research:** `docs/solutions/auth-implementation-guide.md`, `docs/solutions/feature-patterns/account-settings-experience.md`, `docs/solutions/feature-patterns/pre-launch-checklist.md`
**External research:** Expo SDK 55 docs for `expo-apple-authentication`, `expo-local-authentication`, and `expo-secure-store`
**Skills applied:** `deepen-plan`, `security-review`, `tdd-workflow`, `spec-flow-analyzer`, `framework-docs-researcher`, `security-sentinel`

### Key Planning Findings

1. **Native auth contract is the blocking gap** — `mobile/src/lib/auth.tsx` already expects token-based auth, but `server/src/routes/auth.js`, `server/src/routes/auth-google.js`, and `server/src/routes/auth-magic.js` still return cookie-oriented responses.
2. **This is a security-sensitive feature** — refresh tokens, Keychain storage, Apple identity verification, and biometric gating all require explicit contracts and revocation behavior.
3. **Apple Sign-In needs real Expo config, not just UI** — Expo SDK 55 requires `npx expo install expo-apple-authentication`, the plugin in `app.json`, and `ios.usesAppleSignIn: true` for iOS capability setup.
4. **Biometric unlock is a token gate, not a second auth system** — `expo-local-authentication` should protect access to stored tokens only; it should not invent a parallel session model.
5. **Institutional auth patterns must be preserved** — keep `USER_SELECT` canonical, keep auth stateless in `authenticate`, keep revocation checks in `requireActiveUser` or refresh-token DB lookups, and avoid leaking privileged/internal fields from `sanitizeUser()`.
6. **Session sprawl needs a hard bound** — the brainstorm decision to cap active refresh tokens at 5 devices should be implemented in the token issuance path, not deferred.

### New Considerations Discovered

- **Google Sign-In Expo config needs an iOS URL scheme** when using the `@react-native-google-signin/google-signin` plugin without Firebase config files.
- **Refresh retry logic must be single-flight** or concurrent 401s will race into multiple refresh requests and revoke each other.
- **Mobile/native route branching should be explicit** rather than inferred from `User-Agent`; use an intentional request signal or dedicated response helper.
- **TDD scope should emphasize route/integration tests first** because the highest risk is contract drift between web-cookie and mobile-token auth behavior.

## Technical Review Findings

### P1 — Critical

1. **Native auth response signaling must be explicit** — the plan cannot leave cookie-vs-token branching ambiguous. Adopt `X-Client-Platform: ios-native` for mobile auth calls and test both response modes on every shared auth route.
2. **Refresh-token rotation needs crash-safe client persistence semantics** — after server rotation, the client must persist the full new token pair before updating auth state. If either token write fails, clear session and require fresh login instead of leaving a half-rotated session.

### P2 — Important

1. **`apple_user_id` uniqueness must be audited for soft-delete safety** — if the existing schema uses plain `UNIQUE`, convert it to a partial unique index or equivalent safe pattern.
2. **Offline refresh failure needs explicit product behavior** — network failures should preserve cached read-only access when possible, while authoritative 401/403 refresh failures should clear session immediately.
3. **Mobile logout scope must default to single-session revocation** — reserve “log out everywhere” for a later account/session-management feature.
4. **Biometric lock must gate identity rendering** — only the locked screen or splash can render before biometric success when biometric protection is enabled.
5. **Provider cancel/error states need separate handling** — cancellations should not be logged or surfaced like server/auth failures.
6. **New Apple and refresh endpoints need explicit rate limiting** — the existing auth surface rate-limits login, signup, Google, and magic-link flows; the new native-only auth endpoints should match that posture.
7. **Native provider testing requires a dev client path** — Apple and Google native SDK flows will not be fully verifiable in plain Expo Go, so the plan should include dev-client build verification.

## Overview

Implement native iOS authentication for the Expo mobile app with Apple Sign-In, Google Sign-In, magic-link code entry, refresh-token-based mobile sessions, secure token persistence, and optional biometric unlock. The backend keeps the existing web cookie flow intact while adding a parallel native token contract for mobile-only auth flows.

This plan covers both server and mobile work needed to make step 2 production-ready enough for the later deepen-plan and technical review passes.

## Problem Statement

The current mobile scaffold is structurally ready for auth, but the end-to-end auth flow is incomplete:

- `mobile/src/lib/api.ts` stores a single access token in SecureStore, while the desired architecture requires an access + refresh token pair.
- `mobile/src/lib/auth.tsx` expects auth endpoints to return a token-bearing payload, but server auth routes still primarily set cookies and return web-oriented responses.
- There is no Apple Sign-In endpoint in the active Express route stack.
- There is no refresh-token table, rotation flow, or device-cap enforcement.
- Biometric unlock is not wired into the mobile auth shell.
- Login UX decisions from the brainstorm are not yet represented in screens, state transitions, or API contracts.

Without this work, the mobile app cannot ship an App Store-compliant authentication flow.

## Proposed Solution

### Phase 1 — Server-side mobile session foundation

Add a dedicated native token contract without breaking web auth.

- Introduce helpers in `server/src/routes/auth.js` for:
  - `createAccessToken(userId)` — 15-minute JWT for mobile Bearer auth
  - `setTokenCookie(res, userId)` — keep existing 7-day web cookie behavior
  - `issueMobileSession({ userId, deviceInfo })` — create access token + refresh token pair
- Add a refresh-token persistence layer:
  - new migration for `refresh_tokens`
  - hashed opaque refresh tokens only (never store raw values)
  - `expires_at`, `revoked_at`, `last_used_at`, structured `device_info`
  - hard cap of 5 active refresh tokens per user by revoking oldest active row during issuance
- Extend auth routes with explicit native responses:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/google`
  - `POST /api/auth/magic-link/verify`
  - new Apple route
  - all support a native/mobile mode and return `{ accessToken, refreshToken, user, isNewUser? }`
- Keep web flows unchanged:
  - cookies remain source of truth for web browser sessions
  - browser responses must continue to work with existing client auth expectations
- Add `POST /api/auth/refresh`:
  - validate refresh token hash
  - reject revoked/expired/deleted-user/suspended-user sessions
  - rotate refresh token on every use
  - revoke prior token atomically
  - return fresh `{ accessToken, refreshToken, user }`
- Extend `POST /api/auth/logout` for mobile:
  - accept refresh token or infer current session token from request body/header
  - revoke refresh token row
  - clear web cookie when present

### Research Insights

**Best Practices:**

- Centralize session issuance in one helper so `signup`, `login`, `google`, `magic-link`, and `apple` cannot drift on token shape or revocation behavior.
- Keep web and mobile branching at the response layer only; identity lookup, suspension checks, and `sanitizeUser()` should stay shared.
- Use opaque refresh tokens generated from secure random bytes, then hash before persistence.

**Implementation Details:**

- Add a helper such as `respondWithSession(req, res, { user, isNewUser })` that issues a cookie for web callers and `{ accessToken, refreshToken, user }` for native callers.
- Store `device_info` in a strict structured shape such as `{ platform, deviceName, osVersion, appVersion }`.
- Use `X-Client-Platform: ios-native` as the required request signal for native auth responses instead of guessing from headers or route usage.

**Security Considerations:**

- Refresh-token queries must always enforce deleted-user and suspended-user checks before issuing new access tokens.
- Logout should revoke only the presented mobile session by default unless a global sign-out is explicitly designed later.
- Keep raw refresh tokens out of logs, error payloads, analytics, and database rows.
- Add rate limiting to `POST /api/auth/refresh` and the new Apple auth endpoint to match the rest of the auth surface.

**Edge Cases:**

- App receives a refreshed token pair but crashes before persisting both values.
- A second refresh request arrives after the first rotates the token but before the client updates storage.
- A legacy web response accidentally reaches the mobile client and clears a session due to missing `accessToken`.

### Phase 2 — Apple Sign-In backend

Add App Store-compliant Apple auth to the active auth surface.

- Add `server/src/routes/auth-apple.js` or extend the current auth stack with a mounted Apple route under the active `/api/auth/...` namespace
- Verify Apple identity tokens against Apple public keys using the existing or approved verification library already present in the repo
- Use `apple_user_id` as provider lookup key
- Apply identity rules from the brainstorm:
  - lookup by `apple_user_id` first
  - email-match auto-link only for non-relay emails
  - relay emails create separate accounts
  - capture `fullName` only on first auth and persist immediately when available
- Return native mobile token payloads for mobile callers while preserving existing web behavior if any legacy Apple web flow remains

### Research Insights

**Best Practices:**

- Treat Apple email as optional on subsequent logins; only the first credential response may contain it.
- Fail closed on missing `identityToken` or unverifiable token signatures.
- Use the Apple `sub` claim as the stable account key; never key Apple users by email alone.

**Implementation Details:**

- Reuse relay-email detection patterns already present around Google auto-link safety instead of introducing separate regex logic.
- Add a clear response distinction for Apple credential cancellation vs invalid Apple credential so the mobile UI can avoid showing a generic error on user cancel.
- If a legacy `auth-apple` route exists outside the active router, migrate or retire it instead of leaving two Apple implementations with different rules.

**Security Considerations:**

- Verify `aud`, `iss`, expiry, and other required claims for the configured Apple app identifier.
- Do not auto-link relay emails to existing accounts even if the string collides.
- Sanitize `fullName` length and shape before persisting.

**Edge Cases:**

- Apple returns no email and no `fullName` on a repeat login.
- An existing soft-deleted row still holds `apple_user_id` or a relay email.
- Apple verification succeeds but the database write fails before the session response is committed.

### Phase 3 — Mobile token storage and auth state

Refactor the mobile auth shell around access + refresh tokens.

- Update `mobile/src/lib/api.ts`:
  - store `access_token` and `refresh_token` separately in SecureStore
  - keep `WHEN_UNLOCKED_THIS_DEVICE_ONLY`
  - centralize `getAccessToken`, `setSessionTokens`, `clearSessionTokens`, and refresh orchestration
- Add automatic token refresh behavior:
  - on 401 from protected endpoints, attempt a single refresh + retry path
  - on app foreground or cold start, refresh if access token is expired and refresh token exists
  - on refresh failure, clear tokens and return to auth flow
- Update `mobile/src/lib/auth.tsx`:
  - replace single-token assumptions with session-pair lifecycle
  - ensure `refreshUser()` can operate after refresh rotation
  - preserve cached-user hydration from MMKV
  - add explicit `isHydrated` / `isAuthenticating` style state if needed to avoid auth-screen flicker
- Add typed auth response shapes to `mobile/src/types/api.ts`

### Research Insights

**Best Practices:**

- Keep refresh orchestration inside the API layer, not scattered across screens and hooks.
- Use a single in-memory refresh promise so all callers await the same refresh attempt.
- Persist tokens before updating React auth state to avoid a UI that believes it is authenticated with missing storage.

**Implementation Details:**

- Replace `setToken()` / `clearToken()` in `mobile/src/lib/api.ts` with pair-aware helpers such as `setSessionTokens()` and `clearSessionTokens()`.
- Update `mobile/CLAUDE.md` after implementation so the documented storage contract matches the new token-pair design.
- Keep user cache in MMKV and tokens in SecureStore only; never mix them.
- Persist the new refresh token and new access token successfully before committing authenticated React state after a refresh response. If either write fails, clear both tokens and force full re-auth.

**Performance Considerations:**

- Avoid calling `/auth/me` redundantly after every login if the auth route already returns a complete `user` payload.
- Decode JWT expiry locally for proactive refresh checks instead of forcing a request to learn the token expired.

**Edge Cases:**

- SecureStore write for one token succeeds while the other fails.
- User opens the app offline with a cached user and an expired access token; preserve cached read-only access until connectivity returns, but clear immediately on authoritative refresh rejection.
- Hydration completes while a background refresh is still running and the auth gate renders the wrong screen.

### Phase 4 — Mobile auth UI and navigation

Implement the native auth screens and flows defined in the brainstorm.

- Build `(auth)` screens for:
  - login chooser
  - magic-link code entry
  - fallback password form for legacy accounts
- Add Apple Sign-In button via `expo-apple-authentication`
- Add Google Sign-In via `@react-native-google-signin/google-signin`
- Configure Google iOS client usage with the existing `GOOGLE_IOS_CLIENT_ID`
- Keep button prominence compliant:
  - Google first
  - Apple equal size and weight
  - magic link below divider
  - password behind a secondary affordance
- Route `isNewUser` sessions to the existing welcome/profile-completion flow
- Use `router.dismissTo()` / `router.replace()` correctly under Expo Router v4 to avoid stacked duplicate auth screens

### Research Insights

**Best Practices:**

- Use native provider buttons where required and avoid styling Apple’s internal label or glyph.
- Keep one shared `isAuthenticating` guard across Apple, Google, magic-link verify, and password fallback to prevent double-submits.
- Make cancellation paths silent and reversible; users cancel provider modals frequently and that is not an error state.

**Implementation Details:**

- Expo docs require adding the `expo-apple-authentication` plugin and `ios.usesAppleSignIn: true` in `mobile/app.json`.
- Google Sign-In docs require the `@react-native-google-signin/google-signin` plugin and an `iosUrlScheme` when not relying on Firebase plist setup.
- Configure Google Sign-In with the web client ID when the backend needs an `idToken`, and set the iOS client ID explicitly if not deriving it from plist configuration.
- Treat provider cancellations as a no-op UI event rather than an error banner or failure log.
- Plan native auth testing around an Expo dev client / simulator build, not Expo Go alone, for Apple and Google SDK verification.

**Accessibility Considerations:**

- Ensure the login chooser remains usable with VoiceOver and large text.
- Keep code-entry inputs compatible with iOS one-time-code autofill and paste workflows.

**Edge Cases:**

- User taps Google then Apple rapidly.
- Provider modal is dismissed and the login screen remains in a disabled/loading state.
- `isNewUser` routing stacks the welcome screen on top of auth instead of replacing it cleanly.

### Phase 5 — Biometric unlock and session resumption

Add optional Face ID / Touch ID gating for stored mobile sessions.

- Install and configure `expo-local-authentication`
- Store biometric preference locally only
- On cold start / resume:
  - if tokens exist and biometric preference is enabled, prompt biometric auth before exposing authenticated UI
  - if biometric fails or is canceled, show the auth screen without deleting valid tokens immediately
  - if token refresh fails, clear session and require re-auth
- Keep biometrics strictly as a local unlock gate for Keychain-backed sessions

### Research Insights

**Best Practices:**

- Prompt for biometrics only after the user has seen value from login, not during the first provider handshake.
- Separate “biometric unavailable,” “biometric failed,” and “biometric canceled” in UI handling.
- Keep biometric preference device-local and revocable from settings later.

**Implementation Details:**

- Gate display of cached user data until biometric success when biometric lock is enabled; only the locked gate or splash screen may render first.
- Prefer a short-lived unlock session in memory for the current app session rather than re-prompting on every screen transition.
- Re-check token freshness after biometric success, not before.

**Edge Cases:**

- Device has biometrics enrolled off, then the user disables Face ID in Settings.
- App resumes from background repeatedly and prompts too aggressively.
- Tokens are valid but biometric hardware is temporarily unavailable.

## Acceptance Criteria

### Must Fix

- [x] Add a migration for `refresh_tokens` with hashed token storage, expiry, revocation, and structured `device_info`
- [x] Implement refresh-token issuance and rotation with a 5-device active-session cap
- [x] Add `POST /api/auth/refresh` for mobile session renewal
- [x] Update `POST /api/auth/logout` to revoke mobile refresh tokens while preserving web logout behavior
- [x] Add Apple Sign-In backend verification flow and mount it in the active Express router
- [x] Update native auth routes to return `{ accessToken, refreshToken, user }` for mobile callers without breaking web cookie sessions
- [x] Update `mobile/src/lib/api.ts` and `mobile/src/lib/auth.tsx` to store and manage access + refresh tokens
- [x] Add Apple Sign-In UI and Google Sign-In UI to the mobile auth entry screen
- [x] Add magic-link request + verify flow to mobile with code-entry screen
- [x] Route new users into the welcome flow after successful native auth
- [x] Add explicit native-response detection so server routes intentionally choose cookie vs token contract
- [x] Update `mobile/app.json` with Apple and Google plugin/config requirements for iOS auth
- [x] Audit `apple_user_id` schema/index behavior and make it soft-delete-safe if needed
- [x] Define offline auth behavior: network refresh failure preserves cached read-only access, authoritative refresh rejection clears session
- [x] Add rate limiting to new Apple auth and refresh endpoints
- [x] Include an iOS dev-client verification path for native Google/Apple auth flows

### Should Fix

- [x] Add a single-flight refresh guard in the mobile API client so concurrent 401s do not trigger multiple refresh requests
- [x] Add explicit typed auth response models in `mobile/src/types/api.ts` and remove remaining auth-related `unknown` casts
- [x] Normalize device metadata capture for refresh sessions (`platform`, `deviceName`, `osVersion`, `appVersion`)
- [x] Add app foreground token-expiry checks tied to React Native app state transitions
- [x] Add biometric preference prompt after successful first login instead of burying it in settings only
- [ ] Add user-friendly error mapping for provider failures, canceled Apple/Google flows, expired codes, and suspended accounts

### Security / Correctness Requirements

- [x] Never store raw refresh tokens in PostgreSQL — store only SHA-256 hashes of opaque random values
- [x] Never store auth tokens in MMKV or AsyncStorage
- [x] Keep `sanitizeUser()` free of internal-only or privileged fields used solely for authorization/billing internals
- [x] Ensure all user-fetching auth queries rely on the canonical `USER_SELECT` shape or an equivalent single-source pattern
- [x] Preserve soft-delete and suspension checks across refresh, Apple auth, Google auth, and magic-link auth
- [x] Ensure refresh-token rotation is atomic so a replayed old refresh token fails after first use
- [ ] Validate all auth request bodies with schema-based parsing before provider verification or DB access
- [x] Ensure provider-cancel states do not emit noisy server errors or failure analytics
- [x] Apply auth-grade rate limiting consistently across all new native auth endpoints

## Technical Considerations

### Current code paths to extend

- `apps/ai-notecards/server/src/routes/auth.js`
- `apps/ai-notecards/server/src/routes/auth-google.js`
- `apps/ai-notecards/server/src/routes/auth-magic.js`
- `apps/ai-notecards/server/src/middleware/auth.js`
- `apps/ai-notecards/mobile/src/lib/api.ts`
- `apps/ai-notecards/mobile/src/lib/auth.tsx`
- `apps/ai-notecards/mobile/src/types/api.ts`
- `apps/ai-notecards/mobile/app/(auth)/...`
- `apps/ai-notecards/mobile/app.json`

### SpecFlow analysis: user flows and gaps

#### Core flows that must work

1. **First-time Apple user**
   - Tap Apple button → native credential request → backend verify → create user → issue token pair → optional welcome screen → optional biometric prompt
2. **Returning Apple user**
   - Tap Apple button → backend lookup by `apple_user_id` → issue token pair → app home
3. **Google auto-link user**
   - Existing password or magic-link account signs in with Google using same verified non-relay email → link provider → issue token pair
4. **Magic-link new user**
   - Enter email → request code → receive code → verify code → create user → token pair → welcome screen
5. **Magic-link existing user**
   - Enter email → verify code → login existing user → token pair → app home
6. **Expired access token**
   - Protected request fails → refresh path runs once → retry succeeds without user-visible logout
7. **Expired refresh token / revoked session**
   - Refresh fails → clear tokens → show auth screen
8. **Biometric-enabled return**
   - App opens → biometric prompt → success unlocks stored session → refresh if needed

#### Important edge cases to cover in the plan

- Apple cancels credential prompt
- Google returns token but no usable email
- Apple relay email collides with an existing real-email account
- Two simultaneous API calls hit expired access tokens
- User is suspended or soft-deleted between access issuance and refresh attempt
- User logs out on one device, then another device tries to refresh
- User reinstalls the app and SecureStore survives differently across environments
- Network drops during refresh rotation after old token is revoked but before client stores the new one

#### Required clarifications resolved by this plan

- **Device info format:** structured JSON, not freeform text
- **Biometric preference scope:** device-local only
- **Max active sessions:** 5 per user
- **Password visibility:** supported for legacy users but visually secondary on mobile
- **Native response signal:** `X-Client-Platform: ios-native`
- **Logout scope:** revoke only the presented mobile session
- **Offline auth behavior:** preserve cached read-only access on network failure; clear session on authoritative refresh rejection
- **Pre-biometric rendering:** only locked gate / splash, never user identity surfaces

### External research notes

- Expo SDK 55 docs require `npx expo install expo-apple-authentication` and adding the `expo-apple-authentication` plugin in `app.json`
- Expo SDK 55 docs require `ios.usesAppleSignIn: true` for iOS capability setup
- Expo docs explicitly note that Apple Sign-In is required when third-party auth is offered on iOS
- `expo-local-authentication` is appropriate for biometric gating, but the app must treat it as local device verification rather than a session issuer
- `expo-secure-store` remains the correct storage mechanism for auth tokens on iOS; keep token persistence there only

## Testing Strategy

### Backend

- [ ] Write route tests before implementation for refresh-token rotation and native/web response branching
- [ ] Route tests for native signup/login response shape
- [ ] Route tests for Google/mobile and magic-link/mobile response shape parity
- [ ] Route tests for Apple verify path: new user, existing user, relay email, suspended user, invalid token
- [ ] Route tests for refresh: valid token, expired token, revoked token, replayed old token, over-device-cap issuance
- [ ] Route tests for logout revocation behavior

### Mobile

- [ ] Write auth-provider/API tests before implementation for token-pair persistence and single-flight refresh behavior
- [x] Typecheck `mobile/` after auth response typing changes
- [ ] Add focused tests for auth reducer/provider logic if a test harness exists for mobile auth utilities
- [ ] Manual simulator checks for Apple button rendering, Google login happy path, magic-link code flow, refresh after expiry, biometric prompt, logout
- [ ] Verify Apple and Google native auth flows through an Expo dev client or simulator build, not Expo Go alone

### Regression

- [ ] Verify web login/signup/Google/magic-link continue working with cookie sessions unchanged
- [ ] Verify `/api/auth/me` still supports both cookie and Bearer token callers
- [ ] Verify soft-deleted and suspended accounts remain blocked across all auth methods
- [ ] Verify provider cancellation paths do not emit server errors or noisy client error banners

## Dependencies and Risks

### Dependencies

- Expo packages: `expo-apple-authentication`, `expo-local-authentication`
- Google native SDK integration: `@react-native-google-signin/google-signin`
- Expo dev client support for testing native provider flows
- Existing Apple verification dependency or approved replacement already present in server dependencies
- New database migration for refresh tokens
- Explicit iOS app config updates for Apple capability and Google URL scheme

### Risks

- Splitting web and native auth response contracts can create accidental divergence if route helpers are not centralized
- Refresh rotation can strand sessions if token replacement is not atomic on both server and client sides
- Apple auth capability misconfiguration in Expo app config will block iOS testing even if code is correct
- Sanitized user payload drift can silently break the web client or leak internal fields if not audited carefully
- Re-auth loops can appear if biometric gating and auth hydration do not share a clear state machine
- Silent web regressions can slip in if cookie responses change shape while adding native payloads

## Implementation Order

1. Add refresh-token migration and server-side session helpers
2. Update native auth routes to issue token pairs while preserving web cookie behavior
3. Add Apple Sign-In backend route and account-linking rules
4. Refactor mobile API/auth state for token-pair lifecycle
5. Build mobile auth screens and provider integrations
6. Add biometric unlock and app-resume refresh handling
7. Run backend + mobile regression verification

## References

- `apps/ai-notecards/docs/brainstorms/2026-03-15-ios-auth-and-apple-sign-in-brainstorm.md`
- `apps/ai-notecards/docs/solutions/auth-implementation-guide.md`
- `apps/ai-notecards/docs/solutions/feature-patterns/account-settings-experience.md`
- `apps/ai-notecards/docs/solutions/feature-patterns/pre-launch-checklist.md`
- Expo SDK 55 docs: Apple Authentication, Local Authentication, SecureStore
