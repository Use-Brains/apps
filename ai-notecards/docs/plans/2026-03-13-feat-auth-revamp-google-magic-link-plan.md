---
title: 'feat: Auth revamp — Google Sign-In + Magic Link + Apple'
type: feat
status: active
date: 2026-03-13
origin: docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md
deepened: 2026-03-13
---

<!-- FINISHED -->

# Auth Revamp: Google Sign-In + Magic Link + Apple

## Enhancement Summary

**Deepened on:** 2026-03-13
**Technical review:** 2026-03-13 (8 agents, 18 findings → 12 incorporated)
**Research agents used:** Security Sentinel, Performance Oracle, Architecture Strategist, Code Simplicity Reviewer, Data Integrity Guardian, Frontend Races Reviewer, Spec Flow Analyzer, Learnings Researcher

### Key Improvements

1. **Critical security fix**: Attempts counter is broken by design — lookup by `email + code_hash` means wrong guesses never match a row, so attempts never increment. Must lookup by email first, then compare hash.
2. **Atomic verify with UPDATE...RETURNING**: Eliminates race condition where two concurrent verify requests could both succeed on the same code.
3. **Invalidate old codes on new request**: Multiple active codes multiply the brute-force attack surface. Each new `/request` should invalidate prior codes for that email.
4. **Return HTTP response before sending email**: Drops `/request` latency from ~300-600ms to ~20-50ms.
5. **Email enumeration via Google 409**: The 409 response naming the user's actual provider leaks account existence — use a generic "email already in use" message instead.
6. **Auto-submit race condition on web**: Typing the 6th digit triggers auto-submit, but rapid typing or paste can fire multiple concurrent requests. Use `useRef` guard (not React state — batched renders miss concurrent calls).
7. **`email_verified` migration scoped correctly**: Blanket `UPDATE users SET email_verified = true` is wrong for Apple relay emails — scope to password users only.
8. **Suspended user check on all auth routes**: New Google and magic link routes must check `user.suspended` — matching existing Apple/password pattern. Without this, banned users regain access.
9. **Auto-link safety**: Never auto-link to Apple relay emails (`*@privaterelay.appleid.com` or `apple-*@private.relay`). Require Google `email_verified` claim before auto-linking.
10. **HMAC-SHA256 for code hashing**: Plain SHA-256 on a 900K keyspace is trivially reversible with DB access. Use `HMAC(server_secret, code)` instead.
11. **Consistent auto-link across all providers**: Apple sign-in updated to auto-link on email match (like Google), eliminating the confusing 409 asymmetry.
12. **Partial unique index for `google_user_id`**: Plain `UNIQUE` constraint blocks re-registration after soft-delete. Use `UNIQUE WHERE deleted_at IS NULL`.

### New Considerations Discovered

- GoogleSignIn-iOS requires both `GoogleSignIn` + `GoogleSignInSwift` SPM products for SwiftUI
- Must call `refreshTokensIfNeeded()` before accessing `idToken` on iOS (it may be expired)
- `GIDServerClientID` must be set in Info.plist so the ID token's audience matches the web client ID (for server-side verification)
- Never instantiate `Resend` or `OAuth2Client` at module top level in ESM — env vars are undefined due to import hoisting
- Use `X-Entity-Ref-ID` header with Resend to prevent Gmail from grouping OTP emails into conversations
- Put the 6-digit code in the email subject line for mobile notification visibility
- `@MainActor` isolation required on `AuthManager` (iOS) — UI state mutations from async auth calls must be main-thread
- `checkAuth()` in `init()` must complete before showing login buttons — otherwise races with user-initiated auth
- All auth methods (Google, Apple, magic link) must share a single `isAuthenticating` guard — including the existing Apple flow
- Account deletion must `DELETE FROM magic_link_codes` for the user's email (PII cleanup)
- Emails must be `.toLowerCase()`'d in magic link `/request` and `/verify` for consistent matching

---

## Overview

Replace the current email/password + Apple sign-in flow with three streamlined auth methods: Google Sign-In, Sign in with Apple (existing), and passwordless magic link (6-digit email code). The goal is to maximize real email collection for direct marketing outside the iOS app, enabling Stripe-direct purchases that bypass Apple's 30% fee. Password UI is removed from both iOS and web clients; backend password endpoints remain intact for future use.

## Problem Statement / Motivation

- **Email collection**: Sign in with Apple's "Hide My Email" gives relay addresses, limiting direct outreach. Google Sign-In always provides the real email.
- **Conversion friction**: Passwords are the #1 signup abandonment reason. Magic link eliminates this entirely.
- **"Big app feel"**: Three auth options (Google, Apple, Email) matches industry standard for productivity/study apps (Quizlet, Notion, Duolingo pattern).
- **Revenue strategy**: Collecting real emails enables marketing users to purchase directly via Stripe, avoiding Apple's 30% commission.

(See brainstorm: `docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md`)

## Proposed Solution

### Login Screen Layout (iOS + Web)

