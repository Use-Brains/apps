---
status: pending
priority: p2
issue_id: "052"
tags: [code-review, gdpr, analytics, consent]
dependencies: ["045", "046"]
---

# Consent State: Server→localStorage Sync on Login + Define Defaults

## Problem Statement

Three consent-related issues:

1. **Cross-device divergence:** User consents on device A (localStorage = granted, server = opt_out: false). Opens device B — localStorage is null, consent banner reappears despite having already consented.

2. **Undefined default:** If `analytics_opt_out` is absent from preferences JSONB, what's the default? The plan does not specify. Should be opt-out by default (GDPR safe).

3. **Settings toggle writes localStorage before API confirms:** If the API call fails, localStorage says "declined" but server still thinks user consented.

## Findings

- **Architecture Strategist:** MEDIUM — consent banner reappears on second device
- **Security Sentinel:** MEDIUM — consent sync race condition
- **Frontend Races Reviewer:** LOW-MEDIUM — localStorage before API confirmation

## Proposed Solutions

### Sync server preference to localStorage on login
In AuthContext, after `/me` returns:
```js
if (data.user?.preferences?.analytics_opt_out === false) {
  localStorage.setItem('analytics_consent', 'granted');
} else if (data.user?.preferences?.analytics_opt_out === true) {
  localStorage.setItem('analytics_consent', 'declined');
}
// If absent: leave localStorage as-is (show banner for new users)
```

### Default: absent = not consented
If `analytics_opt_out` is not in preferences, treat as not consented (don't track).

### Settings toggle: update localStorage AFTER API success
```js
const handleOptOut = async () => {
  await api.updatePreferences({ analytics_opt_out: true });
  localStorage.setItem('analytics_consent', 'declined');
  analytics.optOut();
};
```

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] User who consented on device A does not see banner again on device B
- [ ] Missing `analytics_opt_out` preference defaults to "not consented"
- [ ] Settings toggle only updates localStorage after successful API call
