---
title: "Pre-Launch Production Readiness: Closing 6 Critical Gap Categories"
description: "Systematic resolution of 6 pre-launch blockers: password recovery UX, legal pages (ToS/Privacy), error handling (404/ErrorBoundary), SEO/social meta tags, email verification plumbing, and Sentry error monitoring. Covers React 19 + Vite frontend and Express + PostgreSQL backend with Stripe Connect."
category: feature-patterns
tags:
  - pre-launch
  - password-recovery
  - legal-compliance
  - error-handling
  - seo
  - meta-tags
  - email-verification
  - sentry
  - error-monitoring
  - react
  - express
  - postgresql
severity: critical
component: apps/ai-notecards
symptom: "Product could not accept real paying users due to missing password recovery, absent legal pages, no error handling (white screens), missing SEO metadata, incomplete email verification, and zero error monitoring"
date_solved: "2026-03-14"
status: resolved
---

# Pre-Launch Production Readiness Checklist

## Problem

The AI Notecards app reached feature-complete state but was missing the "last 10%" that separates a project from a product. Six categories of gaps prevented accepting real paying users:

1. **No password recovery** — magic link / Google users couldn't set a password; users who forgot couldn't reset
2. **No legal pages** — Stripe Connect requires ToS; GDPR requires a privacy policy
3. **No error handling** — invalid URLs showed blank screens; component crashes showed white screens
4. **No SEO / social tags** — broken social previews, no favicon, no meta description
5. **No email verification plumbing** — `email_verified` column existed but was never exposed or enforced
6. **No error monitoring** — production errors were invisible

## Root Cause

Feature development naturally pulls attention toward the "happy path." These infrastructure pieces were consistently deprioritized because they don't demo well. The critical architectural finding: `USER_SELECT` omitted `token_revoked_at`, causing the `/me` endpoint's revocation check to silently pass (always `undefined > timestamp` = false).

---

## Solution

### Phase 1: Meta Tags & Favicon

**Files:** `client/index.html`, `client/public/*`