```
┌─────────────────────────────┐
│                             │
│      [App Icon]             │
│      AI Notecards           │
│      Generate flashcards    │
│                             │
│  [ G  Continue with Google] │  ← top position (conversion edge)
│  [   Continue with Apple ] │  ← same size/prominence (Apple guideline)
│                             │
│  ──────────  or  ────────── │
│                             │
│  [ Email address field    ] │
│  [ Continue with Email    ] │  ← triggers magic link flow
│                             │
└─────────────────────────────┘
```

- Google and Apple buttons are **equal size and visual weight** (Apple requires this for App Review)
- Google is first (top position = subtle conversion edge, passes App Review)
- Web client shows Google + Magic Link only (no Apple on web — avoids Apple JS SDK complexity for v1)
- Email/magic link below the divider catches users without Google/Apple preference

### Magic Link Flow

```
User enters email → POST /api/auth/magic-link/request
    → Backend invalidates any existing codes for this email
    → Generates 6-digit code (crypto.randomInt)
    → Stores HMAC-SHA256 hash in magic_link_codes table (10-min expiry)
    → Returns { ok: true } immediately
    → Sends code via Resend asynchronously (fire-and-forget)

User enters code → POST /api/auth/magic-link/verify
    → Backend looks up most recent unexpired, unused code for email
    → Checks attempts >= 5 → reject if exceeded (before hash comparison)
    → Increments attempts counter
    → Compares HMAC-SHA256 hash of input against stored hash
    → If match: atomic UPDATE...RETURNING to set used_at (prevents race)
    → If valid: create account (if new) or login (if existing)
    → Returns { token, user, isNewUser }
    → If isNewUser: client shows display name prompt
```

### Research Insights: Magic Link Security

**Critical fix — attempts counter design:**
The original plan looked up codes by `email + code_hash` to check attempts. This is broken: if the user enters a wrong code, the hash won't match any row, so `attempts` never increments. Instead:

1. Lookup by email only (most recent unexpired, unused code)
2. Check `attempts >= 5` → reject immediately
3. Increment `attempts` unconditionally
4. Then compare `code_hash`

**Invalidate old codes on new request:**
If a user requests 3 codes in 10 minutes, all 3 are valid. This triples the brute-force surface (3 × 10^6 possibilities instead of 10^6). Fix: `UPDATE magic_link_codes SET used_at = NOW() WHERE email = $1 AND used_at IS NULL` before inserting a new code.

**Atomic verify with UPDATE...RETURNING:**

```sql
UPDATE magic_link_codes
SET used_at = NOW()
WHERE id = $1 AND used_at IS NULL
RETURNING id;
```

If this returns 0 rows, another request already consumed the code. This eliminates the TOCTOU race between SELECT and UPDATE.

### Account Identity Resolution

**Magic link is a universal auth method.** If a user signed up via Google or Apple, they can also sign in via magic link using the same email (since magic link proves email ownership). This is intentional — it acts as a recovery path and simplifies the mental model.

**Security note:** This means email inbox access = account access for OAuth-only accounts. This is an acceptable trade-off — it's the same trust model as "forgot password" flows, and magic link proves email ownership which is the foundation of account identity.

**Google/Apple are provider-specific.** Lookup by `google_user_id` / `apple_user_id` first, then fall back to email check. On email collision with a different provider, return a generic error: `"An account with this email already exists. Try signing in with a different method."` (Do NOT name the specific provider — this leaks account information and enables email enumeration.)

**Existing password users** can sign in via magic link seamlessly (email lookup). No migration needed — they just use the new flow.

### Research Insights: Account Linking Simplification

The simplicity reviewer recommends **auto-linking accounts on email match** instead of returning 409 errors. When a Google user signs in via magic link (or vice versa), link the provider to the existing account automatically — both methods prove email ownership. This eliminates confusing "try a different method" errors and is what users expect from modern apps.

**Implementation:** On Google sign-in, if `google_user_id` lookup fails but email matches an existing user, set `google_user_id` on that user and proceed with login. Same logic applies: magic link proves email → link to existing account. Apply the same pattern to Apple sign-in (`auth-apple.js`) — replace the 409 on email collision with auto-link (`SET apple_user_id` on the existing user).

**Auto-link safety rules:**

- **Require `email_verified: true`** from the Google ID token payload before auto-linking. Do not auto-link if Google reports the email as unverified.
- **Never auto-link to Apple relay emails.** Block auto-link when the target account's email matches `*@privaterelay.appleid.com` or the synthetic `apple-*@private.relay` pattern. These are not real addresses and cannot be "proven owned" by a third-party provider.
- When auto-linking, also set `email_verified = true` on the existing user (the provider proved ownership) and update `display_name` if currently NULL (Google provides a name).

## Technical Approach

### Phase 1: Database Migration + Backend Core

**New migration: `server/src/db/migrations/006_auth_revamp.sql`**

```sql
-- Google Sign-In support (partial unique: allows re-registration after soft-delete)
ALTER TABLE users ADD COLUMN google_user_id TEXT;
CREATE UNIQUE INDEX idx_users_google_user_id
    ON users (google_user_id) WHERE deleted_at IS NULL;

-- Magic link codes table
CREATE TABLE magic_link_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,          -- HMAC-SHA256(server_secret, code)
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,  -- failed verify attempts (incremented BEFORE hash comparison)
    used_at TIMESTAMPTZ,              -- set on successful verification
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (attempts >= 0)
);

CREATE INDEX idx_magic_link_codes_email_active
    ON magic_link_codes (email, created_at DESC)
    WHERE used_at IS NULL;

-- Set email_verified = true for existing PASSWORD users only
-- Apple relay users may not have real emails — don't blanket mark as verified
UPDATE users SET email_verified = true
    WHERE deleted_at IS NULL
    AND password_hash IS NOT NULL;
```

