# Mobile API Runtime Contract

This document records the actual mobile-to-backend contract currently used by the Expo iOS app.

Primary source files:

- `mobile/src/lib/api.ts`
- `server/app.js`
- `server/routes/*`

This is a runtime contract doc, not a product wish list.

## Base URL and client identity

Base URL resolution in mobile:

- `Constants.expoConfig.extra.apiUrl`
- fallback `EXPO_PUBLIC_API_URL`
- fallback `http://localhost:3001/api`

Native-client identification:

- header: `X-Client-Platform`
- value: `ios-native`

The mobile client sends that header on every request. Backend logic uses it to distinguish native auth/session behavior and iOS marketplace purchase gating.

## Auth and session model

### Web vs native split

Web uses cookie sessions.

Native uses:

- bearer access token
- refresh token stored in `expo-secure-store`
- `POST /auth/refresh` with `deviceInfo`

### Native auth request behavior

Authenticated requests send:

- `Authorization: Bearer <accessToken>` when present
- `X-Client-Platform: ios-native`

On `401`:

- most routes retry once through `POST /auth/refresh`
- auth bootstrap routes do not auto-refresh:
  - `/auth/login`
  - `/auth/signup`
  - `/auth/google`
  - `/auth/apple`
  - `/auth/magic-link/request`
  - `/auth/magic-link/verify`
  - `/auth/refresh`
  - `/auth/logout`

### Native auth response shapes

The mobile client currently normalizes these backend fields:

- `user`
- `access_token`
- `refresh_token`
- `expires_in`
- `refresh_expires_at`

Mobile then maps them to camelCase in app state.

High-risk fields to change:

- `access_token`
- `refresh_token`
- `user.id`
- `user.plan`
- `user.subscription_platform`
- `user.avatar_url`
- `user.current_streak`
- `user.longest_streak`
- `user.preferences`
- `user.feature_availability`

## Active endpoint inventory used by mobile

### Auth

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/google`
- `POST /auth/apple`
- `POST /auth/magic-link/request`
- `POST /auth/magic-link/verify`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/refresh`

Notes:

- signup, login, Google auth, Apple auth, and magic-link verify all send `deviceInfo`
- `GET /auth/me` is used for bootstrap and should remain safe when no web cookie is present

### Billing and entitlement

- `POST /revenuecat/reconcile`
- `POST /stripe/checkout`
- `POST /stripe/portal`

Current reality:

- RevenueCat reconcile is active when native billing is enabled
- `/stripe/*` in the handoff build is placeholder-only through `server/routes/handoff-billing.js`

### Generation

- `POST /generate`
- `POST /generate/preview`

Notes:

- preview supports both JSON and multipart form-data
- photo generation uses multipart field `photos`

### Decks and cards

- `POST /decks/save`
- `GET /decks`
- `GET /decks/:id`
- `PATCH /decks/:id`
- `DELETE /decks/:id`
- `POST /decks/:id/archive`
- `POST /decks/:id/unarchive`
- `POST /decks/:id/duplicate`
- `POST /decks/:deckId/cards`
- `PATCH /decks/:deckId/cards/:cardId`
- `DELETE /decks/:deckId/cards/:cardId`

High-risk response areas:

- `deck.id`
- `deck.user_id`
- `deck.origin`
- `deck.archived_at`
- `card.id`
- `card.deck_id`
- `card.front`
- `card.back`
- `card.position`

### Study

- `POST /study`
- `PATCH /study/:sessionId`
- `POST /study/sync`
- `GET /study/stats`
- `GET /study/history`
- `GET /study/deck-stats`

Notes:

- offline-aware sync depends on `POST /study/sync`
- the mobile client expects dedupe-safe behavior and stable streak/stat handling

High-risk response areas:

- `acceptedSessionIds`
- `dedupedSessionIds`
- streak-related payload fields

### Settings and account

- `GET /settings`
- `PATCH /settings`
- `PATCH /settings/preferences`
- `PATCH /account/password`
- `DELETE /account`

### Notifications

- `POST /notifications/devices`
- `DELETE /notifications/devices/:token`

### Marketplace buyer flows

- `GET /marketplace`
- `GET /marketplace/categories`
- `GET /marketplace/:id`
- `POST /marketplace/:id/purchase`
- `POST /marketplace/:id/flag`
- `POST /ratings`
- `GET /ratings/listing/:listingId`

Current reality:

- browse and listing detail are active
- purchase checkout currently returns a placeholder payload
- if `X-Client-Platform=ios-native` and `IOS_MARKETPLACE_WEB_PURCHASES_ENABLED=false`, the backend can return `409` with:
  - code `IOS_MARKETPLACE_WEB_PURCHASES_DISABLED`
  - message `Marketplace purchases are temporarily disabled in the iOS app.`

The mobile app should treat marketplace purchase as a decision-sensitive surface, not settled launch truth.

### Seller flows

- `GET /seller/dashboard`
- `GET /seller/listings`
- `POST /seller/listings`
- `PATCH /seller/listings/:id`
- `DELETE /seller/listings/:id`
- `POST /seller/listings/:id/relist`
- `POST /seller/accept-terms`
- `POST /seller/onboard`
- `GET /seller/onboard/refresh`

Current reality:

- these routes remain present
- when `FEATURE_SELLER_TOOLS=false`, seller routes return shell/unavailable responses instead of full seller behavior

Treat seller routes as deferred-by-default.

## Required headers and request assumptions

Headers mobile always or commonly relies on:

- `X-Client-Platform: ios-native`
- `Content-Type: application/json` for JSON requests
- bearer `Authorization` for authenticated native requests

Do not remove or rename `X-Client-Platform` without coordinating mobile and backend changes.

## High-risk contract rules

Do not casually change:

- native auth response field names
- refresh token request shape
- `deviceInfo` expectations on auth routes
- deck/card field names used by mobile normalization
- study sync response keys
- `purchaseAvailability` structure returned by marketplace endpoints
- seller shell response behavior while seller tools are deferred

## Active vs optional vs deferred

Active now:

- native auth/session flows
- generation
- decks
- study
- settings/account
- marketplace browse/detail
- RevenueCat reconcile path when configured

Optional or flag-gated:

- seller routes
- push notification device registration
- native billing enablement
- iOS marketplace web purchase enablement

Deferred or placeholder in the handoff build:

- `/stripe/*` checkout and portal behavior
- production seller onboarding and payout workflows
- final iOS marketplace purchase implementation path

## Safe change rule

If a backend change touches any endpoint listed above, update this file and re-check the matching mobile caller in `mobile/src/lib/api.ts` before claiming compatibility.
