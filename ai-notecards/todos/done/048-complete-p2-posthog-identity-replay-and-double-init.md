---
status: pending
priority: p2
issue_id: "048"
tags: [code-review, analytics, race-condition, gdpr]
dependencies: ["045"]
---

# PostHog Identity Not Replayed After Late Consent + Double-Init Race

## Problem Statement

Two related issues with PostHog initialization:

1. **Identity replay:** User logs in → AuthContext calls `analytics.identify()` → consent not yet granted → identify is a no-op. User clicks Accept on consent banner → PostHog initializes → `opt_in_capturing()` called → but `identify()` is never replayed. PostHog tracks an anonymous consented user.

2. **Double-init race:** If `initPostHog()` is called twice before the dynamic `import()` resolves (StrictMode, double-click on Accept), both calls pass the `if (posthogInstance)` check and PostHog gets initialized twice.

## Findings

- **Frontend Races Reviewer:** MEDIUM-HIGH (GDPR implications for #1, duplicate events for #2)
- **TypeScript/JS Reviewer:** Related — the dual-module ownership makes this worse

## Proposed Solutions

### Fix 1: Replay identify after opt_in_capturing
Consent banner needs access to the current user (via `useAuth` hook or prop):
```js
initPostHog().then((ph) => {
  ph.opt_in_capturing();
  if (user) ph.identify(user.id, { plan: user.plan, ... });
});
```

### Fix 2: Cache the promise, not the result
```js
let initPromise = null;
export function initPostHog() {
  if (initPromise) return initPromise;
  initPromise = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(/* config */);
    return posthog;
  });
  return initPromise;
}
```
This matches the `refreshUser` deduplication pattern in AuthContext.jsx.

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] After consent is granted, PostHog has the correct user identity (not anonymous)
- [ ] `initPostHog()` called twice returns the same promise (no double-init)
- [ ] Consent banner has access to current user for identity replay