### Research Insights: Data Migration Safety

**Scoped email_verified UPDATE:** The original plan's `UPDATE users SET email_verified = true WHERE deleted_at IS NULL` is incorrect — Apple "Hide My Email" users have relay addresses (`xyz@privaterelay.appleid.com`) that aren't truly "verified" in the direct-contact sense. Scope to password users only (`WHERE password_hash IS NOT NULL`), since they proved email ownership during signup.

**Partial unique index for google_user_id:** A plain `UNIQUE` constraint blocks re-registration after soft-delete (the deleted row still holds the value). Use `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` instead — this enforces uniqueness among active users while preserving the ID on deleted records for audit. Verify the same pattern for `apple_user_id` (migration 005 may have the same bug).

**NOT NULL constraints on `attempts` and `created_at`:** Without `NOT NULL`, an explicit NULL insert bypasses the `attempts >= 5` security check (`NULL >= 5` evaluates to NULL/false, silently skipping the rate limit). Always use `NOT NULL DEFAULT` for security-critical columns.

**Tasks:**

- [x] Create `005_auth_revamp.sql` with above schema (numbered 005 — main branch has 001-004)
- [x] Verify `password_hash` nullable — added `ALTER COLUMN password_hash DROP NOT NULL`
- [x] Add `google_user_id` to `USER_SELECT` in `server/src/routes/auth.js`
- [x] Verify `sanitizeUser()` does NOT include `google_user_id` (uses whitelist — confirmed)
- [ ] Update account deletion in `server/src/routes/auth-account.js`: add `google_user_id = NULL` to the existing PII scrub UPDATE + `DELETE FROM magic_link_codes WHERE email = (SELECT email FROM users WHERE id = $1)`
- [ ] Update `auth-apple.js` to auto-link on email match instead of returning 409 (set `apple_user_id` on existing user, matching Google auto-link pattern)
- [ ] Check `apple_user_id` UNIQUE constraint in migration 005 — if it's a plain UNIQUE (not partial), fix it to use `WHERE deleted_at IS NULL`
- [x] Add `HMAC_SECRET` to env vars — reuses `JWT_SECRET` for HMAC-SHA256 code hashing

**New env vars (add to `server/.env.example`):**

- `RESEND_API_KEY` — Resend API key for sending magic link emails
- `GOOGLE_CLIENT_ID` — Google OAuth Web client ID (used by backend for token verification AND by web client)
- `GOOGLE_IOS_CLIENT_ID` — Google OAuth iOS client ID (optional, for audience array validation)

### Research Insights: ESM Import Hoisting

**Critical: Never instantiate SDK clients at module top level in ESM files.**

```javascript
// BAD — env vars are undefined when ESM imports are hoisted
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY); // undefined!

// GOOD — lazy initialization
let resend;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
```

Same applies to `google-auth-library`'s `OAuth2Client`. Use lazy initialization or factory functions for both.

**Add env var validation at server startup** in the entry point:

```javascript
const required = ['RESEND_API_KEY', 'GOOGLE_CLIENT_ID'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

**New npm packages:**

- `resend` — transactional email
- `google-auth-library` — Google ID token verification

#### New route: `server/src/routes/auth-magic.js`

Mounted at `/api/auth/magic-link`

| Method | Path       | Description                    |
| ------ | ---------- | ------------------------------ |
| POST   | `/request` | Generate code, send email      |
| POST   | `/verify`  | Verify code, login/create user |

**`POST /request` logic:**

1. Validate email format, normalize with `.toLowerCase()`
2. Rate limit: 10/IP/15min (DB-level attempts counter is the primary brute-force defense)
3. **Invalidate existing codes:** `UPDATE magic_link_codes SET used_at = NOW() WHERE email = $1 AND used_at IS NULL`
4. Generate code with `crypto.randomInt(100000, 999999)`
5. Store HMAC-SHA256 hash with 10-minute expiry
6. **Return `{ ok: true }` immediately** (before sending email)
7. **Fire-and-forget email send** via Resend — log errors but don't block response
8. Return same response regardless of whether email exists (prevents enumeration)

### Research Insights: Performance — Async Email Send

**Return response before sending email.** The Resend API call takes 300-600ms. The user doesn't need to wait for email delivery confirmation — they're navigating to the code entry screen anyway.

```javascript
// Return immediately
res.json({ ok: true });

