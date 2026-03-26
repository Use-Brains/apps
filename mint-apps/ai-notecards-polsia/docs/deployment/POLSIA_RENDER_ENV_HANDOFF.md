# Polsia Render Env Handoff

This file translates the broader environment manifest into the narrower set needed for the first Polsia import, boot, and verification pass.

## Required now

These are the minimum variables needed for the imported app to boot meaningfully on Render for the current handoff slice.

- `DATABASE_URL`
  - Primary PostgreSQL connection string used by the running backend.

- `DATABASE_URL_DIRECT`
  - Direct PostgreSQL connection string used by migrations.

- `JWT_SECRET`
  - Required for auth and session token signing.

- `CLIENT_URL`
  - Public app URL used for redirects and link construction.

- `PORT`
  - Render runtime port for the backend.

- `NODE_ENV`
  - Use `production` on Render.

- `SERVE_CLIENT_BUILD`
  - Set to `true` for the unified Express-serves-client deployment shape.

- `AI_PROVIDER`
  - Set to either `groq` or `gemini`.

- One AI provider key:
  - `GROQ_API_KEY`
  - or `GEMINI_API_KEY`

## Recommended defaults for first import

- `SERVE_CLIENT_BUILD=true`
- `FEATURE_SELLER_TOOLS=false`
- `FEATURE_NATIVE_AUTH_SESSIONS=true`
- `FEATURE_NATIVE_BILLING=true`
- `FEATURE_PUSH_NOTIFICATIONS=true`
- `IOS_MARKETPLACE_WEB_PURCHASES_ENABLED=true`

## Optional now

These are active in code, but the app can boot without them for the first orientation pass.

- `DATABASE_POOL_MAX`
- `DATABASE_IDLE_TIMEOUT_MS`
- `DATABASE_CONNECTION_TIMEOUT_MS`
- `DATABASE_SSL_MODE`
- `CLIENT_DIST_PATH`
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

## Founder-controlled secrets

These should stay founder-controlled and be supplied only when you want the related integrations activated.

- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `RESEND_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `REVENUECAT_WEBHOOK_SECRET`
- `REVENUECAT_SECRET_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `SENTRY_DSN`
- any Apple / Google OAuth client secrets or production identifiers

## Deferred for first boot

These are not required to boot the current handoff slice and should only be configured when the corresponding systems are being actively reintroduced or verified.

### Billing and seller

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_PRO_ANNUAL_PRICE_ID`

Reason:
- `/api/stripe/*` is placeholder-only in the handoff build.
- seller tooling is deferred by default.

### Native billing

- `REVENUECAT_WEBHOOK_SECRET`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_ALLOWED_ENTITLEMENTS`
- `REVENUECAT_APPLE_MONTHLY_PRODUCT_ID`
- `REVENUECAT_APPLE_ANNUAL_PRODUCT_ID`

Reason:
- RevenueCat-backed flows are real code paths, but not required for the first web-core boot/orientation pass.

### Mobile-only/public app config

- `APP_ENV`
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
- `IOS_BUNDLE_ID_DEV`
- `IOS_BUNDLE_ID_PREVIEW`
- `IOS_BUNDLE_ID_PRODUCTION`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT`
- `EXPO_PUBLIC_WEB_URL`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_APP_ENV`

Reason:
- `mobile/` is included for reference context, not because the first Polsia task will execute Expo workflows.

## First-task expectation

The first Polsia engineering task should use this env split to:

- boot the backend
- run the current migration flow
- verify the client build
- identify any truly missing required env vars
- avoid prematurely activating deferred billing, seller, or mobile-specific integrations
