# Mobile / Backend Contracts

This document defines the contracts Atlas should treat as important when working on the AI Notecards mobile app.

It is a working contract document, not a promise that every detail is already perfectly implemented. Atlas should verify code before claiming behavior, but should treat the categories below as high-sensitivity integration surfaces.

## 1. Authentication Contract

Mobile should assume:
- authenticated user state must be derived from stable backend responses, not optimistic local guesses
- auth behavior should remain consistent across app launches and connectivity changes
- login-related product flows are contract-sensitive and should not be changed casually

When changing auth-related behavior:
- verify the relevant route implementation under `server/src/routes/`
- verify any token, cookie, OAuth, or session assumptions actually used by mobile
- document any new mobile-specific expectations

Breaking contract examples:
- changing response shapes used by mobile auth bootstrap
- changing required headers or request assumptions without updating mobile
- changing account state handling in a way that can strand a previously valid mobile session

## 2. Offline Study Sync Contract

Offline study is a first-class product concern.

Mobile should assume:
- locally completed study work may need to queue and sync later
- sync behavior must be safe against duplicate submissions and network retries
- backend timestamp and session-merging behavior are contract-sensitive

When changing offline study behavior:
- preserve idempotent sync semantics whenever possible
- avoid trusting client-generated timestamps more than necessary
- document any required identifiers, reconciliation rules, or conflict behavior
- avoid changes that could double-count progress, corrupt streaks, or inflate study metrics

Breaking contract examples:
- making repeated sync submissions non-idempotent
- changing required session identifiers without coordinated mobile changes
- changing how study completion affects score, streaks, or recaps without documenting it

## 3. Deck And Card Data Contract

Mobile features that read or present deck content depend on stable deck/card shapes and access rules.

When changing deck or card behavior:
- preserve response consistency for deck reads that power mobile study flows
- treat deletion, editability, and purchased-deck copy behavior as contract-sensitive
- document any new required fields or removed fields

Breaking contract examples:
- changing deck detail shape without updating mobile consumers
- changing access rules for purchased or generated decks without documenting it
- changing study-critical card fields in a way that breaks local rendering or offline caching

## 4. Subscription And Entitlement Contract

Mobile should treat plan and entitlement behavior as backend-defined truth.

High-sensitivity areas:
- free vs trial vs pro behavior
- generation limits
- seller access requirements
- subscription state transitions that affect what the user can do in mobile

When changing entitlement behavior:
- document the rule change
- verify which backend routes enforce it
- verify whether mobile messaging or gating needs to change too

Breaking contract examples:
- changing the meaning of active trial or pro status without updating mobile UX
- changing entitlement response shape consumed by mobile
- silently moving enforcement from one layer to another without documenting it

## 5. Marketplace And Purchase Access Contract

Even when the mobile app is not the primary marketplace surface, it may still depend on whether users can access purchased decks, ratings eligibility, and related study behavior.

When changing purchase-related behavior:
- treat purchase fulfillment as highly sensitive
- preserve idempotency and user access consistency
- document any assumptions mobile should make about when purchased content becomes available

Breaking contract examples:
- delaying or altering purchased-deck availability without updating client expectations
- changing rating eligibility rules without documenting downstream effects
- changing listing or purchase response shapes used by mobile-adjacent flows

## 6. Environment And App Identity Contract

The mobile app has explicit `development`, `preview`, and `production` environments.

Atlas should treat these as product contracts, not just build details.

Key expectations:
- local development should not require production-only capabilities
- preview and production may enable associated domains and Apple Sign In where appropriate
- bundle identifiers, schemes, and capability-sensitive behavior must stay aligned with intended environment

When changing app identity behavior:
- update `mobile/app.config.js`
- verify any environment variables involved
- note reviewer- or release-sensitive implications

Breaking contract examples:
- enabling production-only capabilities in development by default
- changing scheme or bundle identity without considering auth/deep-link effects
- changing environment names or assumptions without updating scripts and docs

## 7. Change Management Rules

When Atlas changes a mobile/backend contract:
- update this document
- update any nearby technical docs that would otherwise become misleading
- call out migration needs explicitly
- note whether the change is additive, behavior-changing, or breaking

## 8. Practical Default

If there is tension between moving fast and preserving trust, prefer the change that protects:
- user data integrity
- study history correctness
- purchase correctness
- environment safety
- launch reliability