// Fire-and-forget (log errors, don't block)
sendMagicLinkCode(email, code).catch(err => {
  console.error('Failed to send magic link email:', err);
});
```

This drops perceived latency from ~300-600ms to ~20-50ms.

**`POST /verify` logic:**

1. Rate limit: 10/IP/15min. Normalize email with `.toLowerCase()`
2. Lookup most recent unexpired, unused code for this email (by email only, NOT by hash)
3. If no code found: return `AUTH_MAGIC_CODE_EXPIRED`
4. If `attempts >= 5`: invalidate code (`SET used_at = NOW()`), return `AUTH_MAGIC_CODE_EXPIRED`
5. Increment attempts: `UPDATE magic_link_codes SET attempts = attempts + 1 WHERE id = $1`
6. HMAC-SHA256 hash user input (with server secret), compare against stored `code_hash`
7. If no match: return `AUTH_MAGIC_CODE_INVALID`
8. If match: atomic `UPDATE magic_link_codes SET used_at = NOW() WHERE id = $1 AND used_at IS NULL RETURNING id`
   - If 0 rows returned: another request consumed it (race condition) → return error
9. Lookup user by email. **If user exists and `user.suspended`: return 403 `AUTH_ACCOUNT_SUSPENDED`**
10. Set `email_verified = true` on user
11. If no user exists: create account with `plan: 'trial'`, `trial_ends_at: NOW() + 7 days`
12. Return `{ token, user, isNewUser }` (isNewUser drives display name prompt)

**Opportunistic cleanup in `/request` handler:** Before inserting a new code, delete codes expired > 1 hour ago for this email. This keeps the table clean without needing a cron job.

```sql
DELETE FROM magic_link_codes WHERE email = $1 AND expires_at < NOW() - INTERVAL '1 hour';
```

**New error codes** (add to `server/src/constants/errors.js` + `ios/AINotecards/Models/APIError.swift`):

- `AUTH_MAGIC_CODE_INVALID` — wrong code
- `AUTH_MAGIC_CODE_EXPIRED` — code expired or max attempts exceeded
- `AUTH_MAGIC_RATE_LIMITED` — too many requests

#### New route: `server/src/routes/auth-google.js`

Mounted at `/api/auth/google`

| Method | Path | Description                               |
| ------ | ---- | ----------------------------------------- |
| POST   | `/`  | Verify Google ID token, login/create user |

**`POST /` logic:**

1. Receive `{ idToken }` from client
2. Verify with `google-auth-library` `verifyIdToken()` against allowed audience array (`[GOOGLE_CLIENT_ID, GOOGLE_IOS_CLIENT_ID]`)
3. Extract `sub`, `email`, `name`, `picture`, `email_verified` from payload
4. Lookup by `google_user_id = sub`
5. If found: **check `user.suspended` → return 403 `AUTH_ACCOUNT_SUSPENDED` if true**. Otherwise login, return `{ token, user, isNewUser: false }`
6. If not found: check email
   - If email matches existing user:
     - **Check `user.suspended` → return 403 if true**
     - **Check auto-link safety:** require Google `email_verified === true` AND target email must NOT match `*@privaterelay.appleid.com` or `apple-*@private.relay`
     - If safe: **auto-link** — set `google_user_id` on existing user, set `email_verified = true`, update `display_name` if NULL. Login.
     - If unsafe: return generic error `"An account with this email already exists. Try signing in with a different method."`
   - If email not found: create account with Google profile data, `email_verified: true`, `plan: 'trial'`
7. Return `{ token, user, isNewUser }` — return the actual boolean (true for new accounts). Client decides to show display name prompt based on `user.displayName === null`, not `isNewUser`

### Research Insights: HMAC-SHA256 Code Hashing

**Why not plain SHA-256:** The code space is only 900,000 values (100000–999999). An attacker with database read access (SQL injection, backup leak, compromised dashboard) can precompute all 900K SHA-256 hashes in under a second and reverse any stored hash. HMAC-SHA256 with a server-side secret makes precomputation infeasible even with DB access.

```javascript
import { createHmac } from 'crypto';
function hashCode(code) {
  return createHmac('sha256', process.env.JWT_SECRET) // reuse existing secret
    .update(String(code))
    .digest('hex');
}
```

#### New service: `server/src/services/email.js`

Thin wrapper around Resend SDK:

- `sendMagicLinkCode(email, code)` — sends the 6-digit code email
- Plain text + simple HTML template (app name, code, expiry note)
- Graceful error handling: log failures, return boolean success
- Use lazy initialization for Resend client (ESM hoisting)

### Research Insights: Resend Best Practices

**Sender domain:** Use a subdomain `mail.ainotecards.com` instead of the root domain. This isolates transactional email reputation from marketing email and prevents deliverability issues if one type gets flagged.

**Prevent Gmail conversation grouping:** Add `X-Entity-Ref-ID` header with a unique value per email. Without this, Gmail groups all OTP emails into a single conversation thread, making it hard to find the latest code.

```javascript
await resend.emails.send({
  from: 'AI Notecards <noreply@mail.ainotecards.com>',
  to: email,
  subject: `${code} is your AI Notecards code`, // Code in subject for mobile notifications
  headers: {
    'X-Entity-Ref-ID': crypto.randomUUID() // Prevent Gmail conversation grouping
  },
  text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
  html: `...`
});
```

**Put the code in the subject line.** Mobile users see the subject in their notification banner — putting the code there means they can enter it without opening the email.

**Use test addresses during development:** Resend provides `onboarding@resend.dev` for testing. In dev mode, log the code to console and skip actual email sending.

#### Rate limiting

Use `express-rate-limit` with in-memory store (sufficient for indie scale). Apply per-route in each route file (consistent with existing auth route patterns).

- Magic link `/request`: 10/IP/15min
- Magic link `/verify`: 10/IP/15min
- Google `/auth/google`: 20/IP/15min
- **Existing endpoints** (add as part of this work): `/auth/login` 10/IP/15min, `/auth/signup` 5/IP/15min

The DB-level `attempts` counter (max 5 per code) is the **primary** brute-force defense — it persists across restarts and is per-code, not per-IP. The IP rate limiter is a secondary layer. In-memory rate limiting resets on server restart — acceptable for indie scale, document as known limitation.

### Phase 2: iOS Client

**New Swift Package dependency:**

- `GoogleSignIn-iOS` (SPM: `https://github.com/google/GoogleSignIn-iOS`) — v9.0.0+
- **Must add both `GoogleSignIn` AND `GoogleSignInSwift` products** — `GoogleSignInSwift` provides the SwiftUI `GoogleSignInButton` component

