---
date: 2026-03-14
topic: pre-launch-blockers
---

<!-- FINISHED -->

# Pre-Launch Blockers

## What We're Building

Six foundational pieces that must exist before real users pay real money: forgot password recovery, legal pages, error handling, meta tags, email verification enforcement, and error monitoring. These aren't features — they're prerequisites. Without them the app is a project, not a product.

## Why This Approach

Every item here addresses a scenario where a real user would hit a wall, lose trust, or expose us to legal risk. A user who forgets their password and can't recover it is gone forever. A marketplace processing Stripe payments without a Terms of Service is a liability. An app with no error boundary shows a white screen on any component crash. These are the "last 10%" that separate shipped from shippable.

## Feature Details

### 1. Forgot Password Flow

**Problem:** Users who signed up with email/password and forget it have zero recovery path. Magic link auth exists but isn't positioned as password recovery — it's a separate login method on a different tab.

**Approach:**

- Add "Forgot password?" link below the email/password login form
- Clicking it opens the magic link flow (reuse existing infrastructure)
- When a user logs in via magic link and has no password set, offer to set one
- When a user logs in via magic link and has a password they forgot, they're already in — they can change it in Settings

**Architecture:** No new backend work needed. Magic link already authenticates the user. The "forgot password" link is essentially a UX redirect to the magic link tab with messaging like "We'll send you a code to sign in. You can reset your password in Settings."

**Alternative considered:** Dedicated password reset tokens with expiring links. Rejected — we already have magic link codes with 10-minute expiry and 3 attempt limits. Building a parallel system is redundant.

**Open question:** Should we auto-show the magic link tab when someone clicks "Forgot password?", or should it be a separate mini-flow with different copy ("Reset your password" vs "Sign in with email code")?

### 2. Legal Pages (Terms of Service + Privacy Policy)

**Problem:** We're running a marketplace with Stripe Connect processing real money between users. No Terms of Service, no Privacy Policy, no link anywhere in the app. Stripe requires a ToS link during Connect onboarding. App stores require a Privacy Policy URL. GDPR requires clear data processing disclosure.

**Approach:**

- Create `/terms` and `/privacy` routes (static content pages, same warm parchment design)
- Add footer links on Landing page, Login page, and Settings page
- Link ToS from seller terms acceptance modal
- Link Privacy Policy from signup form (small text: "By signing up, you agree to our Terms and Privacy Policy")
- Content should cover: data collection, AI processing, payment handling, marketplace rules, account deletion rights, cookie usage

**Content scope:**

- **Terms of Service:** Account responsibilities, marketplace rules (pricing, content standards, refund policy), AI-generated content disclaimers, intellectual property, limitation of liability, termination
- **Privacy Policy:** What data we collect (email, name, study data, payment info via Stripe), how it's used, third-party services (Stripe, Supabase, Groq, Gemini, Resend), data retention, deletion rights (already implemented), cookie policy (httpOnly JWT only — no tracking cookies)

**Open question:** Write these ourselves or use a generator (like Termly or iubenda) as a starting point? Generator gets us 80% there with proper legal structure, then we customize for marketplace specifics.

### 3. 404 Page + React Error Boundary

**Problem:** Invalid URLs render blank — no catch-all route in App.jsx. A component crash (bad data from API, null reference) takes down the entire app with a white screen. No way to recover without a hard refresh.

**Approach:**

- Add `<Route path="*" element={<NotFound />} />` as the last route in App.jsx
- NotFound page: simple message, link to Dashboard (authenticated) or Landing (unauthenticated), matches design system
- Wrap the main app content in a React Error Boundary component
- Error boundary: "Something went wrong" message, "Go to Dashboard" button, optionally logs to Sentry (if integrated)
- Error boundary should NOT wrap the Navbar — keep navigation functional even on error

**Design:** Match the warm parchment aesthetic. Friendly tone ("We couldn't find that page" not "404 Error"). Include the app logo and navigation so users don't feel lost.

### 4. Meta Tags + Open Graph + Favicon

**Problem:** index.html has only a title tag. Social shares show no preview image or description. No favicon — browser tab shows a generic icon. No meta description for search engines. Marketplace listings shared on social media look broken.

