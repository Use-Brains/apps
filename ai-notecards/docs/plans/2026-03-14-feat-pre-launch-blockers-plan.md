---
title: "Pre-Launch Blockers: Password Recovery, Legal, Error Handling, SEO, Verification, Monitoring"
type: feat
date: 2026-03-14
deepened: 2026-03-14
---

# Pre-Launch Blockers

Six foundational pieces that must exist before real users pay real money: password recovery UX, legal pages, error handling, meta tags, email verification plumbing, and error monitoring.

## Enhancement Summary

**Deepened on:** 2026-03-14
**Sections enhanced:** 6 phases + architecture
**Research agents used:** Security Sentinel, Performance Oracle, Architecture Strategist, Code Simplicity Reviewer, Frontend Races Reviewer, Pattern Recognition Specialist, Best Practices Researcher, Auth Guide Learnings, Account Settings Learnings

### Key Improvements
1. **Phase 4 (Sentry) trimmed** — removed Replay and performance tracing (YAGNI at launch scale), added `beforeSend` PII scrubbing on both client and server, switched to `sourcemap: "hidden"`, added generic Express error handler
2. **Phase 5 (Email Verification) significantly trimmed** — reduced to diff-only changes: add `email_verified` to existing `USER_SELECT` and `sanitizeUser` (not a rewrite); middleware stub uses existing snake_case conventions
3. **Phase 6 (Password Recovery) hardened** — full middleware chain preserved (`requireXHR`, `requireActiveUser`, `passwordLimiter`), atomic single-query update with `NOW() - INTERVAL '1 second'` offset, password max length 128, client `refreshUser()` after set

### Review Fixes Applied (from `/workflows:review`)
- **P1:** Fixed Phase 6 middleware chain (was `authenticate` only, now full chain)
- **P1:** Fixed token revocation to single atomic query with `- INTERVAL '1 second'` offset
- **P1:** Fixed USER_SELECT/sanitizeUser to show diff-only (was a rewrite that dropped 13+ fields)
- **P1:** Fixed ErrorBoundary Sentry integration from `require()` to ESM `import`
- **P2:** Preserved `React.StrictMode` in main.jsx createRoot example
- **P2:** Changed ErrorBoundary recovery target from `/dashboard` to `/`
- **P2:** Added `isRecovering` guard flag to prevent re-render cascade during navigation
- **P2:** Added `refreshUser()` requirement after password set
- **P2:** Removed `<Navbar />` from App.jsx code example (contradicted Option 2)
- **P2:** Added password max length validation (128 chars, bcrypt 72-byte truncation)
- **P3:** Added server-side `beforeSend` PII scrubbing + generic Express error handler
- **P3:** Rewrote Login help text (was misleading "Forgot your password?" on passwordless page)
- **P3:** Added `og:site_name` meta tag (was in research insights but missing from implementation)
- **P3:** Made ErrorBoundary console.error dev-only

### Review Fixes Applied (Round 2)
- **P1:** Added `token_revoked_at` to Phase 5 USER_SELECT diff — `/me` endpoint revocation check was silently broken (always passed)
- **P1:** Added note that existing `!currentPassword || !newPassword` guard at account.js:106 must be replaced (rejects Set Password flow)
- **P2:** Added `GoogleOAuthProvider` wrapper to App.jsx code example (was missing, would break Google Sign-In)
- **P2:** Added client-side "Set Password" form handler with `api.changePassword(null, newPassword)` + `refreshUser()`
- **P2:** Added cookie/header stripping to server Sentry `beforeSend` (JWT leaked via `event.request.cookies`)
- **P3:** Fixed `createRoot` to `ReactDOM.createRoot` (matching existing `import ReactDOM from 'react-dom/client'`)
- **P3:** Removed empty `onCaughtError` hook (dead code — errors already logged in `componentDidCatch`)
- **P3:** Updated Phase 4 createRoot reference to match Phase 3 fix

### Pre-existing bug (out of scope):
- **auth-magic.js:115** — `SELECT ${USER_SELECT}, password_hash FROM users WHERE email = $1` has no `deleted_at IS NULL` filter. A soft-deleted user can log in via magic link. Fix separately.

### Considerations
- **Security:** Full middleware chain on password endpoint; atomic single-query for set + revoke; max password length prevents bcrypt truncation surprises; `token_revoked_at` now in USER_SELECT so `/me` revocation check works; server Sentry strips cookies and request bodies
- **Performance:** The `requireEmailVerified` middleware issues its own DB query — when eventually chained, consolidate via `loadUser` pattern to avoid 4+ queries per request
- **Frontend:** ErrorBoundary uses `isRecovering` guard and navigates to `/` (works for all users); `ReactDOM.createRoot` error hooks preserve `StrictMode`; client must `refreshUser()` after password changes; `GoogleOAuthProvider` wrapper preserved in App.jsx
- **Simplicity:** PWA manifest cut from Phase 1; `USER_SELECT`/`sanitizeUser` changes are diff-only (2 lines total)

---

## Overview

The core product is solid — generation, study modes, marketplace, payments all work. But the app is missing the "last 10%" that separates a project from a product. A user who forgets their password can't recover it. There's no Terms of Service for a marketplace handling real money. Component crashes show a white screen. Social shares look broken. No error monitoring means we're flying blind.

