# Secrets And Access Scrub

Last updated: 2026-03-22

This note records the current secrets/access review for the Polsia sandbox before broader collaboration access.

## Result

The sandbox is now materially safer to share for engineering collaboration, with the highest-risk local secret files scrubbed before transfer.

## Findings

### Real env files were present locally and have now been scrubbed

The local working copy previously contained populated runtime env files:

- `server/.env`
- `mobile/.env`

Those local files have now been cleared so they are not transferred as part of the handoff copy.

### Example files also exist

Template/example files are present and are the safe files that should remain the source of truth for shared setup:

- `server/.env.example`
- `mobile/.env.example`
- `client/.env.example`

### Checked-in docs contain placeholder examples and historical connection strings

The scan found:

- normal placeholder examples in README and `.env.example` files
- historical plan docs with example database connection strings and provider setup instructions

These are less serious than live `.env` files, but they still mean repo-sharing should be selective and intentional.

### Historical docs had local absolute filesystem paths

Some older audit/plan/solution docs contained absolute local paths under `/Users/kashane/...`.

Those personal path references have now been replaced with neutral repo-oriented paths in the handoff copy.

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

1. Confirm no production-only credentials are reintroduced into local config files before future transfers
2. Prefer sharing `.env.example` plus this document instead of real `.env` files
3. Keep Apple, RevenueCat, Stripe, and Expo account access founder-controlled unless explicitly delegated
4. Treat placeholder connection strings in historical docs as examples only, not live values

## Current recommendation

For now:

- collaborate against code and docs freely
- use `.env.example` and the environment manifest as the setup source of truth
- keep secrets and third-party account access out of the transferred repo copy
