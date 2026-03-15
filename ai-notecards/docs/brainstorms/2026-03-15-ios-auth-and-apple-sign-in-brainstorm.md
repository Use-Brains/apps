---
date: 2026-03-15
topic: ios-auth-and-apple-sign-in
---

# iOS Auth & Apple Sign-In

## What We're Building

Native authentication for the Expo/React Native iOS app, covering three sign-in methods (Apple, Google, magic link) plus secure token storage, biometric unlock, and a token refresh mechanism for mobile. The backend already supports JWT with dual bearer/cookie auth groundwork and has `GOOGLE_IOS_CLIENT_ID` wired into the audience array. This brainstorm fills the remaining gaps: Apple Sign-In server verification, Keychain-based token persistence, refresh tokens for mobile clients, and the native login screen UX.

Apple Sign-In is mandatory because we offer Google Sign-In. This is not optional -- Apple will reject the app without it.

## Why This Approach

We evaluated three strategies: (A) reuse the web auth flows entirely via an in-app WebView, (B) use Expo AuthSession for all three providers, or (C) use native SDKs for Apple/Google and a custom code-entry screen for magic link. We chose option C. WebViews feel cheap and break password autofill. Expo AuthSession adds unnecessary redirect hops for Apple/Google when native SDKs exist. Native SDKs give the smoothest UX and Apple specifically mandates using `ASAuthorizationAppleIDProvider` for the native button.

For token management, we chose to add refresh tokens rather than extend JWT expiry. Long-lived JWTs are a security liability on mobile where tokens live in persistent storage. Short access tokens (15 min) plus a long-lived refresh token (30 days) gives us revocation granularity without constant re-authentication.

## Feature Details

### 1. Apple Sign-In Implementation

**Problem:** Apple requires Sign in with Apple when any third-party sign-in (Google) is offered. The backend has no Apple identity token verification for the new JWT-based flow (the old `auth-apple.js` uses a nonce-based approach that predates the auth revamp).

**Approach:**
- Use `expo-apple-authentication` for the native credential request. It returns an `identityToken` (JWT signed by Apple) and an `authorizationCode`.
- New backend endpoint `POST /api/auth-apple/native` accepts `{ identityToken, fullName }`. Verifies the JWT against Apple's public keys using `apple-signin-auth` (already a dependency). Extracts `sub` (stable Apple User ID) and `email` (real or relay).
- Database: add `apple_user_id` column (already exists in schema). For new users, store the email as-is -- relay emails like `abc@privaterelay.appleid.com` are functional for transactional email; they just limit marketing.
- Auto-link logic: if email matches an existing non-Apple account and it is NOT a relay email, link by setting `apple_user_id`. If it is a relay email, create a new account (no linking on relay addresses -- we cannot verify identity).
- Apple only sends the user's name on the FIRST authorization. The client must capture `fullName` from the credential and send it immediately. If missed, the user sets their display name on the welcome screen.

### 2. Keychain Token Storage

**Problem:** Web uses httpOnly cookies managed by the browser. iOS has no equivalent -- tokens must be explicitly stored and attached to requests.

**Approach:**
- Use `expo-secure-store` (wraps iOS Keychain). Store two values: `access_token` (short-lived JWT) and `refresh_token` (long-lived opaque token).
- `expo-secure-store` encrypts at rest using the Keychain's `kSecAttrAccessibleAfterFirstUnlock` accessibility level, meaning tokens survive app backgrounding and device restarts but are wiped on device reset.
- On app launch, read tokens from SecureStore. If `access_token` is expired, use `refresh_token` to get a new pair. If refresh fails, send user to login.
- Never store tokens in AsyncStorage, MMKV, or any unencrypted store.

### 3. Token Refresh Strategy

**Problem:** Current JWT expiry is 7 days with no refresh tokens. On mobile, this means users re-authenticate weekly. Too short for a study app where daily streaks matter. Extending the JWT to 90 days is risky -- a leaked token is valid for months with no revocation path besides `token_revoked_at` (which requires a full DB check on every request).

**Approach:**
- Add a `refresh_tokens` table: `id (UUID)`, `user_id`, `token_hash (SHA-256)`, `expires_at (30 days)`, `created_at`, `revoked_at`, `device_info (text)`.
- New endpoint `POST /api/auth/refresh` accepts `{ refreshToken }`, validates against `refresh_tokens` table, issues new access token (15 min expiry) + new refresh token (rotation). Old refresh token is immediately revoked.
- Access tokens stay stateless (no DB lookup). Refresh tokens require a DB check (acceptable since it happens at most every 15 minutes).
- Web clients continue using 7-day httpOnly cookie JWT -- no change. Refresh tokens are mobile-only.
- The `authenticate` middleware gains a second path: check `Authorization: Bearer <token>` header first, fall back to cookie. This is a small change (the context mentions `/me` already supports this, but the actual middleware does not yet -- we add it).
- Token rotation on every refresh prevents replay attacks if a refresh token is intercepted.

### 4. Native Auth Flow UX

**Problem:** The login screen must satisfy Apple's Human Interface Guidelines (specific button styling, equal prominence) while optimizing for email collection (Google first).