### Research Insights: GoogleSignIn-iOS SDK

**Critical configuration:**

- `GIDServerClientID` must be set in Info.plist — without it, the `idToken` from `signIn(withPresenting:)` will have the iOS client ID as audience instead of the web client ID, causing server-side `verifyIdToken()` to reject it
- After `signIn(withPresenting:)`, call `result.user.refreshTokensIfNeeded()` before accessing `idToken` — the token may be expired if the user was previously signed in
- v9.1.0 supports Swift 6 strict concurrency — use `@MainActor` annotations

**SPM dependency in project.yml:**

```yaml
packages:
  GoogleSignIn-iOS:
    url: https://github.com/google/GoogleSignIn-iOS
    from: '9.0.0'
targets:
  AINotecards:
    dependencies:
      - package: GoogleSignIn-iOS
        product: GoogleSignIn
      - package: GoogleSignIn-iOS
        product: GoogleSignInSwift
```

**Info.plist additions:**

- `GIDClientID` — iOS OAuth client ID
- `GIDServerClientID` — Web OAuth client ID (so ID tokens have web audience)
- New `CFBundleURLSchemes` entry for reversed Google client ID (e.g., `com.googleusercontent.apps.123456`)

**Files to modify:**

| File                                         | Changes                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ios/project.yml`                            | Add GoogleSignIn-iOS SPM dependency (both products)                                                                                                                                                                                                                    |
| `ios/AINotecards/Info.plist`                 | Add Google client ID keys + URL scheme                                                                                                                                                                                                                                 |
| `ios/AINotecards/AINotecards.swift`          | Add `GIDSignIn.sharedInstance.handle(url)` in `handleURL`                                                                                                                                                                                                              |
| `ios/AINotecards/Services/AuthManager.swift` | Add `signInWithGoogle()`, `requestMagicLink(email:)`, `verifyMagicLink(email:code:)` methods. **Mark class `@MainActor`**. Add `isCheckingSession` state. Retrofit `signInWithApple` to use shared `isAuthenticating` guard. Add `isNewUser` to `AuthResponse` struct. |
| `ios/AINotecards/Models/APIError.swift`      | Add new error codes                                                                                                                                                                                                                                                    |
| `ios/AINotecards/Views/Auth/LoginView.swift` | Full rewrite: Google button, Apple button, email field + magic link                                                                                                                                                                                                    |

**Files to create:**

| File                                                     | Purpose                                                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ios/AINotecards/Views/Auth/MagicLinkCodeView.swift`     | 6-digit code entry screen with `.textContentType(.oneTimeCode)`, `keyboardType(.numberPad)`, 60-second resend cooldown |
| `ios/AINotecards/Views/Auth/DisplayNamePromptView.swift` | Post-signup display name entry (shown when `isNewUser: true` and `displayName` is nil)                                 |

**Files to remove from navigation (keep files):**

- `ios/AINotecards/Views/Auth/SignupView.swift` — no longer navigated to (unified sign-in/sign-up)

### Research Insights: iOS Frontend Safety

**`@MainActor` on AuthManager:** All auth methods (`signInWithGoogle`, `requestMagicLink`, `verifyMagicLink`) mutate `@Published`/`@Observable` state that drives UI. Without `@MainActor`, these mutations can happen on background threads, causing UI glitches or crashes. Mark the entire `AuthManager` class `@MainActor`.

**Block login UI until session check resolves:** The existing `init()` launches a fire-and-forget `Task { await checkAuth() }`. If the user taps Google before `checkAuth()` finishes, two auth operations race — the session check can overwrite `currentUser` mid-Google-flow. Fix: add a `isCheckingSession` state that starts `true` and becomes `false` when `checkAuth()` completes. The login screen should show a loading state (not interactive auth buttons) until `isCheckingSession` is false.

**Single `isAuthenticating` guard across ALL auth methods:** Add a single boolean guard that ALL auth methods share — including the existing `signInWithApple`. The existing Apple flow does NOT check `isAuthenticating`, so a user who taps Google then quickly taps Apple will have both running concurrently. Retrofit Apple to use the same guard.

