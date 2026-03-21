---
title: "Auth Revamp Implementation Guide: Google + Apple + Magic Link"
date: 2026-03-13
category: auth-implementation
tags:
  - authentication
  - google-signin
  - apple-signin
  - magic-link
  - passwordless
  - email
  - oauth
  - jwt
severity: high
components:
  - auth.js
  - auth-apple.js
  - auth-account.js
  - database
  - email-service
root_cause: null
---

# Auth Revamp Implementation Guide: Google + Apple + Magic Link

## Overview

This document captures the existing authentication infrastructure and provides a comprehensive guide for implementing Google Sign-In and magic link (6-digit code) authentication alongside the existing Apple Sign-In.

**Status:** Planning phase. Auth brainstorm at `docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md`. Implementation ready to start.

---

## Current Auth Implementation

### Existing Architecture

The app currently supports:
1. **Email + Password** (bcrypt + JWT in httpOnly cookies)
2. **Sign in with Apple** (identity token verification, HMAC-based nonce, no account linking in v1)

**Key Files:**
- `server/src/routes/auth.js` — password signup/login
- `server/src/routes/auth-apple.js` — Apple Sign-In (nonce generation, token verification)
- `server/src/routes/auth-account.js` — user account management
- `server/src/constants/errors.js` — structured error codes
- `server/src/db/migrations/001_initial.sql` — schema

### Token & Cookie Strategy

```javascript
// Token generation & signing (in auth.js)
const TOKEN_EXPIRY = '24h';
const TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // milliseconds

function createToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function setTokenCookie(res, userId) {
  const token = createToken(userId);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE,
  });
  return token;
}
```

**Key design decisions (must preserve in revamp):**
- JWT stored in **httpOnly cookie** (prevents XSS token theft via `document.cookie`)
- **24-hour expiry** — clients refresh implicitly when token expires
- **sameSite: lax** — allows safe cross-origin requests for payment redirects
- **Dual bearer/cookie support** in `/me` endpoint (Bearer token for iOS + API clients, cookie for web browser)

### User Selection Query

All auth routes use this consistent user shape:

```javascript
export const USER_SELECT = `id, email, plan, trial_ends_at, daily_generation_count, last_generation_date,
  study_score, stripe_customer_id, stripe_connect_account_id, connect_charges_enabled,
  display_name, role, suspended, created_at, preferred_model,
  apple_subscription_expires_at, apple_subscription_product_id`;
```