**Approach:**
- Same layout as the auth revamp brainstorm: Google on top, Apple below, equal size and weight. Magic link below a divider.
- Apple Sign-In button: use `expo-apple-authentication`'s `AppleAuthenticationButton` component which renders Apple's mandated native button (black/white, specific corner radius, "Sign in with Apple" text). We cannot customize this button's internals -- Apple enforces the design.
- Google Sign-In button: use `@react-native-google-signin/google-signin` with the iOS client ID (`GOOGLE_IOS_CLIENT_ID`). Renders a custom-styled button matching Apple's button dimensions.
- Magic link: custom email input field + "Continue with Email" button. Navigates to a 6-digit code entry screen (same as web flow). The code input uses `textContentType="oneTimeCode"` to trigger iOS autofill from SMS/email notifications.
- No password fields anywhere. Backend password endpoints remain intact but are not surfaced.
- New users see the Welcome screen (display name entry) after first sign-in, same as web.

### 5. Biometric Authentication

**Problem:** Returning users should not need to tap through the full login screen every time they open the app.

**Approach:**
- After successful login, prompt "Enable Face ID for quick sign-in?" (one-time, dismissable). Store preference in `expo-secure-store` as `biometric_enabled=true`.
- On subsequent app opens: if biometric is enabled and tokens exist in Keychain, prompt Face ID/Touch ID via `expo-local-authentication`. On success, proceed directly to the app (using stored tokens). On failure or cancel, show the full login screen.
- Biometrics gate access to the stored tokens -- they do not replace authentication. If tokens are expired and refresh fails, the user must fully re-authenticate regardless of biometrics.
- This is optional, not mandatory. Users who decline get the normal token-based auto-login (tokens in Keychain, no biometric prompt) until tokens expire.

### 6. Session Persistence

**Problem:** Users study in short bursts. The app will be backgrounded, force-quit, and reopened frequently. Token expiry and refresh must handle these transitions without data loss.

**Approach:**
- App foreground: check access token expiry. If expired, refresh silently in the background. Show a loading spinner only if refresh takes >1s.
- App backgrounded: no action needed. Tokens persist in Keychain.
- Force quit + reopen: same as foreground -- read from Keychain, refresh if needed.
- Network offline: allow the app to open with cached user data. Queue any writes. Refresh tokens when connectivity returns.
- Logout: clear both tokens from Keychain, revoke refresh token server-side (`POST /api/auth/logout` extended to accept and revoke refresh token), navigate to login screen.
- Token expiry edge case: if a user opens the app after 30+ days (refresh token expired), they see the login screen. This is acceptable -- 30 days of inactivity means re-authentication is reasonable.

## Key Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Apple Sign-In SDK | `expo-apple-authentication` | Native button required by Apple, Expo wrapper is stable and well-maintained |
| Google Sign-In SDK | `@react-native-google-signin/google-signin` | Native flow, no WebView redirect, works with existing `GOOGLE_IOS_CLIENT_ID` |
| Token storage | `expo-secure-store` (Keychain) | Encrypted at rest, survives app restarts, standard for sensitive data on iOS |
| Access token expiry | 15 minutes | Short enough to limit blast radius of leaked token, long enough to avoid constant refreshes |
| Refresh token expiry | 30 days | Covers typical study patterns without indefinite token life |
| Refresh token rotation | Yes, on every use | Prevents replay attacks from intercepted refresh tokens |
| Biometric auth | Optional, Face ID/Touch ID | Convenience feature, not security feature -- gates Keychain access, does not replace JWT |
| Apple relay emails | Accept as-is, no auto-link | Relay emails work for transactional email; linking is unsafe without verified real email |
| Web auth changes | Minimal -- add Bearer header support to `authenticate` middleware | Web keeps cookie flow unchanged; mobile sends Bearer header |
| Refresh tokens for web | No | Web uses httpOnly cookies with 7-day expiry, no need for refresh complexity |

## Open Questions

- Should the refresh token `device_info` field be structured (device model, OS version) or freeform? Structured enables "manage sessions" UI later.
- Do we need a maximum active refresh tokens per user limit (e.g., 5 devices) to prevent token accumulation?
- Should biometric preference sync to the server or stay device-local? Device-local is simpler but means the preference does not follow the user to a new device.

## Scope Boundaries

**In scope:**
- Apple Sign-In native flow + backend endpoint
- Google Sign-In native SDK integration (reuses existing backend)
- Magic link 6-digit code flow on native
- `expo-secure-store` for Keychain token storage
- Refresh token table, endpoint, and rotation logic
- Bearer token support in `authenticate` middleware
- Biometric unlock (optional, Face ID / Touch ID)
- Session persistence across app lifecycle events

**Out of scope:**
- Account linking UI (link Apple + Google to same account) -- future feature
- Multi-device session management UI ("signed in on 3 devices") -- future feature
- Push notification-based magic link delivery -- codes via email only
- Android auth (this brainstorm is iOS-only; Android follows the same patterns minus Apple Sign-In)
- Password reset flow on mobile (passwords are hidden from UI)
- Two-factor authentication / TOTP

## Next Steps

-> `/workflows:plan` for implementation details