## Problem Statement

Six categories of gaps:
1. **Password recovery**: Users who set a password in Settings can't reset it without knowing the current one. The Settings page shows "No password set" for magic link / Google users but has no mechanism to actually set one.
2. **Legal compliance**: Stripe Connect requires ToS. GDPR requires a privacy policy. Neither exists.
3. **Error handling**: No 404 page, no error boundary. Invalid URLs = blank screen. Component crash = white screen.
4. **SEO / social**: No meta description, no OG tags, no favicon. Social shares are broken.
5. **Email verification**: The `email_verified` column exists but is never exposed to the client or enforced in middleware. Currently moot (Google + magic link auto-verify), but needed for future auth methods and marketplace trust.
6. **Error monitoring**: No Sentry, no alerting. Production errors are invisible.

## Architectural Context

**Critical finding from SpecFlow analysis:** The Login page currently only offers Google Sign-In and magic link. The `/signup` route redirects to `/login`. There is no email/password login form. This means:
- **"Forgot password" is already handled** — users log in via magic link and can change their password in Settings
- **Email verification is naturally satisfied** — both Google and magic link auto-verify
- The real gap is the **Settings page password management** — users with `has_password = false` (magic link / Google users) see "No password set" but have no way to actually set one. Users who forgot their password can log in via magic link but then can't reset it in Settings because the change form requires `currentPassword`.

### Research Insights: Architecture

**Consolidated `loadUser` middleware (Performance Oracle recommendation):**

The current codebase has a pattern where `authenticate()` verifies the JWT, then individual route handlers and middlewares (`checkTrialExpiry`, `requirePlan`, and the proposed `requireEmailVerified`) each issue separate DB queries for the same user. This creates a triple+ DB hit per authenticated request.

**Recommendation:** Introduce a `loadUser` middleware that fetches all needed user fields in one query and attaches to `req.userRecord`. Downstream middlewares become stateless readers:

```js
// server/src/middleware/loadUser.js
export async function loadUser(req, res, next) {
  const { rows } = await pool.query(
    `SELECT id, email, display_name, plan, trial_ends_at, email_verified,
            stripe_customer_id, is_admin, suspended, deleted_at,
            (password_hash IS NOT NULL) AS has_password
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [req.userId]
  );
  if (!rows[0]) return res.status(401).json({ error: 'User not found' });
  req.userRecord = rows[0];
  next();
}
```

**When to introduce:** This is a refactor that benefits all phases but isn't a blocker for any individual phase. Consider introducing it as a Phase 0 or deferring to a follow-up. The plan below assumes the current per-middleware query pattern for now, with notes on where `loadUser` would simplify things.

---

## Proposed Solution

Six phases, each independently deployable. Ordered by dependencies.

---

### Phase 1: Meta Tags + Open Graph + Favicon

**Scope:** Static HTML changes only. No backend work. PWA manifest deferred — not needed for launch.

**Files to modify:**
- `client/index.html` — add meta description, OG tags, Twitter cards, favicon links, theme-color
- `client/public/` — add favicon.ico, apple-touch-icon.png, og-image.png

**Implementation:**

```html
<!-- client/index.html additions inside <head> -->
<meta name="description" content="AI-powered flashcard app. Paste your notes, AI generates study cards. Buy and sell decks on the marketplace." />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="AI Notecards" />
<meta property="og:title" content="AI Notecards — Study Smarter" />
<meta property="og:description" content="Paste notes or type a topic, AI generates flashcards. Study with flip, multiple choice, type, and match modes. Buy and sell decks." />
<meta property="og:image" content="https://ainotecards.com/og-image.png" />
<meta property="og:url" content="https://ainotecards.com" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="AI Notecards — Study Smarter" />
<meta name="twitter:description" content="AI-powered flashcards with marketplace. Generate, study, buy and sell." />
<meta name="twitter:image" content="https://ainotecards.com/og-image.png" />