**Must add for Google auth:**
- `google_user_id` (unique Google subject ID)
- `google_email_verified` (boolean, set from Google's email_verified claim)

**Magic link additions:**
- Already support `email` uniqueness, no new columns needed for the basic flow
- **Optional optimization:** Add `email_verified_at` timestamp (for future email verification flows)

### Error Handling

Structured error codes in `/constants/errors.js`:

```javascript
// Auth-related codes we currently use:
AUTH_REQUIRED: 'auth_required',
AUTH_INVALID_TOKEN: 'auth_invalid_token',
AUTH_EXPIRED_TOKEN: 'auth_expired_token',
AUTH_ACCOUNT_SUSPENDED: 'auth_account_suspended',
AUTH_INVALID_CREDENTIALS: 'auth_invalid_credentials',
AUTH_EMAIL_EXISTS: 'auth_email_exists',
AUTH_USE_APPLE: 'auth_use_apple',
```

**New codes to add for magic link:**
- `AUTH_MAGIC_CODE_INVALID` — wrong or expired code
- `AUTH_MAGIC_CODE_EXPIRED` — code >10 minutes old
- `AUTH_MAGIC_RATE_LIMITED` — too many code requests from same email (TODO: define limit)

### Apple Sign-In Implementation (Reference Pattern)

The Apple implementation is a good reference for Google:

```javascript
// 1. Client calls GET /api/auth/apple/nonce to get fresh nonce
//    (HMAC-based, no server state needed)
// 2. Client gets identityToken from ASAuthorizationAppleIDCredential
// 3. Client POST to /api/auth/apple with identityToken + nonce
// 4. Server verifies token with apple-signin-auth library
// 5. Extract appleUser.sub (Apple User ID)
// 6. Lookup existing user by apple_user_id
// 7. If exists → login; if not → create account
// 8. Set JWT cookie, return user
```

**Key pattern to replicate for Google:**
- Verify OAuth token at request time (not session-based)
- Use provider's unique ID (not email) as lookup key
- Auto-create account on first sign-in
- Never link accounts across providers (v1)
- Return consistent user shape and JWT

### Database Schema

Current `users` table (from 001_initial.sql + amendments):

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,  -- NULL for non-password auth
  apple_user_id TEXT UNIQUE,  -- from Sign in with Apple
  display_name TEXT,  -- optional, set on first SIWA or set by user
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'trial', 'pro')),
  trial_ends_at TIMESTAMPTZ,
  daily_generation_count INT DEFAULT 0,
  last_generation_date DATE,
  study_score INT DEFAULT 0,
  stripe_customer_id TEXT,
  stripe_connect_account_id TEXT,
  connect_charges_enabled BOOLEAN,
  role TEXT DEFAULT 'user',
  suspended BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  token_revoked_at TIMESTAMPTZ,  -- for logout
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  preferred_model TEXT,
  apple_subscription_expires_at TIMESTAMPTZ,
  apple_subscription_product_id TEXT
);
```

---

## Implementation Plan: Google Sign-In + Magic Link

### Phase 1: Database Schema (Migration 006)

Add two new columns to `users` table:

```sql
-- 006_auth_revamp_google_magic_link.sql

-- Google auth
ALTER TABLE users ADD COLUMN google_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN google_email_verified BOOLEAN DEFAULT FALSE;

-- Magic link codes (stored in separate table for cleanup)
CREATE TABLE magic_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code TEXT NOT NULL,  -- 6-digit numeric string, hashed in production
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,

  CONSTRAINT unique_active_code UNIQUE (email, code) WHERE used_at IS NULL
);

CREATE INDEX idx_magic_link_codes_email ON magic_link_codes(email);
CREATE INDEX idx_magic_link_codes_expires_at ON magic_link_codes(expires_at);
```

**Why separate table:**
- Codes are short-lived (10 min), high volume → cleaner to manage separately
- Easy to purge expired codes nightly
- Auditable (track `used_at` for debugging)
- Can add features later: rate limiting per email, code history

### Phase 2: Backend Routes

#### New Endpoint: `POST /api/auth/google`

```javascript
// Similar to /api/auth/apple, but for Google OAuth token