```swift
@MainActor
@Observable
class AuthManager {
    private(set) var isCheckingSession = true   // blocks login UI until resolved
    private(set) var isAuthenticating = false    // shared guard for ALL auth methods

    init() {
        if KeychainManager.readString(key: Constants.Keychain.tokenKey) != nil {
            Task {
                await checkAuth()
                isCheckingSession = false
            }
        } else {
            isCheckingSession = false
        }
    }

    func signInWithGoogle(presenting: UIViewController) async {
        guard !isAuthenticating else { return }
        isAuthenticating = true
        defer { isAuthenticating = false }
        // ...
    }

    func signInWithApple(...) async {           // RETROFIT existing method
        guard !isAuthenticating else { return }
        isAuthenticating = true
        defer { isAuthenticating = false }
        // ... existing SIWA flow
    }
}
```

**In LoginView:** disable all auth buttons when `authManager.isCheckingSession || authManager.isAuthenticating`.

**Login flow changes:**

1. LoginView shows Google button (via `GoogleSignInButton`), Apple button (existing `SignInWithAppleButton`), email field + "Continue" button
2. Google: `GIDSignIn.sharedInstance.signIn(withPresenting:)` → `refreshTokensIfNeeded()` → send `idToken` to `POST /api/auth/google` → store JWT → dashboard
3. Apple: existing SIWA flow (no changes)
4. Email: send email to `POST /api/auth/magic-link/request` → navigate to `MagicLinkCodeView` → user enters code → `POST /api/auth/magic-link/verify` → if `isNewUser` and no `displayName`: show `DisplayNamePromptView` → dashboard

### Phase 3: Web Client

**New npm package:**

- `@react-oauth/google` — React wrapper for Google Identity Services

**Files to modify:**

| File                             | Changes                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `client/src/App.jsx`             | Wrap with `GoogleOAuthProvider`, add `/onboarding/display-name` route, redirect `/signup` → `/login` |
| `client/src/pages/Login.jsx`     | Full rewrite: Google button, email field + magic link. No Apple on web.                              |
| `client/src/lib/AuthContext.jsx` | Add `loginWithGoogle(idToken)`, `requestMagicLink(email)`, `verifyMagicLink(email, code)`            |
| `client/src/lib/api.js`          | Add `authGoogle(idToken)`, `magicLinkRequest(email)`, `magicLinkVerify(email, code)`                 |

**Files to create:**

| File                                     | Purpose                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `client/src/pages/MagicLinkCode.jsx`     | Code entry page: 6-digit input, auto-submit on 6 digits, 60-second resend cooldown |
| `client/src/pages/DisplayNamePrompt.jsx` | Post-signup display name entry                                                     |

**Files to remove from routing (keep files):**

- `client/src/pages/Signup.jsx` — redirect `/signup` to `/login`

### Research Insights: Web Frontend Race Conditions

**Auto-submit race condition (HIGH):** When the user types or pastes the 6th digit, auto-submit fires. But `setIsSubmitting(true)` is a React state update — it doesn't take effect synchronously. React batches state updates, so if two `handleChange` calls fire in the same microtask (paste can cause this), both see `isSubmitting` as `false`. **Use a ref for the guard, not state:**

```jsx
const submittingRef = useRef(false);
const [isSubmitting, setIsSubmitting] = useState(false);

const handleChange = value => {
  setCode(value);
  if (value.length === 6 && !submittingRef.current) {
    submittingRef.current = true;
    setIsSubmitting(true); // for UI disabling
    verifyCode(value).finally(() => {
      submittingRef.current = false;
      setIsSubmitting(false);
    });
  }
};
```

After a failed auto-submit, fall back to a manual "Verify" button rather than re-auto-submitting on the next keystroke.

**AuthContext needs a ref-based guard too:** All auth methods in `AuthContext.jsx` (`loginWithGoogle`, `requestMagicLink`, `verifyMagicLink`) must share a single `authInProgressRef` to prevent concurrent auth flows (e.g., user clicks Google popup then types email and hits Continue). Expose as a derived boolean for UI button disabling.

**Pass email via `location.state`, not query params:** The original plan uses `/magic-link/verify?email=...` which exposes the email in the URL bar and browser history. Use React Router's `location.state` instead. **Redirect to `/login` if email is missing** (handles page refresh or direct navigation):

```jsx
navigate('/magic-link/verify', { state: { email } });
// In MagicLinkCode.jsx:
const { email } = useLocation().state || {};
if (!email) return <Navigate to="/login" />;
```

**Web login flow:**

1. Login page shows Google button (`GoogleLogin` component), divider, email field + "Continue with Email" button
2. Google: `onSuccess` callback receives credential → `POST /api/auth/google` → set cookie → dashboard
3. Email: `POST /api/auth/magic-link/request` → navigate to `/magic-link/verify` (email in state) → user enters code → `POST /api/auth/magic-link/verify` → if `isNewUser`: redirect to `/onboarding/display-name` → dashboard

### Phase 4: Cleanup + Polish

- [ ] Regenerate Xcode project with `xcodegen generate` after updating `project.yml`
- [ ] Verify Resend domain DNS records are configured for `mail.ainotecards.com`
- [x] Add rate limiting to existing `POST /auth/login` (10/IP/15min) and `POST /auth/signup` (5/IP/15min)

## System-Wide Impact

### Interaction Graph