<!-- Favicon -->
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#1B6B5A" />
```

**Design assets needed:**
- `favicon.ico` — 32x32 notecard icon in brand green (#1B6B5A)
- `apple-touch-icon.png` — 180x180
- `og-image.png` — 1200x630 social card with app name, tagline, and a visual of the card flip UI

**Open question:** Generate favicon programmatically (SVG → PNG conversion) or use a design tool? Recommendation: create a simple SVG notecard icon and convert to required sizes.

**Not included:** Dynamic per-page OG tags (requires SSR or prerender service — post-launch enhancement). Per-page `<title>` updates via react-helmet (nice-to-have, not a blocker). PWA manifest (adds complexity without clear launch value — add when "Add to Home Screen" becomes a priority).

### Research Insights: Meta Tags

**Best Practices (2024-2026):**
- OG image should be exactly 1200x630px for optimal rendering across platforms
- Include `og:site_name` for better brand attribution in social cards
- Twitter/X now supports `twitter:card` type `summary_large_image` — always prefer it over `summary` for visual apps
- Use absolute URLs for OG images (not relative) — social scrapers need the full URL

**Edge Cases:**
- Some social platforms cache OG tags aggressively. After deploying, use Facebook's Sharing Debugger and Twitter Card Validator to force a re-scrape
- If the domain changes (e.g., custom domain later), OG URLs will need updating — consider environment-variable-driven OG URLs in a future iteration

---

### Phase 2: Legal Pages (ToS + Privacy Policy)

**Scope:** Two new static pages, a shared Footer component, and legal text links on Login.

**New files:**
- `client/src/pages/Terms.jsx` — Terms of Service content page
- `client/src/pages/Privacy.jsx` — Privacy Policy content page
- `client/src/components/Footer.jsx` — shared footer with legal links

**Files to modify:**
- `client/src/App.jsx` — add `/terms` and `/privacy` routes (unprotected, like `/pricing`)
- `client/src/pages/Landing.jsx` — replace inline footer with `<Footer />`
- `client/src/pages/Login.jsx` — add "By continuing, you agree to our Terms and Privacy Policy" text below magic link form
- `client/src/pages/Pricing.jsx` — add `<Footer />`

**Route registration pattern** (follows existing Pricing pattern — no auth wrapper):
```jsx
// client/src/App.jsx
<Route path="/terms" element={<Terms />} />
<Route path="/privacy" element={<Privacy />} />
```

**Page template** (follows Landing/Pricing pattern):
```jsx
// client/src/pages/Terms.jsx
export default function Terms() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-[#1A1614] mb-8">Terms of Service</h1>
        {/* Content sections */}
      </main>
      <Footer />
    </div>
  );
}
```

**Footer component:**
```jsx
// client/src/components/Footer.jsx
export default function Footer() {
  return (
    <footer className="border-t border-gray-200 py-8 mt-16">
      <div className="max-w-5xl mx-auto px-4 flex justify-between items-center text-sm text-[#6B635A]">
        <p>&copy; {new Date().getFullYear()} AI Notecards</p>
        <div className="flex gap-6">
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
```

**Footer placement:** Landing, Terms, Privacy, Pricing, Marketplace pages. NOT on authenticated pages (Dashboard, Study, Settings, etc.) — keeps the study experience clean.

**ToS content sections:**
1. Account Responsibilities — accurate info, one account per person, password security
2. Marketplace Rules — pricing ($1–$5), content standards, no plagiarism, refund policy (handled by Stripe disputes)
3. AI-Generated Content — disclaimers on accuracy, no guarantee of correctness, user responsibility to review
4. Intellectual Property — user owns generated content, sellers grant display license, buyers get personal-use license
5. Prohibited Content — explicit, hate speech, violence, spam, copyright infringement
6. Payment Terms — Stripe processes payments, 70/30 split, payout timing per Stripe Connect
7. Account Termination — suspension for violations, soft-delete with PII scrub
8. Limitation of Liability — standard SaaS limitation

**Privacy Policy content sections:**
1. Data We Collect — email, display name, study data, payment info (via Stripe, not stored by us)
2. How We Use It — account management, AI generation, study tracking, marketplace operations
3. Third-Party Services — Stripe (payments), Supabase (database/storage), Groq/Gemini (AI generation), Resend (email), Sentry (error monitoring — added in Phase 4)
4. Data Retention — active account data retained, soft-deleted accounts scrubbed
5. Your Rights — export (already implemented), deletion (already implemented), access via Settings
6. Cookies — httpOnly JWT only, no tracking cookies, no third-party analytics cookies
7. Children — not directed at children under 13
8. Contact — support email

**Cross-reference:** Add "See full Terms of Service" link to the existing SellerTermsModal component.

### Research Insights: Legal Pages

**Best Practices:**
- Include a "Last Updated" date at the top of both pages — required for compliance and user trust
- Add a "Changes to this Policy" section explaining that updates will be communicated (email or in-app banner)
- AI-generated content disclaimer is especially important — state clearly that AI output may contain errors and users are responsible for verifying accuracy
- Stripe Connect requires a publicly accessible ToS URL during seller onboarding — verify this URL is provided in the Connect OAuth flow

**Edge Cases:**
- Users who signed up before the ToS existed: consider a "terms acceptance" banner on next login (post-launch, not a blocker)
- CCPA applicability: if any users are in California, add a "Do Not Sell" section (even if you don't sell data, CCPA requires the statement)

---

### Phase 3: 404 Page + Error Boundary

**Scope:** Catch-all route, error recovery UI, and server-side API 404.

**New files:**
- `client/src/pages/NotFound.jsx` — 404 page
- `client/src/components/ErrorBoundary.jsx` — React error boundary class component

**Files to modify:**
- `client/src/App.jsx` — add catch-all route, wrap `<Routes>` with `<ErrorBoundary>`
- `client/src/main.jsx` — add React 19 `createRoot` error hooks
- `server/src/index.js` — add JSON 404 catch-all for `/api/*` routes

**NotFound page:**
```jsx
// client/src/pages/NotFound.jsx
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import Navbar from '../components/Navbar';

export default function NotFound() {
  const { user, loading } = useAuth();

  // Guard CTA behind loading state to prevent auth flash
  const ctaTarget = loading ? '/' : (user ? '/dashboard' : '/');
  const ctaLabel = loading ? 'Go Home' : (user ? 'Go to Dashboard' : 'Go Home');

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-24 text-center">
        <h1 className="text-6xl font-bold text-[#1B6B5A] mb-4">404</h1>
        <p className="text-xl text-[#1A1614] mb-2">Page not found</p>
        <p className="text-[#6B635A] mb-8">
          We couldn't find the page you're looking for.
        </p>
        <Link
          to={ctaTarget}
          className="inline-block bg-[#1B6B5A] text-white px-6 py-3 rounded-lg"
        >
          {ctaLabel}
        </Link>
      </main>
    </div>
  );
}
```

**Error Boundary** (must be a class component — React 19 still requires this):
```jsx
// client/src/components/ErrorBoundary.jsx
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };
  isRecovering = false; // Guard flag prevents re-render cascade during navigation

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Sentry integration added in Phase 4 (top-level ESM import + captureException)
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  handleRecover = () => {
    if (this.isRecovering) return;
    this.isRecovering = true;
    // Navigate to / (not /dashboard) — works for both authed and unauthed users.
    // ProtectedRoute/PublicRoute handle the correct redirect from there.
    window.location.href = '/';
    // Full page load resets all React state.
    // Do NOT call setState before navigation — it causes a render
    // of the error tree before the navigation completes.
  };

  render() {
    if (this.state.hasError) {
      // If navigating away, render nothing — page is about to unload
      if (this.isRecovering) return null;
      return (
        <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
          <div className="max-w-md mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-[#1A1614] mb-4">Something went wrong</h1>
            <p className="text-[#6B635A] mb-8">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={this.handleRecover}
              className="bg-[#1B6B5A] text-white px-6 py-3 rounded-lg"
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**App.jsx integration** (ErrorBoundary wraps Routes — Navbar stays in each page per Option 2):
```jsx
// client/src/App.jsx — structure (NO Navbar here — each page renders its own)
// GoogleOAuthProvider is the OUTERMOST wrapper — must be preserved
<GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
  <AuthProvider>
    <Toaster />
    <ErrorBoundary>
      <Routes>
        {/* ... existing routes ... */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  </AuthProvider>
</GoogleOAuthProvider>
```

**Note:** Navbar is NOT moved to App.jsx. Each page continues to import and render `<Navbar />` individually (existing pattern). The ErrorBoundary fallback has no Navbar — this is acceptable because:
- The fallback is a full-page takeover with a "Go Home" button
- The user gets the Navbar back after navigation
- Moving Navbar to App.jsx would require removing it from ~16 page components — too large a refactor for this phase

**React 19 `createRoot` error hooks** (in `main.jsx` — preserves existing `React.StrictMode`):
```jsx
// client/src/main.jsx — add error hooks to createRoot call
// Uses ReactDOM.createRoot (matching existing import: import ReactDOM from 'react-dom/client')
ReactDOM.createRoot(document.getElementById('root'), {
  onUncaughtError(error) {
    // Errors that crash the root — log to Sentry (Phase 4)
    console.error('Uncaught React error:', error);
  },
  onRecoverableError(error) {
    // Hydration mismatches, recoverable issues — log silently
    console.warn('Recoverable React error:', error);
  },
}).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

**Note:** No `onCaughtError` hook — errors caught by ErrorBoundary are already logged in `componentDidCatch`. An empty hook is dead code.

**Server-side API 404** (add after all route registrations in `server/src/index.js`):
```js
// After all app.use('/api/...', router) calls
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});
```

### Research Insights: Error Handling

**Best Practices:**
- ErrorBoundary `handleRecover` should use `window.location.href` (full page load) NOT `setState + navigate` — setState triggers a re-render of the error tree which can throw again before navigation completes
- React 19's `createRoot` error hooks are the new standard for error telemetry — they catch errors that class ErrorBoundary `componentDidCatch` misses (uncaught errors, recoverable errors)
- The API 404 catch-all should be placed BEFORE Sentry's `setupExpressErrorHandler` but AFTER all route registrations

**Edge Cases:**
- **Auth flash on 404:** If `useAuth()` hasn't resolved yet, the 404 page CTA can flash between "Go Home" and "Go to Dashboard". Solution: guard behind `loading` state (implemented above)
- **Double Navbar:** If Navbar is kept per-page AND moved to App.jsx, some pages will render it twice. The plan keeps Navbar in pages, so this isn't a risk — but document it as a known pattern for future refactors

---

### Phase 4: Sentry Error Monitoring

**Scope:** Client + server error tracking. Depends on Phase 3 (ErrorBoundary integration). Trimmed to essentials — no Replay, no performance tracing at launch scale.

**New dependencies:**
- Client: `@sentry/react`, `@sentry/vite-plugin`
- Server: `@sentry/node`

**Files to modify:**
- `client/src/main.jsx` — Sentry init before ReactDOM
- `client/vite.config.js` — add `@sentry/vite-plugin` for source map upload
- `client/src/components/ErrorBoundary.jsx` — add `Sentry.captureException` in `componentDidCatch`
- `client/src/lib/AuthContext.jsx` — set Sentry user context on login, clear on logout
- `server/src/index.js` — Sentry init at top, `Sentry.setupExpressErrorHandler(app)` after routes
- `server/.env.example` — add `SENTRY_DSN`
- `client/.env.example` — add `VITE_SENTRY_DSN`

**Client initialization** (`client/src/main.jsx`):
```js
import * as Sentry from '@sentry/react';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // No Replay, no performance tracing — add when needed
    beforeSend(event) {
      // Scrub PII: remove user email/name if accidentally attached
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}
```

**Server initialization** (`server/src/index.js` — at very top after dotenv):
```js
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    // No performance tracing — add when needed
    beforeSend(event) {
      // Scrub PII from server errors (request bodies may contain passwords, cookies contain JWT)
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      if (event.request?.data) {
        delete event.request.data;
      }
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers?.cookie) {
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}

// ... Express app setup ...

// After all routes and API 404, before the generic error handler
Sentry.setupExpressErrorHandler(app);

// Generic catch-all error handler — prevents Express from leaking stack traces
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});
```

**ErrorBoundary integration** (uses top-level ESM import — `require()` does not work in this Vite/ESM codebase):
```js
// At the top of ErrorBoundary.jsx
import * as Sentry from '@sentry/react';

// In componentDidCatch
componentDidCatch(error, errorInfo) {
  if (typeof Sentry?.captureException === 'function') {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }
  if (import.meta.env.DEV) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }
}
```

**User context** (in AuthContext.jsx):
```js
// On successful login/signup
import * as Sentry from '@sentry/react';
Sentry.setUser({ id: user.id });

// On logout
Sentry.setUser(null);
```

**Privacy:** Capture user ID only, not email or name. `beforeSend` strips any accidentally attached PII. Disclose in Privacy Policy (Phase 2).

**Source maps** (`client/vite.config.js`):
```js
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig({
  build: { sourcemap: 'hidden' }, // Upload to Sentry but don't serve publicly
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'], // Remove maps from deploy
      },
    }),
  ],
});
```

**React 19 createRoot hooks integration** (update `onUncaughtError` from Phase 3 to add Sentry):
```js
// In the ReactDOM.createRoot options from Phase 3
onUncaughtError(error) {
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, { level: 'fatal' });
  }
  console.error('Uncaught React error:', error);
},
```

**Prerequisite:** Create a Sentry project (free tier, 5K errors/month). One project for the client, one for the server, or a single project with environment tags.

### Research Insights: Sentry

**Best Practices (2024-2026):**
- Use `sourcemap: 'hidden'` instead of `sourcemap: true` — uploads maps to Sentry for readable stack traces but doesn't serve them publicly (security best practice)
- Use `filesToDeleteAfterUpload` to remove `.map` files from the deployment artifact
- `beforeSend` is the right place for PII scrubbing — defense in depth beyond just not setting it
- Skip Replay and performance tracing at launch — they consume quota and add bundle size. Add when you have enough users to make the data useful.

**What NOT to do:**
- Don't add `tracesSampleRate` or `Sentry.browserTracingIntegration()` yet — these add HTTP overhead per request and consume Sentry quota. At pre-launch scale, you don't need performance monitoring.
- Don't add `Sentry.replayIntegration()` yet — it adds ~50KB to the bundle and is most valuable once you have real user flows to debug.

---

### Phase 5: Email Verification Plumbing

**Scope:** Expose `email_verified` to the client and add middleware. **Trimmed significantly** — all current users are verified (Google + magic link auto-verify), so this is pure infrastructure for future auth methods. Dashboard banner and "verify now" flow deferred until an unverified auth method exists.

**Files to modify:**
- `server/src/routes/auth.js` — add `email_verified` + `token_revoked_at` to `USER_SELECT`, add `email_verified` to `sanitizeUser` (3 lines)
- `server/src/middleware/auth.js` — add `requireEmailVerified` export

**USER_SELECT change** (`server/src/routes/auth.js:11-16`):

Add `email_verified` and `token_revoked_at` to the existing string. Do NOT rewrite — the real `USER_SELECT` has 20+ fields.

**Why `token_revoked_at`?** The `/me` endpoint (auth.js:158) checks `user.token_revoked_at` to reject revoked sessions, but the current `USER_SELECT` doesn't include it. This means `user.token_revoked_at` is always `undefined`, and the revocation check silently passes. The `authenticate` middleware does its own query for `token_revoked_at` (so protected routes work), but `/me` is a public endpoint that bypasses `authenticate` — making it the one place revocation is broken.
```diff
  display_name, role, suspended, google_user_id, created_at,
- avatar_url, google_avatar_url, preferences,
+ avatar_url, google_avatar_url, preferences, email_verified, token_revoked_at,
  (password_hash IS NOT NULL) AS has_password
```

**sanitizeUser change** (`server/src/routes/auth.js:32-63`):

Add `email_verified` only — `token_revoked_at` is used server-side by `/me` but must NOT be exposed to the client. The real `sanitizeUser` uses `snake_case` and includes avatar resolution logic, `google_connected`, etc. — do NOT rewrite it.
```diff
  has_password: user.has_password,
  google_connected: !!user.google_user_id,
+ email_verified: !!user.email_verified,
  preferences: user.preferences || {},
```

**Middleware** (lightweight — add to existing `server/src/middleware/auth.js`):
```js
// server/src/middleware/auth.js (add to existing exports)
export async function requireEmailVerified(req, res, next) {
  // If loadUser middleware is adopted, read from req.userRecord instead
  const { rows } = await pool.query(
    'SELECT email_verified FROM users WHERE id = $1 AND deleted_at IS NULL',
    [req.userId]
  );
  if (!rows[0]?.email_verified) {
    return res.status(403).json({
      error: 'email_verification_required',
      message: 'Please verify your email to use this feature.'
    });
  }
  next();
}
```

**Deferred (not needed for launch):**
- Gating marketplace/seller endpoints behind `requireEmailVerified` — defer until an unverified auth method exists. Currently all users are verified, so the middleware would never trigger.
- Dashboard verification banner and "verify now" flow — no unverified users exist to show it to.
- Client error handling for `email_verification_required` — no endpoint returns it yet.

**Why still build the USER_SELECT + middleware?**
1. Exposes `emailVerified` to the client for future UI decisions (2 lines of code)
2. The middleware is ready to chain onto endpoints when email/password signup is added
3. Prevents a larger retrofit later — the pattern is established and can be tested

### Research Insights: Email Verification

**Performance note (Performance Oracle):** The `requireEmailVerified` middleware as written issues its own DB query. When this middleware is eventually chained onto routes that already call `authenticate()` + `checkTrialExpiry` + `requirePlan()`, it creates 3-4 DB queries per request for the same user. **Mitigation:** When you start chaining this middleware, introduce the `loadUser` consolidation pattern described in the Architecture section above.

**Pattern note (Auth Guide Learnings):** The magic link flow already sets `email_verified = true` in `auth-magic.js`. Google OAuth should do the same in the Google callback. Verify both paths set it.

---

### Phase 6: Password Recovery UX

**Scope:** Enable users to set or reset passwords from Settings without knowing their current password, using magic link verification as proof of identity. Also add a "Forgot password?" help text on the Login page.

**Key insight:** The Login page already IS the password recovery flow — users log in via magic link. The actual gap is in Settings: users who authenticated via magic link and have `has_password = false` can't set a password, and users who forgot their password can't reset it in Settings because the change form requires `currentPassword`.

**Files to modify:**
- `client/src/pages/Login.jsx` — add "Forgot your password? Use the email login above" help text
- `client/src/pages/Settings.jsx` — add "Set password" form for users with `has_password = false`
- `server/src/routes/account.js` — modify `PATCH /api/account/password` to allow setting password without current when `password_hash IS NULL`

**Login page change** (minimal — just explanatory text):
```jsx
{/* Below the magic link email form */}
<p className="text-xs text-[#6B635A] mt-2">
  You can always sign in with a code — no password needed.
</p>
```

**Note:** The Login page has no password field (only Google + magic link), so "Forgot your password?" text would be misleading. This wording is clearer and doesn't imply a password field exists.

**Settings page — dual password forms:**

The Settings Security section should show one of two forms:

**Form A: "Set Password"** (when `user.has_password === false`):
- New password input
- Confirm password input
- "Set Password" button
- No `currentPassword` required — the user just proved identity via magic link/Google login

**Form B: "Change Password"** (when `user.has_password === true` — existing form):
- Current password input
- New password input
- Confirm password input
- "Change Password" button

**Important: existing guard must be replaced.** The current endpoint at `account.js:106` has `if (!currentPassword || !newPassword)` which rejects requests where `currentPassword` is absent. The new code below replaces the entire handler — it checks `if (!currentPassword)` as a branch point (set vs change), not a rejection.

**Server endpoint change** (`PATCH /api/account/password`):

Preserves the existing middleware chain: `authenticate, requireXHR, requireActiveUser, passwordLimiter`.
```js
// server/src/routes/account.js — PATCH /api/account/password
router.patch('/password', authenticate, requireXHR, requireActiveUser, passwordLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate new password — fail fast before any DB queries
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (newPassword.length > 128) {
      return res.status(400).json({ error: 'Password must be 128 characters or fewer' });
    }

    // Atomic check-and-set for users with no password
    // Single UPDATE with WHERE password_hash IS NULL prevents race condition
    // Uses NOW() - INTERVAL '1 second' so the fresh JWT (iat ≈ NOW()) stays valid
    if (!currentPassword) {
      const { rowCount } = await pool.query(
        `UPDATE users SET password_hash = $1, token_revoked_at = NOW() - INTERVAL '1 second'
         WHERE id = $2 AND password_hash IS NULL`,
        [await bcrypt.hash(newPassword, SALT_ROUNDS), req.userId]
      );
      if (rowCount === 0) {
        // password_hash was NOT null — they need to provide currentPassword
        return res.status(400).json({ error: 'Current password is required' });
      }
      setTokenCookie(res, req.userId);
      return res.json({ ok: true });
    }

    // Existing flow: verify current password, then update
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
    if (!rows[0].password_hash) {
      return res.status(400).json({ error: 'No password set' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query(
      "UPDATE users SET password_hash = $1, token_revoked_at = NOW() - INTERVAL '1 second' WHERE id = $2",
      [hash, req.userId]
    );

    setTokenCookie(res, req.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Security hardening (from Security Sentinel + Pattern Recognition reviews):**

1. **Full middleware chain preserved** — `requireXHR` (CSRF protection), `requireActiveUser` (deleted/revoked check), `passwordLimiter` (5 req/15min brute-force protection). These match the existing endpoint at `account.js:103`.

2. **Atomic single-query update** — `UPDATE users SET password_hash = $1, token_revoked_at = NOW() - INTERVAL '1 second' WHERE id = $2 AND password_hash IS NULL` combines password set + token revocation in one query. The `WHERE password_hash IS NULL` prevents race conditions. The `- INTERVAL '1 second'` ensures the fresh JWT (issued at ~`NOW()`) has an `iat` after `token_revoked_at`, keeping the current session valid. Matches existing pattern at `account.js:121-124`.

3. **Password validation** — minimum 8 characters, maximum 128 characters enforced server-side. Max prevents bcrypt's 72-byte silent truncation from surprising users and guards against oversized payloads.

4. **Validation ordering** — validate `newPassword` length before doing any DB queries. Fail fast on bad input.

5. **Response shape `{ ok: true }`** — follows the codebase pattern for mutation responses (e.g., avatar delete, preferences update).

6. **Client-side: call `refreshUser()` after successful password set** — the in-memory user object has `has_password: false`. Without refreshing, Settings continues showing the "Set Password" form. Submitting again returns "Current password is required" (confusing). The `refreshUser()` call syncs the client with the new `has_password: true` state.

**Client-side "Set Password" form handler** (in Settings.jsx security section):

The existing `api.changePassword(currentPassword, newPassword)` at `api.js:108` already sends `{ currentPassword, newPassword }`. For "Set Password", call it with `null` for `currentPassword`:
```jsx
// Settings.jsx — Set Password handler (when user.has_password === false)
const handleSetPassword = async (e) => {
  e.preventDefault();
  if (newPassword !== confirmPassword) {
    return toast.error('Passwords do not match');
  }
  try {
    await api.changePassword(null, newPassword);
    toast.success('Password set successfully');
    refreshUser(); // Sync has_password: true so form switches to "Change Password"
    setNewPassword('');
    setConfirmPassword('');
  } catch (err) {
    toast.error(err.message);
  }
};
```

**Why `refreshUser()` is critical:** After setting a password, the in-memory user object still has `has_password: false`. Without refreshing, the "Set Password" form stays visible. If the user submits again, the server returns "Current password is required" (confusing). `refreshUser()` re-fetches `/me`, syncing `has_password: true`, and the UI switches to the "Change Password" form.

**`has_password` field:** Already included in `sanitizeUser` (checks `!!row.password_hash`). The client already knows whether the user has a password. The Settings page at lines 325-383 already conditionally renders based on `has_password`.

---

## Acceptance Criteria

### Phase 1: Meta Tags
- [x] `index.html` has meta description, OG tags (title, description, image, url, type), Twitter card tags
- [x] Favicon displays in browser tab
- [x] Apple touch icon works on iOS "Add to Home Screen"
- [x] Social share preview renders correctly (test with https://opengraph.dev or similar)
- [x] No `manifest.json` — deferred to post-launch

### Phase 2: Legal Pages
- [ ] `/terms` renders Terms of Service page with Navbar and Footer
- [ ] `/privacy` renders Privacy Policy page with Navbar and Footer
- [ ] Both pages are accessible without authentication
- [ ] Both pages show "Last Updated" date at the top
- [ ] Footer component appears on Landing, Terms, Privacy, Pricing, Marketplace pages
- [ ] Landing page inline footer replaced with shared Footer component
- [ ] Login page shows "By continuing, you agree to our Terms and Privacy Policy" with links
- [ ] Seller terms modal links to full Terms of Service

### Phase 3: Error Handling
- [ ] Navigating to `/nonexistent-url` shows NotFound page with Navbar and contextual CTA
- [ ] NotFound page shows "Go to Dashboard" for authenticated users, "Go Home" for others
- [ ] NotFound CTA does not flash between states during auth loading
- [ ] React component crash shows ErrorBoundary fallback UI (not white screen)
- [ ] ErrorBoundary recovery navigates to `/` via `window.location.href` (works for both authed and unauthed)
- [ ] ErrorBoundary has `isRecovering` guard flag — render returns `null` during navigation
- [ ] `componentDidCatch` console.error is dev-only (`import.meta.env.DEV`)
- [ ] `React.StrictMode` is preserved in `main.jsx`
- [ ] `createRoot` error hooks are configured (`onUncaughtError`, `onRecoverableError`)
- [ ] Navbar is NOT added to App.jsx — stays in individual page components (Option 2)
- [ ] `GET /api/nonexistent` returns `{ "error": "Not found" }` with 404 status (not HTML)

### Phase 4: Sentry
- [ ] Client errors are captured in Sentry with source-mapped stack traces
- [ ] Server errors are captured in Sentry
- [ ] User ID is attached to Sentry events (not email)
- [ ] Client `beforeSend` strips any PII (email, username) from events
- [ ] Server `beforeSend` strips PII and request body data (may contain passwords)
- [ ] Generic Express error handler added after `Sentry.setupExpressErrorHandler` — returns JSON, not HTML
- [ ] ErrorBoundary uses top-level ESM `import * as Sentry` (NOT `require()`)
- [ ] ErrorBoundary guards Sentry call with `typeof Sentry?.captureException === 'function'`
- [ ] `createRoot` `onUncaughtError` reports to Sentry with `level: 'fatal'`
- [ ] Sentry only initializes when DSN env var is set (no-op in local dev without DSN)
- [ ] Source maps use `sourcemap: 'hidden'` and are deleted after upload
- [ ] No Replay integration, no performance tracing (deferred)

### Phase 5: Email Verification
- [ ] `email_verified` added to existing `USER_SELECT` string (one field, not a rewrite)
- [ ] `email_verified: !!user.email_verified` added to existing `sanitizeUser` return (one line, snake_case)
- [ ] `email_verified` is included in API responses (`GET /api/auth/me`, login, signup)
- [ ] `requireEmailVerified` middleware exists and returns 403 with `email_verification_required` error code
- [ ] Middleware is NOT yet chained onto any endpoints (deferred until unverified auth method exists)
- [ ] No Dashboard banner (deferred)

### Phase 6: Password Recovery
- [ ] Login page shows "You can always sign in with a code" help text (not "Forgot your password?")
- [ ] Settings page shows "Set Password" form when user has no password
- [ ] "Set Password" form requires only new password + confirm (no current password)
- [ ] Settings page shows "Change Password" form when user has a password (existing behavior)
- [ ] Server validates password min 8 / max 128 characters before any DB queries
- [ ] Middleware chain preserved: `authenticate, requireXHR, requireActiveUser, passwordLimiter`
- [ ] `PATCH /api/account/password` uses atomic single-query `UPDATE SET password_hash, token_revoked_at WHERE password_hash IS NULL`
- [ ] Token revocation uses `NOW() - INTERVAL '1 second'` (matches existing pattern at account.js:122)
- [ ] Setting a password issues a fresh JWT via `setTokenCookie`
- [ ] Response shape is `{ ok: true }`
- [ ] Client calls `refreshUser()` after successful password set to sync `has_password` state

## Dependencies & Ordering

```
Phase 1 (Meta Tags)      ──── independent, quick win
Phase 2 (Legal Pages)     ──── independent, but referenced by Phase 4 privacy policy
Phase 3 (Error Handling)  ──── independent, required before Phase 4
Phase 4 (Sentry)          ──── depends on Phase 3 (ErrorBoundary integration)
Phase 5 (Email Verify)    ──── independent, minimal (2 lines + middleware stub)
Phase 6 (Password UX)     ──── independent
```

**Recommended build order:** 1 → 2 → 3 → 4 → 5 → 6

Phases 1, 2, 5, and 6 are fully independent and could be parallelized. Phase 4 depends on Phase 3.

## Success Metrics

- Zero white-screen crashes in production (ErrorBoundary + Sentry catch everything)
- Social share previews render correctly on Twitter, Slack, Discord, iMessage
- Legal pages accessible and linked from signup flow
- All Sentry errors have user ID and source-mapped stack traces (no PII)
- Password recovery flow works for all auth methods (Google, magic link, email/password)

## Risk Analysis

| Risk | Mitigation |
|------|------------|
| Legal content accuracy | Use a generator (Termly/iubenda) as starting point, customize for marketplace specifics. Flag for legal review before major marketing push. |
| Sentry source map upload failing in CI | Use `sourcemap: 'hidden'` + `filesToDeleteAfterUpload`. Plugin is optional — Sentry still captures errors, just with minified traces. |
| Email verification gating active users | Middleware exists but is NOT chained onto any endpoints yet. Zero impact on current users. |
| Favicon/OG image design quality | Start with simple SVG notecard icon. Can iterate on design without code changes. |
| Race condition on password set | Atomic single-query `UPDATE SET password_hash, token_revoked_at WHERE password_hash IS NULL` — DB enforces single-writer. |
| Stale JWT after password change | Token revocation with `- INTERVAL '1 second'` offset + fresh JWT via `setTokenCookie`. Client calls `refreshUser()` to sync state. |
| Stack trace leakage in production | Generic Express error handler after Sentry returns JSON `{ error: 'Internal server error' }`, not HTML. |
| Server PII in Sentry events | Server-side `beforeSend` strips `event.user.email`, `event.user.username`, and `event.request.data`. |

## References

### Source Files
- `client/src/App.jsx` — route definitions, ProtectedRoute/PublicRoute guards (lines 56-72)
- `client/index.html` — HTML shell, currently 15 lines, missing everything
- `client/src/pages/Landing.jsx` — inline footer at lines 167-171
- `client/src/pages/Login.jsx` — Google + magic link only, no password field
- `client/src/pages/Settings.jsx` — password change form requires currentPassword (lines 325-383)
- `client/src/components/Navbar.jsx` — shared nav, no footer
- `server/src/index.js` — Express setup, route mounting, no API 404 catch-all
- `server/src/middleware/auth.js` — authenticate() + requireActiveUser(), no requireEmailVerified
- `server/src/routes/auth.js` — USER_SELECT and sanitizeUser() missing email_verified
- `server/src/routes/auth-magic.js` — magic link flow, sets email_verified = true
- `server/src/routes/account.js` — PATCH /api/account/password requires currentPassword (lines 102-133)
- `server/src/services/email.js` — Resend integration (sendMagicLinkCode)

### Brainstorm
- `docs/brainstorms/2026-03-14-pre-launch-blockers-brainstorm.md`

### Related Solutions
- `docs/solutions/auth-implementation-guide.md` — JWT patterns, token revocation, `setTokenCookie` usage
- `docs/solutions/feature-patterns/account-settings-experience.md` — Settings architecture, conditional form rendering
