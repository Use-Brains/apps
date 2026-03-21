---
date: 2026-03-13
topic: auth-revamp
---

<!-- FINISHED -->

# Auth Revamp: Google + Apple + Magic Link

## What We're Building

Replace the current email/password + Apple sign-in screen with a streamlined three-option auth flow: Google Sign-In, Sign in with Apple, and passwordless magic link (email a 6-digit code). The goal is to maximize email collection for direct marketing outside the iOS app, enabling Stripe-direct purchases that bypass Apple's 30% fee.

## Why This Approach

- **Google Sign-In** always provides the user's real email — highest value for the direct outreach goal
- **Sign in with Apple** is required by Apple when offering any social login, but "Hide My Email" relay addresses limit marketing utility
- **Magic link** replaces email/password with zero-friction passwordless flow (enter email → receive code → done), and guarantees a real email address
- Three options is the sweet spot — enough for "big app feel" without paradox-of-choice friction
- Facebook and X/Twitter were considered and rejected: FB SDK is bloated with declining usage, X doesn't reliably provide email

## Login Screen Layout

```
┌─────────────────────────────┐
│                             │
│      [App Icon]             │
│      AI Notecards           │
│      Generate flashcards    │
│                             │
│  [ G  Continue with Google] │  ← top position (subtle conversion edge)
│  [   Continue with Apple ] │  ← same size/prominence (Apple guideline)
│                             │
│  ──────────  or  ────────── │
│                             │
│  [ Email address field    ] │
│  [ Continue with Email    ] │  ← triggers magic link flow
│                             │
│                             │
└─────────────────────────────┘
```

- Google and Apple buttons are **equal size and visual weight** (Apple requires this)
- Google is first (top position = ~60% more taps, subtle enough to pass App Review)
- Email/magic link below the divider catches users without Google/Apple preference

## Magic Link Flow

1. User enters email, taps "Continue with Email"
2. Backend generates a 6-digit code, stores it with 10-minute expiry
3. Email sent via transactional email service (Resend, SendGrid, or similar)
4. App navigates to code entry screen
5. User enters code → backend verifies → returns JWT → logged in
6. If user doesn't exist, account is auto-created (sign up = sign in, no separate flow)

## Key Decisions

- **Remove password UI from both iOS and web**: backend password endpoints stay intact (not deleted), just not surfaced. Can be re-enabled later if needed.
- **Web client also switches to magic link**: same auth flow across both platforms.
- **Magic link = unified sign-in/sign-up**: no separate signup screen needed. Enter email → if account exists, log in; if not, create account. Reduces friction.
- **Display name prompt**: shown after first magic-link sign-in for new users only.
- **Google button first, Apple second**: both same size/weight per Apple guidelines, but top position gives Google a subtle edge for email collection.
- **Email provider: Resend**: 3,000 emails/month free (100/day), excellent deliverability, 3-line Node.js SDK. Raw SMTP (Gmail/iCloud) rejected — Google blocks automated sending from data center IPs, no SPF/DKIM, emails land in spam. AWS SES is cheaper at scale but overkill setup for indie launch.
- **6-digit numeric code over clickable link**: codes work better on mobile (user stays in the app, no Safari redirect). 10-minute expiry.

## Open Questions

- Rate limiting on magic link requests (prevent abuse / email bombing)?
- Should existing password users be migrated to magic link, or grandfathered in?

## Next Steps

→ `/workflows:plan` for implementation details