- `POST /api/auth/magic-link/request` → invalidate old codes → insert new code → return `{ ok: true }` → fire-and-forget `email.js:sendMagicLinkCode()` → Resend API → email delivered → user enters code
- `POST /api/auth/magic-link/verify` → lookup by email → check attempts → increment attempts → compare hash → atomic `UPDATE...RETURNING` → creates user (if new) → `setTokenCookie()` → JWT issued → client stores token
- `POST /api/auth/google` → `google-auth-library:verifyIdToken()` → Google public keys → auto-link or create user → `setTokenCookie()` → JWT issued
- All three auth methods funnel into the same JWT → `authenticate` middleware → existing route handlers. No downstream changes needed.

### Error Propagation

- Resend API failure → `sendMagicLinkCode` logs error → endpoint already returned `{ ok: true }` → user doesn't receive code → can retry after cooldown
- Google `verifyIdToken` failure → 401 returned → client shows error toast
- Rate limit hit → 429 returned → client shows "Too many attempts, try again later"

### State Lifecycle Risks

- **Partial magic link**: code generated but email fails to send → code exists in DB but user never receives it → expires after 10 min, no harm. Old codes are invalidated on next request.
- **Partial Google signup**: user created but JWT fails to sign → unlikely (JWT signing is synchronous), but user can retry
- **Concurrent verify requests**: handled by atomic `UPDATE...RETURNING` — only one request wins

### API Surface Parity

- iOS and web both get Google + magic link
- iOS additionally gets Apple (existing)
- Web does NOT get Apple in this phase (avoids Apple JS SDK complexity)
- All three share the same backend endpoints

## Acceptance Criteria

### Functional Requirements

- [ ] User can sign in with Google on iOS (GoogleSignIn SDK)
- [x] User can sign in with Google on web (@react-oauth/google)
- [ ] User can sign in with magic link on iOS (6-digit code via email)
- [x] User can sign in with magic link on web (6-digit code via email)
- [ ] Sign in with Apple continues to work on iOS (no regression)
- [x] New magic link users see display name prompt after first login
- [x] Google users get display name auto-populated from Google profile
- [x] Existing password users can sign in via magic link (email lookup)
- [x] Password login UI is removed from both clients (web done, iOS pending)
- [x] Unified sign-in/sign-up: no separate signup page needed
- [x] `email_verified` is set to `true` for magic link and Google users
- [x] `/signup` redirects to `/login` on web
- [x] Google sign-in auto-links to existing account on email match (with safety checks)
- [ ] Apple sign-in auto-links to existing account on email match (updated from 409 behavior)
- [x] Auto-link updates `email_verified` and `display_name` on existing user when appropriate

### Security Requirements

- [x] Magic link codes generated with `crypto.randomInt` (not `Math.random`)
- [x] Codes stored as HMAC-SHA256 with server secret (not plain SHA-256 — 900K keyspace is trivially reversible)
- [x] Codes expire after 10 minutes
- [x] Old codes invalidated when new code requested for same email
- [x] Attempts counter incremented BEFORE hash comparison (lookup by email, not by hash)
- [x] `attempts` and `created_at` columns are `NOT NULL` (prevents security bypass via NULL)
- [x] Max 5 failed verify attempts per code (then invalidated)
- [x] Atomic `UPDATE...RETURNING` on verify to prevent race conditions
- [x] **Suspended user check** on magic link verify and Google auth (matching existing Apple/password pattern)
- [x] Rate limiting on `/magic-link/request`: 10/IP/15min
- [x] Rate limiting on `/magic-link/verify`: 10/IP/15min
- [x] Rate limiting on existing `/auth/login`: 10/IP/15min and `/auth/signup`: 5/IP/15min
- [x] Google ID token verified server-side with `google-auth-library`
- [x] Google audience validated against allowed client ID array
- [x] Google `email_verified` claim checked before auto-linking
- [x] Auto-link blocked for Apple relay email patterns (`*@privaterelay.appleid.com`, `apple-*@private.relay`)
- [x] Same response for existing/non-existing emails on magic link request (no enumeration)
- [x] Generic error on email collision (no provider name leaked)
- [ ] Account deletion clears `google_user_id` AND deletes `magic_link_codes` for user's email
- [x] SDK clients (Resend, OAuth2Client) use lazy initialization (ESM hoisting)
- [x] Email normalized with `.toLowerCase()` in all magic link endpoints
- [x] `google_user_id` uses partial unique index (`WHERE google_user_id IS NOT NULL` — no soft-delete column on main)

### Non-Functional Requirements

- [x] Magic link `/request` responds in < 50ms (email sent asynchronously)
- [ ] Magic link email delivered within 10 seconds (Resend SLA)
- [ ] Code entry screen supports iOS `.oneTimeCode` auto-fill
- [ ] 60-second cooldown on "Resend code" button (client-side)
- [ ] Google and Apple buttons are equal size/prominence (Apple App Review requirement)
- [ ] `@MainActor` isolation on iOS `AuthManager`
- [ ] `isCheckingSession` blocks login UI until existing session check resolves
- [x] Single `isAuthenticating` guard prevents concurrent auth attempts across ALL methods (iOS: Google + Apple + magic link; web: ref-based guard in AuthContext)
- [x] Web auto-submit guard uses `useRef` (not React state) to prevent batched-render bypass
- [x] Web passes email via `location.state`, not query params; redirects to `/login` if state missing
- [x] Display name prompt shown when `user.displayName === null` (not based on `isNewUser` alone)

