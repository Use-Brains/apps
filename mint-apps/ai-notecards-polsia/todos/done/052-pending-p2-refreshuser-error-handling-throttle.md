---
status: pending
priority: p2
issue_id: "052"
tags: [code-review, frontend, race-condition, marketplace-operations]
dependencies: []
---

# refreshUser Dedup — Error Handling at Callsites + visibilitychange Throttle

## Problem Statement

Two frontend issues related to the `refreshUser()` deduplication fix:

1. **Unhandled rejection**: The plan's dedup wraps in `useCallback` but callers like `Settings.jsx:243` (`refreshUser()` with no await/catch) will receive unhandled promise rejections on network failure.

2. **visibilitychange refetch has no throttle**: Rapid tab-switching (Alt-Tab cycling) fires a `/me` request on every focus event. The dedup ref only coalesces concurrent calls, not sequential rapid-fire calls after the previous one resolves.

Also: the portal return effect cleans the URL before `refreshUser()` resolves. If the network fails, the trigger is gone and the user has no signal. Clean the URL first (to prevent re-trigger), but show a toast on failure.

## Findings

- **Frontend Races (P1-1)**: Portal return URL cleaned before async completes; ordering matters.
- **Frontend Races (P1-3)**: Rejection propagates to callers that don't catch.
- **Frontend Races (P2-4)**: visibilitychange has no throttle; rapid focus floods `/me`.

## Proposed Solutions

### Error handling: Audit all callsites

Ensure every `refreshUser()` call either awaits with `.catch()` or the dedup wrapper swallows errors internally.

### Throttle: Add timestamp guard

```javascript
const lastRefreshRef = useRef(0);
const onVisible = () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastRefreshRef.current < 5000) return;
  lastRefreshRef.current = Date.now();
  refreshUser();
};
```

### Portal return: Clean URL first, handle error

```javascript
window.history.replaceState({}, '', '/settings'); // prevent re-trigger
refreshUser().catch(() => toast.error('Could not refresh. Please reload.'));
```

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] No unhandled promise rejections from `refreshUser()` callsites
- [ ] visibilitychange refetch throttled to once per 5 seconds
- [ ] Portal return shows error toast on failure, not silent swallow
- [ ] Existing SellerDashboard connect-return also gated on `loading === false`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Frontend Races agent identified 3 related issues |
