# Secrets And Access Scrub

Last updated: 2026-03-22

This note records the current secrets/access review for the Polsia sandbox before broader collaboration access.

## Result

The sandbox is not yet in a clean shareable state for deeper external collaboration without redaction or access discipline.

## Findings

### Real env files are present

The repo currently contains populated runtime env files:

- `server/.env`
- `mobile/.env`

That is the main immediate access risk.

### Example files also exist

Template/example files are present and are the safe files that should remain the source of truth for shared setup:

- `server/.env.example`
- `mobile/.env.example`
- `client/.env.example`

### Checked-in docs contain placeholder examples and historical connection strings

The scan found:

- normal placeholder examples in README and `.env.example` files
- historical plan docs with example database connection strings and provider setup instructions

These are less serious than the real `.env` files, but they still mean repo-sharing should be selective and intentional.

## External-service assumptions currently embedded in the sandbox

The codebase assumes potential access to some or all of these services:

- PostgreSQL
- AI provider credentials
- Resend
- Google auth
- Apple Sign In
- Stripe
- RevenueCat
- Supabase storage
- Sentry
- PostHog
- Expo / EAS

That does not mean all are required for web-core collaboration, but it does mean the sandbox reflects a live-ish working copy rather than a fully scrubbed demo repo.

## Required action before deeper collaboration access

1. Remove or redact populated `server/.env`
2. Remove or redact populated `mobile/.env`
3. Confirm no production-only credentials remain in local config files before granting direct repo access
4. Prefer sharing `.env.example` plus this document instead of real `.env` files
5. Keep Apple, RevenueCat, Stripe, and Expo account access founder-controlled unless explicitly delegated

## Current recommendation

For now:

- document against the sandbox freely
- collaborate against code and docs freely
- do not treat the repo as ready for unrestricted credential-bearing access until the real env files are scrubbed