**Approach:**

- **Meta description:** "AI-powered flashcard app. Paste your notes, AI generates study cards. Buy and sell decks on the marketplace."
- **Open Graph tags:** og:title, og:description, og:image (need a 1200x630 social card image), og:url, og:type=website
- **Twitter Card tags:** twitter:card=summary_large_image, twitter:title, twitter:description, twitter:image
- **Favicon:** Design a simple notecard icon in the brand green (#1B6B5A). Include favicon.ico + apple-touch-icon + web manifest icon sizes
- **Web manifest:** Basic manifest.json for PWA "add to home screen" capability (name, short_name, icons, theme_color, background_color)

**Open question:** Should marketplace listing pages have dynamic OG tags? This would require server-side rendering or a meta tag injection service (like prerender.io). For v1, static OG tags on all pages is fine — dynamic per-listing is a nice-to-have.

### 5. Email Verification Enforcement

**Problem:** The `email_verified` column exists on users but is never checked in route middleware. Users can sign up with fake emails and use the full app, including purchasing decks with real money. Magic link and Google auth auto-verify, but email/password signup does not verify.

**Approach:**

- Send a verification email on email/password signup (reuse magic link infrastructure — send a code, verify it)
- Gate marketplace purchases behind verified email
- Gate seller listing creation behind verified email
- Show a dismissable banner on Dashboard: "Verify your email to unlock all features"
- Don't gate basic features (generate, study) behind verification — let users experience value first

**Architecture:** Reuse magic link codes table. On signup, generate a code and send it via Resend. Add a `POST /api/auth/verify-email` endpoint (or reuse magic link verify). Add `requireVerifiedEmail` middleware for purchase and seller routes.

**Alternative considered:** Don't enforce at all — just track it. Rejected because marketplace purchases with unverified emails create chargeback risk and make seller notifications unreliable.

### 6. Error Monitoring (Sentry)

**Problem:** No error tracking in production. If the app crashes, a webhook fails, or a Stripe payment goes wrong, we have no way to know unless a user reports it. Console.log disappears into Railway's void.

**Approach:**

- Add `@sentry/react` to client (catches React rendering errors, unhandled promise rejections, network errors)
- Add `@sentry/node` to server (catches unhandled exceptions, Express error middleware integration)
- Configure source maps upload in Vite build for readable stack traces
- Set up Sentry alerts for: error spike, new error type, webhook failure
- Tag errors with user plan (free/trial/pro) and route for triage

**Cost:** Sentry free tier covers 5K errors/month — more than enough for launch.

**Open question:** Add Sentry to the error boundary component so errors are auto-reported? Yes — this is the primary integration point.

## Key Decisions

| Decision               | Choice                      | Reasoning                                                   |
| ---------------------- | --------------------------- | ----------------------------------------------------------- |
| Forgot password method | Reuse magic link            | Infrastructure already exists, no parallel token system     |
| Legal content          | Generator + customize       | Gets legal structure right, we add marketplace specifics    |
| Error boundary scope   | Below Navbar                | Keep navigation functional during crashes                   |
| OG tags                | Static for v1               | Dynamic per-listing requires SSR, overkill for launch       |
| Email verification     | Gate purchases/selling only | Let unverified users experience core features first         |
| Error monitoring       | Sentry                      | Free tier sufficient, industry standard, source map support |

## Implementation Priority

Recommended build order:

1. **404 + Error Boundary** — smallest change, immediate quality improvement
2. **Meta tags + favicon** — static HTML changes, no backend
3. **Forgot password UX** — frontend-only, reuses existing magic link
4. **Sentry integration** — npm install + init, minimal code
5. **Legal pages** — content writing + two new routes
6. **Email verification** — new middleware + signup flow change

## Scope Boundaries

**In scope:** Everything listed above — six discrete pieces of work.

**Out of scope:**

- Dynamic OG tags per marketplace listing (future)
- Cookie consent banner (we only use httpOnly JWT, no tracking cookies)
- GDPR data portability (export already exists)
- Accessibility audit (separate effort)
- CI/CD pipeline (separate effort)