router.post('/', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      error: ErrorCodes.VALIDATION_ERROR,
      message: 'ID token required'
    });
  }

  try {
    // 1. Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleUserId = payload.sub;
    const email = payload.email;
    const emailVerified = payload.email_verified;
    const displayName = payload.name;

    // 2. Lookup existing Google user
    const existing = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE google_user_id = $1 AND deleted_at IS NULL`,
      [googleUserId]
    );

    if (existing.rows.length > 0) {
      // Existing user → login
      const user = existing.rows[0];
      if (user.suspended) {
        return res.status(403).json({ error: ErrorCodes.AUTH_ACCOUNT_SUSPENDED });
      }
      const token = setTokenCookie(res, user.id);
      return res.json({ token, user: sanitizeUser(user) });
    }

    // 3. Check if email already claimed by another auth method
    const emailExists = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.toLowerCase()]
    );

    if (emailExists.rows.length > 0) {
      // Email exists but no google_user_id → user registered via password/Apple
      return res.status(409).json({
        error: ErrorCodes.AUTH_EMAIL_EXISTS,
        message: 'Email already registered. Please sign in with your password or Apple.'
      });
    }

    // 4. Create new account
    const result = await pool.query(
      `INSERT INTO users (email, google_user_id, google_email_verified, display_name, plan, trial_ends_at)
       VALUES ($1, $2, $3, $4, 'trial', NOW() + INTERVAL '7 days')
       RETURNING ${USER_SELECT}`,
      [email.toLowerCase(), googleUserId, emailVerified, displayName]
    );

    const user = result.rows[0];
    const token = setTokenCookie(res, user.id);
    res.status(201).json({ token, user: sanitizeUser(user) });

  } catch (err) {
    console.error('Google auth error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: ErrorCodes.AUTH_EMAIL_EXISTS });
    }
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});
```

**Dependencies:**
```bash
npm install google-auth-library
```

**Environment variables to add:**
```
GOOGLE_CLIENT_ID=YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com
```

#### New Endpoint: `POST /api/auth/magic-link/request`

```javascript
// Request a 6-digit code via email

router.post('/request', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      error: ErrorCodes.VALIDATION_ERROR,
      message: 'Valid email required'
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    // TODO: Implement rate limiting
    // Check if too many codes requested in last hour
    // const recentCodes = await pool.query(
    //   `SELECT COUNT(*) FROM magic_link_codes
    //    WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    //   [normalizedEmail]
    // );
    // if (recentCodes.rows[0].count > 3) {
    //   return res.status(429).json({
    //     error: ErrorCodes.AUTH_MAGIC_RATE_LIMITED,
    //     message: 'Too many requests. Try again in 1 hour.'
    //   });
    // }

    // 1. Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Store code in DB
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await pool.query(
      `INSERT INTO magic_link_codes (email, code, expires_at)
       VALUES ($1, $2, $3)`,
      [normalizedEmail, code, expiresAt]
    );

    // 3. Send email via Resend
    await sendMagicLinkEmail(normalizedEmail, code);

    res.json({ ok: true, message: 'Code sent to email' });

  } catch (err) {
    console.error('Magic link request error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});
```

#### New Endpoint: `POST /api/auth/magic-link/verify`

```javascript
// Verify code and login/signup

router.post('/verify', async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      error: ErrorCodes.VALIDATION_ERROR,
      message: 'Email and code required'
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    // 1. Find code
    const codeResult = await pool.query(
      `SELECT id, expires_at, used_at FROM magic_link_codes
       WHERE email = $1 AND code = $2`,
      [normalizedEmail, code]
    );

    if (codeResult.rows.length === 0) {
      return res.status(401).json({
        error: ErrorCodes.AUTH_MAGIC_CODE_INVALID,
        message: 'Invalid code'
      });
    }

    const codeRow = codeResult.rows[0];

    // 2. Check expiry
    if (new Date(codeRow.expires_at) < new Date()) {
      return res.status(401).json({
        error: ErrorCodes.AUTH_MAGIC_CODE_EXPIRED,
        message: 'Code expired. Request a new one.'
      });
    }

    // 3. Check if already used
    if (codeRow.used_at) {
      return res.status(401).json({
        error: ErrorCodes.AUTH_MAGIC_CODE_INVALID,
        message: 'Code already used'
      });
    }

    // 4. Mark code as used
    await pool.query(
      `UPDATE magic_link_codes SET used_at = NOW() WHERE id = $1`,
      [codeRow.id]
    );

    // 5. Lookup or create user
    const userResult = await pool.query(
      `SELECT ${USER_SELECT} FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [normalizedEmail]
    );

    let user;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];

      if (user.suspended) {
        return res.status(403).json({ error: ErrorCodes.AUTH_ACCOUNT_SUSPENDED });
      }
    } else {
      // Create new account (auto-signup)
      const createResult = await pool.query(
        `INSERT INTO users (email, plan, trial_ends_at)
         VALUES ($1, 'trial', NOW() + INTERVAL '7 days')
         RETURNING ${USER_SELECT}`,
        [normalizedEmail]
      );
      user = createResult.rows[0];
    }

    // 6. Set token and return
    const token = setTokenCookie(res, user.id);
    res.json({
      token,
      user: sanitizeUser(user),
      isNewUser: userResult.rows.length === 0
    });

  } catch (err) {
    console.error('Magic link verify error:', err);
    res.status(500).json({ error: ErrorCodes.SERVER_ERROR });
  }
});
```

### Phase 3: Email Service (Resend Integration)

**Install Resend:**
```bash
npm install resend
```

**Create email service:**
```javascript
// server/src/services/email.js

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMagicLinkEmail(email, code) {
  const response = await resend.emails.send({
    from: 'noreply@ai-notecards.com',  // Verify this sender in Resend
    to: email,
    subject: 'Your AI Notecards login code',
    html: `
      <h2>Your login code</h2>
      <p>Enter this code to sign in to AI Notecards:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;">
        ${code}
      </div>
      <p>This code expires in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });

  if (response.error) throw response.error;
  return response;
}
```

**Environment variables to add:**
```
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=noreply@ai-notecards.com
```

### Phase 4: Frontend Integration

#### Update Login Page Component

Replace password form with three-option auth:

```javascript
// client/src/pages/Login.jsx

export default function Login() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // email | code
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      const res = await api.post('/auth/google', {
        idToken: credentialResponse.credential,
      });
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkRequest = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await api.post('/auth/magic-link/request', { email });
      setStep('code');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLinkVerify = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await api.post('/auth/magic-link/verify', {
        email,
        code
      });
      login(res.data.user, res.data.token);

      // If new user, show display name prompt
      if (res.data.isNewUser) {
        navigate('/onboarding/display-name');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Code verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
      <div className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center text-[#1A1614] mb-2">
          AI Notecards
        </h1>
        <p className="text-center text-[#6B635A] mb-8">
          Generate flashcards with AI
        </p>

        {step === 'email' ? (
          <>
            {/* Google Sign-In */}
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google login failed')}
              render={(renderProps) => (
                <button
                  onClick={renderProps.onClick}
                  disabled={renderProps.disabled || isLoading}
                  className="w-full mb-3 px-4 py-3 bg-white border border-[#CCCCCC] rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-gray-50"
                >
                  <GoogleIcon size={20} />
                  Continue with Google
                </button>
              )}
            />

            {/* Apple Sign-In */}
            <AppleSignIn
              onSuccess={handleAppleSuccess}
              onError={(err) => setError('Apple login failed')}
              className="w-full mb-6"
            />

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-[#CCCCCC]"></div>
              <span className="text-[#6B635A] text-sm">or</span>
              <div className="flex-1 h-px bg-[#CCCCCC]"></div>
            </div>

            {/* Magic Link Form */}
            <form onSubmit={handleMagicLinkRequest}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-[#CCCCCC] rounded-lg mb-4 focus:outline-none focus:border-[#1B6B5A]"
              />
              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full px-4 py-3 bg-[#1B6B5A] text-white rounded-lg font-medium hover:bg-[#2D8A5E]"
              >
                {isLoading ? 'Sending...' : 'Continue with Email'}
              </button>
            </form>
          </>
        ) : (
          // Code entry screen
          <form onSubmit={handleMagicLinkVerify}>
            <p className="text-center text-[#6B635A] mb-6">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            <input
              type="text"
              placeholder="000000"
              maxLength="6"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-[#CCCCCC] rounded-lg mb-4 focus:outline-none focus:border-[#1B6B5A]"
            />
            <button
              type="submit"
              disabled={isLoading || code.length !== 6}
              className="w-full px-4 py-3 bg-[#1B6B5A] text-white rounded-lg font-medium hover:bg-[#2D8A5E]"
            >
              {isLoading ? 'Verifying...' : 'Continue'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
              className="w-full mt-4 text-[#1B6B5A] hover:underline"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && (
          <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Key Design Decisions

### Magic Link: 6-digit Code vs. Clickable Link

**Decision: 6-digit numeric code**

Rationale:
- Mobile-friendly (user enters code in app, no Safari redirect)
- Works better with paste-to-clipboard workflows
- Less vulnerable to interception (email is read in Mail.app on device)
- Higher perceived security for users

### Auto-Create Accounts

**Decision: Sign in = Sign up (unified flow)**

Both magic link and Google create accounts on first authentication:
- Reduces decision friction (no separate signup page)
- Consistent with modern passwordless apps (Notion, Linear, etc.)
- One fewer flow to test

### No Account Linking (v1)

**Decision: One provider per email**

Current implementation and new implementations maintain this:
- Email is claimed by first auth method (password → Apple → Google → magic link)
- Prevents social engineering (attacker can't hijack account via second method)
- Simpler to reason about (no provider preference logic)

If a user wants to switch providers later, they can request a password reset or create a new account.

### Email Provider: Resend

**Decision: Resend over AWS SES, Gmail SMTP, or custom**

Why:
- **3,000 emails/month free tier** (100/day) — sufficient for initial launch
- **3-line SDK** — minimal dependency bloat
- **99%+ deliverability** — Resend manages warm-up, reputation
- **Admin dashboard** — track bounces, delivery stats
- **No SPF/DKIM setup** — Resend handles it

SES and raw SMTP (Gmail, iCloud) rejected:
- Google blocks automated sending from data center IPs
- Self-managed SMTP requires manual warm-up (weeks), spam reputation management
- Higher ops burden for indie launch

---

## Testing & Verification Checklist

### Backend Routes

- [ ] `POST /api/auth/google` — happy path (new user, existing user)
- [ ] `POST /api/auth/google` — error cases (invalid token, email already exists)
- [ ] `POST /api/auth/magic-link/request` — sends email with code
- [ ] `POST /api/auth/magic-link/request` — rate limiting (if implemented)
- [ ] `POST /api/auth/magic-link/verify` — valid code → logs in existing user
- [ ] `POST /api/auth/magic-link/verify` — valid code → creates new user
- [ ] `POST /api/auth/magic-link/verify` — expired code → 401
- [ ] `POST /api/auth/magic-link/verify` — already-used code → 401
- [ ] Token cookie is set with correct secure/httpOnly/sameSite flags
- [ ] `/api/auth/me` works after magic link login
- [ ] `/api/auth/logout` revokes token (token_revoked_at)

### Frontend

- [ ] Google Sign-In button appears and triggers login flow
- [ ] Apple Sign-In button appears and triggers login flow
- [ ] Magic link flow: email → code entry → dashboard
- [ ] Errors display correctly (rate limited, invalid code, expired code)
- [ ] Magic link code input accepts only digits
- [ ] Display name prompt shown for new magic-link users
- [ ] Existing password users can still log in (password endpoints stay enabled)

### Database

- [ ] `users.google_user_id` unique constraint works
- [ ] `magic_link_codes` table structure correct
- [ ] Expired codes can be deleted without constraint violations
- [ ] Email can be claimed by one auth method only (constraint validation)

### Deployments

- [ ] GOOGLE_CLIENT_ID set in production environment
- [ ] RESEND_API_KEY set in production environment
- [ ] Resend sender domain verified (noreply@ai-notecards.com)
- [ ] Database migration runs cleanly on production

---

## Future Improvements

1. **Rate Limiting:** Add configurable limits on magic link code requests (prevent email bombing)
2. **Email Verification:** Track `email_verified_at` for future verified-only features
3. **Account Linking:** Allow users to link Google → Magic Link (if they want to migrate)
4. **TOTP / 2FA:** Optional second factor for added security
5. **Passwordless Entirely:** Remove password endpoints after migration period
6. **Social Proof:** Track "signed up via Google" as growth metric

---

## Related Documentation

- **Auth brainstorm:** `docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md`
- **CLAUDE.md:** Stack, conventions, environment variables
- **Error codes:** `server/src/constants/errors.js`
- **Existing auth:** `server/src/routes/auth.js`, `auth-apple.js`
- **Database:** `server/src/db/migrations/`
