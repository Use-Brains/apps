# Environment Manifest

This document describes the environment variables and runtime expectations for the Polsia sandbox.

Primary source files:

- `server/.env.example`
- `mobile/.env.example`
- `client/.env.example`
- `server/config/runtime.js`
- `mobile/app.config.js`

## Runtime surfaces

- web client: `client/`
- backend: `server/`
- iOS app: `mobile/`

The current handoff target assumes unified Express-serves-client for deployed web-core use.

## Web-core minimum local boot

Minimum variables for a meaningful web-core handoff boot:

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `JWT_SECRET`
- one AI provider key:
  - `GROQ_API_KEY`
  - or `GEMINI_API_KEY`
- `CLIENT_URL`

Recommended handoff defaults:

- `SERVE_CLIENT_BUILD=true`
- `FEATURE_SELLER_TOOLS=false`
- `FEATURE_NATIVE_AUTH_SESSIONS=true`
- `FEATURE_NATIVE_BILLING=true`
- `FEATURE_PUSH_NOTIFICATIONS=true`
- `IOS_MARKETPLACE_WEB_PURCHASES_ENABLED=true`

## Server environment variables

### Required for web-core handoff slice

- `DATABASE_URL`
- `DATABASE_URL_DIRECT`
- `JWT_SECRET`
- `CLIENT_URL`
- `PORT`
- `NODE_ENV`
- `SERVE_CLIENT_BUILD`
- `AI_PROVIDER`
- `GROQ_API_KEY` or `GEMINI_API_KEY`

### Optional but active in code

- `DATABASE_POOL_MAX`
- `DATABASE_IDLE_TIMEOUT_MS`
- `DATABASE_CONNECTION_TIMEOUT_MS`
- `DATABASE_SSL_MODE`
- `CLIENT_DIST_PATH`
- `FEATURE_SELLER_TOOLS`
- `FEATURE_NATIVE_AUTH_SESSIONS`
- `FEATURE_NATIVE_BILLING`
- `FEATURE_PUSH_NOTIFICATIONS`
- `IOS_MARKETPLACE_WEB_PURCHASES_ENABLED`
- `MARKETPLACE_PLATFORM_FEE_RATE`
- `SENTRY_DSN`
- `POSTHOG_API_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_IOS_CLIENT_ID`
- `APPLE_BUNDLE_ID`
- `APPLE_SERVICE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STORAGE_PROVIDER`
- `STORAGE_PUBLIC_BASE_URL`

### Billing and seller specific

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PRO_ANNUAL_PRICE_ID`

Current handoff note:

- `/api/stripe/*` is placeholder-only in the handoff build
- these vars are not required to boot the current handoff web-core slice

### Native billing specific

- `REVENUECAT_WEBHOOK_SECRET`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ALLOWED_ENTITLEMENTS`
- `REVENUECAT_APPLE_MONTHLY_PRODUCT_ID`
- `REVENUECAT_APPLE_ANNUAL_PRODUCT_ID`

Current note:

- these are only needed if RevenueCat-backed subscription flows are being actively verified

## Client environment variables

Used by `client/.env.example` and `client/` code:

- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_SENTRY_DSN`
- `VITE_POSTHOG_API_KEY`
- `VITE_MARKETPLACE_PLATFORM_FEE_RATE`

Notes:

- `VITE_API_URL` is the active web API boundary for split local dev
- in unified deployment, same-origin `/api` is the target assumption

## Mobile environment variables

Used by `mobile/.env.example` and `mobile/app.config.js`:

- `APP_ENV`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `IOS_BUNDLE_ID_DEV`
- `IOS_BUNDLE_ID_PREVIEW`
- `IOS_BUNDLE_ID_PRODUCTION`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT`

Additional mobile runtime env used in code:

- `EXPO_PUBLIC_WEB_URL`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_APP_ENV`

## Environment modes

### Local web-core

Expected shape:

- backend on `http://localhost:3001`
- `CLIENT_URL` pointed to either:
  - `http://localhost:3001` for unified build-serving mode
  - or `http://localhost:5173` for split Vite dev mode

### Local mobile against local backend

Expected shape:

- `EXPO_PUBLIC_API_URL=http://localhost:3001/api`
- mobile dev build or simulator points at a locally running backend

### Preview iOS

Expected shape:

- `APP_ENV=preview`
- preview bundle ID
- Apple Sign In enabled
- associated domains enabled
- backend URL must be explicit and stable

### Production iOS

Expected shape:

- `APP_ENV=production`
- production bundle ID
- Apple Sign In enabled
- associated domains enabled
- backend URL must be explicit and stable

## Current known backend URL assumptions

Current source-of-truth defaults:

- local backend default: `http://localhost:3001`
- local mobile API default: `http://localhost:3001/api`

Open decision:

- preview and production backend URLs need one explicit documented source of truth once the external deployment target is finalized

## Deferred or not required for web-core collaboration

These can stay unset for purely web-core Polsia collaboration if the corresponding systems are not under active test:

- Stripe seller and subscription vars
- RevenueCat vars
- Apple auth vars
- push / notification vars
- storage provider vars

## Current risk note

The copied sandbox currently contains checked-in `server/.env` and `mobile/.env` files with populated values. See `docs/handoff/secrets-access-scrub.md` before granting broader access.
