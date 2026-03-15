---
status: pending
priority: p1
issue_id: "045"
tags: [code-review, performance, analytics, architecture]
dependencies: []
---

# PostHog Static Import Defeats Deferred Loading — Drop @posthog/react

## Problem Statement

The plan statically imports `PostHogProvider` from `@posthog/react` in `main.jsx`. The `@posthog/react` package re-exports from `posthog-js`, pulling the entire ~50KB PostHog bundle into the initial chunk regardless of the dynamic `import('posthog-js')` strategy. This defeats the deferred loading design.

Additionally, the plan creates two disconnected module-scoped PostHog variables (`posthogInstance` in `main.jsx` and `posthog` in `analytics.js`) with a fragile `setPostHogInstance()` handoff. The `PostHogProvider` is wrapped around the app but no component uses `usePostHog()` — all tracking goes through the custom `analytics.js` wrapper.

## Findings

- **TypeScript/JS Reviewer:** CRITICAL — dual-module ownership is fragile; static import defeats dynamic import
- **Performance Oracle:** HIGH — saves ~50KB from initial bundle
- **Simplicity Reviewer:** `@posthog/react` adds no value when custom wrapper handles everything

## Proposed Solutions

### Option A: Drop @posthog/react entirely — analytics.js owns PostHog (Recommended)
1. Do not install `@posthog/react`
2. Move `initPostHog()` into `analytics.js` (single owner)
3. Remove `PostHogProvider` from `main.jsx`
4. All PostHog access goes through the `analytics` wrapper
5. Cache the init **promise** (not result) to prevent double-init race:
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

**Pros:** Single owner, no handoff race, truly deferred ~50KB bundle, simpler
**Cons:** Cannot use `usePostHog()` hook (not needed — wrapper covers all use cases)
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] `@posthog/react` is not in `client/package.json`
- [ ] PostHog bundle is not in the initial chunk (verify with `vite-bundle-visualizer`)
- [ ] `analytics.js` is the single owner of the PostHog instance
- [ ] `initPostHog()` caches the promise to prevent double-init
- [ ] No `PostHogProvider` in `main.jsx`