## Dependencies & Risks

| Risk                                                            | Mitigation                                                                                |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Resend free tier limit (100/day)                                | Sufficient for launch; upgrade to $20/mo at ~100 daily active users                       |
| Google OAuth client IDs expire if unused for 6 months           | Document in ops runbook; set calendar reminder                                            |
| Apple rejects app if Google button is more prominent than Apple | Both buttons identical size/weight, Google only gets position advantage                   |
| Resend domain verification delays                               | Set up DNS records early (SPF, DKIM for `mail.ainotecards.com`) before starting code work |
| `google-auth-library` repo archived (Nov 2025)                  | npm package still published and maintained in monorepo; `verifyIdToken` API unchanged     |
| In-memory rate limiting resets on restart                       | Acceptable for indie scale; document as known limitation                                  |

## Google Cloud Console Setup Required

Before implementation:

1. Create Google Cloud project (or use existing)
2. Configure OAuth consent screen (External, scopes: `email`, `profile`, `openid`)
3. Create **iOS OAuth client** (Bundle ID: `com.ainotecards.app`)
4. Create **Web OAuth client** (Authorized JS origins: `http://localhost:5173`, production domain)
5. Note both client IDs for env vars and Info.plist
6. Save client secrets immediately (Google only shows them at creation time, auto-deletes unused clients after 6 months)

## Resend Setup Required

Before implementation:

1. Create Resend account at resend.com
2. Add and verify subdomain `mail.ainotecards.com` (SPF + DKIM DNS records)
3. Generate API key
4. Test with sandbox (`onboarding@resend.dev`) during development

## Success Metrics

- **Signup conversion rate** increases (fewer abandonments vs password flow)
- **% of users with real email** increases (Google + magic link vs Apple relay)
- **Time to first login** decreases (magic link is faster than password creation)

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md](docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md) — Key decisions: Resend for email, 6-digit codes over clickable links, Google first/Apple second layout, magic link as unified sign-in/sign-up, password UI removed but endpoints kept.

### Internal References

- Existing Apple auth pattern: `server/src/routes/auth-apple.js` (reference for Google route structure)
- Auth middleware: `server/src/middleware/auth.js` (no changes needed)
- Token helpers: `server/src/routes/auth.js` (`USER_SELECT`, `createToken`, `setTokenCookie`, `sanitizeUser`)
- Error codes: `server/src/constants/errors.js`
- Account deletion: `server/src/routes/auth-account.js` (needs `google_user_id` cleanup)
- iOS auth: `ios/AINotecards/Services/AuthManager.swift`
- Web auth: `client/src/lib/AuthContext.jsx`, `client/src/lib/api.js`

### External References

- [Google Sign-In iOS SDK](https://github.com/google/GoogleSignIn-iOS) (v9.0.0+, SPM, need both GoogleSignIn + GoogleSignInSwift products)
- [@react-oauth/google](https://www.npmjs.com/package/@react-oauth/google) (v0.13.4)
- [google-auth-library](https://www.npmjs.com/package/google-auth-library) (v10.6.1, `verifyIdToken`)
- [Resend Node.js SDK](https://resend.com/nodejs)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Google Verify ID Tokens](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

### Design Decisions Resolved from SpecFlow + Deepening + Technical Review

- **Magic link is intentionally universal** — works for all accounts regardless of original auth method (proves email ownership)
- **Password users use magic link** — no migration needed, email lookup works transparently
- **Apple Sign-In is iOS only** for v1 — avoids Apple JS SDK complexity on web
- **Display name prompt based on `displayName === null`** — not tied to `isNewUser` flag. Google auto-populates name, magic link users get prompted.
- **`isNewUser` returns actual value for all providers** — client decides prompt behavior, not server
- **Old codes invalidated on new request** — prevents attack surface multiplication
- **Auto-link on email match for ALL providers** — Google, Apple, and magic link all auto-link to existing accounts. Apple updated from 409 behavior for consistency.
- **Auto-link safety: relay email block + `email_verified` check** — never auto-link to Apple relay addresses, require Google `email_verified` claim
- **HMAC-SHA256 for code hashing** — plain SHA-256 on 900K keyspace is trivially reversible with DB access
- **Partial unique index for `google_user_id`** — supports re-registration after soft-delete
- **Suspended user check on all auth routes** — prevents banned users from bypassing suspension
- **`/signup` redirects to `/login`** on web — unified flow eliminates separate signup page
- **Subdomain for email** — `mail.ainotecards.com` isolates transactional reputation
- **Code in subject line** — mobile notification visibility
- **No expired code cleanup cron** — opportunistic cleanup in `/request` handler is sufficient
- **DB attempts counter is primary brute-force defense** — persists across restarts, per-code limit. IP rate limiting is secondary.
- **`checkAuth()` must resolve before showing login buttons** — prevents race with user-initiated auth
- **`useRef` for web auto-submit guard** — React state batching makes `useState` guards unreliable for concurrent events