Added meta description, Open Graph tags (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:image`, `og:url`), Twitter Card tags (`summary_large_image`), SVG favicon with fallback ICO, apple-touch-icon, and theme-color.

Created an SVG notecard icon with AI sparkle accent. Generated PNG assets via `sharp-cli` script (`scripts/generate-assets.mjs`): favicon.ico (32x32), apple-touch-icon.png (180x180), og-image.png (1200x630).

**Key pattern:** Keep the SVG as source of truth; derive all raster assets programmatically.

### Phase 2: Legal Pages & Footer

**Files:** `Terms.jsx`, `Privacy.jsx`, `Footer.jsx`, `App.jsx`, `Landing.jsx`, `Login.jsx`, `Pricing.jsx`, `Marketplace.jsx`, `Settings.jsx`

Created Terms of Service (10 sections: Account, Marketplace Rules, AI Content, IP, Prohibited Content, Payment, Termination, Liability, Changes, Contact) and Privacy Policy (10 sections: Data Collected, Usage, Third Parties, Retention, Rights, Cookies, Children, Do Not Sell, Changes, Contact).

Shared `Footer.jsx` component added to all public-facing pages. Legal consent text added to Login page. SellerTermsModal links to full ToS.

### Phase 3: Error Handling

**Files:** `NotFound.jsx`, `ErrorBoundary.jsx`, `App.jsx`, `main.jsx`, `server/src/index.js`

**NotFound page** with auth-aware CTA:
```jsx
const { user, loading } = useAuth();
// Guard behind loading state to prevent flash of wrong CTA
const ctaTarget = loading ? '/' : (user ? '/dashboard' : '/');
```

**ErrorBoundary** with `isRecovering` guard:
```jsx
handleRecover = () => {
  if (this.isRecovering) return; // prevent double-click cascade
  this.isRecovering = true;
  window.location.href = '/'; // full reload, not pushState
};
```

- `window.location.href` (not `navigate()`) forces full page reload to clear corrupted React state
- `isRecovering` guard returns `null` during navigation to prevent re-render of error tree
- `componentDidCatch` console.error is dev-only
- `createRoot` error hooks: `onUncaughtError`, `onRecoverableError`
- API 404 catch-all: `app.use('/api/*', ...)` returns JSON, not HTML

### Phase 4: Sentry Error Monitoring

**Files:** `main.jsx`, `ErrorBoundary.jsx`, `AuthContext.jsx`, `vite.config.js`, `server/src/index.js`, `.env.example` files

**Conditional init** (no-op without DSN):
```js
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({ dsn: ..., beforeSend(event) { /* PII scrub */ } });
}
```

**PII scrubbing in `beforeSend`:**
- Client: strips `event.user.email`, `event.user.username`
- Server: additionally strips `event.request.data` (POST bodies may contain passwords), `event.request.cookies`, `event.request.headers.cookie` (JWT leaks)

**Source maps:** `sourcemap: 'hidden'` + `filesToDeleteAfterUpload` — uploaded to Sentry but not served publicly.

**User context:** `Sentry.setUser({ id })` on all auth flows (login, signup, Google, magic link, session restore); cleared on logout.

**Express error handler chain:**
```js
Sentry.setupExpressErrorHandler(app);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});
```

### Phase 5: Email Verification Plumbing

**Files:** `server/src/routes/auth.js`, `server/src/middleware/auth.js`

Added `email_verified` and `token_revoked_at` to `USER_SELECT` (2 fields added to existing string, not a rewrite). Added `email_verified: !!user.email_verified` to `sanitizeUser` (1 line).

**Critical fix:** Including `token_revoked_at` in `USER_SELECT` fixes a silent revocation bypass. The `/me` endpoint checked `user.token_revoked_at` but the query never selected it — so `undefined > timestamp` always evaluated to `false`, and revoked tokens were accepted.

Created `requireEmailVerified` middleware stub — exported but NOT chained onto any endpoints yet (all current users are auto-verified via Google/magic link).

### Phase 6: Password Recovery UX

**Files:** `server/src/routes/account.js`, `client/src/pages/Settings.jsx`, `client/src/pages/Login.jsx`

**Server endpoint change:** Replaced the `!currentPassword || !newPassword` rejection guard with `!currentPassword` as a branch point:

```js
if (!currentPassword) {
  // "Set password" flow — atomic UPDATE WHERE password_hash IS NULL
  const { rowCount } = await pool.query(
    `UPDATE users SET password_hash = $1, token_revoked_at = NOW() - INTERVAL '1 second'
     WHERE id = $2 AND password_hash IS NULL`,
    [await bcrypt.hash(newPassword, SALT_ROUNDS), req.userId]
  );
  if (rowCount === 0) return res.status(400).json({ error: 'Current password is required' });
  setTokenCookie(res, req.userId);
  return res.json({ ok: true });
}
// else: existing "change password" flow with currentPassword verification
```

**Security hardening:**
- **Atomic `WHERE password_hash IS NULL`**: DB enforces single-writer; prevents TOCTOU race
- **`NOW() - INTERVAL '1 second'`**: fresh JWT stays valid despite revocation timestamp
- **Max 128 chars**: prevents bcrypt's 72-byte silent truncation
- **Full middleware chain preserved**: `authenticate, requireXHR, requireActiveUser, passwordLimiter`

**Client:** Settings shows "Set Password" form (no current password required) when `user.has_password === false`. Calls `api.changePassword(null, newPassword)` + `refreshUser()` to sync state.

**Login:** Help text changed to "You can always sign in with a code — no password needed."

---

## Security Summary

| Concern | Solution |
|---------|----------|
| PII in error reports | `beforeSend` scrubs email, username, request body, cookies |
| Sourcemap exposure | `sourcemap: 'hidden'` + delete after upload |
| Silent token revocation bypass | `token_revoked_at` added to `USER_SELECT` |
| Passwordless user lockout | Branched endpoint with atomic `WHERE password_hash IS NULL` |
| Session fixation on password set | `token_revoked_at = NOW() - INTERVAL '1 second'` |
| Bcrypt truncation / DoS | 128-char password max length |
| Stack trace leakage | Dev-only console.error + generic 500 JSON response |
| Double error reporting | `isRecovering` guard on ErrorBoundary |
| CSRF on password endpoint | `requireXHR` middleware preserved in chain |

---

## Prevention Strategies

### 1. Create the Launch Checklist at Project Kickoff

The "last 10%" items are predictable and categorical. Write them as failing tests at project start:

- [ ] Password recovery flow works for all auth methods
- [ ] Legal pages exist and are linked from signup
- [ ] ErrorBoundary catches crashes; 404 page catches bad URLs
- [ ] Social share previews render correctly
- [ ] Error monitoring captures errors with source-mapped traces
- [ ] All security-critical columns are in every user-fetching query

### 2. Canonical Query Builders

Never hand-write SELECT columns for user lookups. Define a single `USER_SELECT` constant. Any column that participates in an authorization decision must be present. **Test this with a query introspection assertion.**

### 3. Encode Preconditions in WHERE Clauses

`WHERE password_hash IS NULL` in the UPDATE makes the database the arbiter of the precondition, not application code that could be bypassed. Generalize: any operation that should only succeed under a precondition should encode it in SQL.

### 4. Time-Based Security with Backward Offset

`NOW() - INTERVAL '1 second'` handles clock skew between app servers and same-second race conditions. Document the offset rationale wherever it's used.

### 5. ErrorBoundary Must Handle Recovery Failure

Every ErrorBoundary must include an `isRecovering` guard. Test: trigger a deterministic error, click recover, verify no infinite loop.

### 6. 404 Rendering Gated on Auth Hydration

Any component that conditionally renders a 404 must first confirm auth loading is complete. Otherwise authenticated users see false 404s during hydration.

### 7. App Store Review Notes Must Be Prepared Before Submission

For iOS subscription launches, prepare reviewer-facing notes as part of the pre-launch checklist, not as a last-minute App Store Connect text box.

**Required reviewer notes checklist for AI Notecards iOS monetization:**

- State that **Pro subscriptions are available in-app through Apple IAP / StoreKit** and identify the screen where reviewers can find them.
- Explain that **existing web subscribers can sign in and retain access** because entitlement is server-owned and valid across platforms.
- Explain that the **marketplace uses browser handoff for creator-to-buyer commerce**, not for unlocking Pro, and that the iOS fallback is browse-only if required for review.
- Include a **demo account** or explicit test-account instructions, with enough detail for login and purchase-surface navigation.
- Identify the **Restore Purchases** affordance and the **Manage Subscription** behavior for Apple subscribers.
- Note any **feature flags** or review-time switches that may affect marketplace purchase availability on iOS.

**Suggested review-note template:**

> AI Notecards offers Pro subscriptions through Apple In-App Purchase in the Profile tab. Reviewers can sign in with the demo account below, open Profile, and view monthly / annual subscription options plus Restore Purchases. Existing subscribers from the web may sign in and retain access because subscription entitlement is synced server-side. Marketplace deck purchases use a browser checkout flow for creator marketplace transactions; if required for review, marketplace purchasing can be disabled while browsing remains available.

**Operational checklist before submission:**

- Confirm the demo account works on the current build.
- Confirm the subscription products shown in-app match App Store Connect configuration.
- Confirm Restore Purchases and Manage in Apple are visible for the correct account state.
- Confirm the current `IOS_MARKETPLACE_WEB_PURCHASES_ENABLED` value matches the reviewer notes.

---

## Related Documentation

- `docs/solutions/auth-implementation-guide.md` — JWT patterns, token revocation, `setTokenCookie` usage
- `docs/solutions/feature-patterns/account-settings-experience.md` — Settings architecture, soft-delete, avatar upload, conditional form rendering
- `docs/plans/2026-03-14-feat-pre-launch-blockers-plan.md` — Full implementation plan with research agent findings
- `docs/plans/2026-03-13-feat-auth-revamp-google-magic-link-plan.md` — Auth architecture decisions
- `docs/INSTITUTIONAL-LEARNINGS.md` — Cross-cutting patterns from auth, settings, and seller flows
