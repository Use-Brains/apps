---
status: pending
priority: p1
issue_id: "043"
tags: [code-review, architecture, onboarding, routing]
dependencies: []
---

# Onboarding Redirect Loop — /welcome Inside ProtectedRoute

## Problem Statement

The plan places the onboarding redirect in `ProtectedRoute`:
```js
if (!user.preferences?.onboarding_completed && user.deck_count === 0) {
  return <Navigate to="/welcome" />;
}
```

But `/welcome` is itself wrapped in `<ProtectedRoute>` (`App.jsx:65`). New users will be redirected to `/welcome`, which passes through `ProtectedRoute`, which redirects to `/welcome` again — an infinite redirect loop.

## Findings

- **Architecture Strategist:** HIGH — infinite redirect loop for all new users
- Verified: `App.jsx:65` wraps `/welcome` in `ProtectedRoute`

## Proposed Solutions

### Option A: `skipOnboardingCheck` prop on ProtectedRoute (Recommended)
```jsx
function ProtectedRoute({ children, skipOnboardingCheck = false }) {
  if (!skipOnboardingCheck && !user.preferences?.onboarding_completed && user.deck_count === 0) {
    return <Navigate to="/welcome" />;
  }
  return children;
}

// In routes:
<Route path="/welcome" element={<ProtectedRoute skipOnboardingCheck><Welcome /></ProtectedRoute>} />
```
**Pros:** Clean, explicit, no string comparison
**Cons:** Adds a prop to ProtectedRoute
**Effort:** Small
**Risk:** Low

### Option B: Check pathname in redirect condition
```js
if (window.location.pathname !== '/welcome' && !user.preferences?.onboarding_completed && user.deck_count === 0) {
  return <Navigate to="/welcome" />;
}
```
**Pros:** No prop changes
**Cons:** String comparison, fragile if route changes
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] New users are redirected to `/welcome` exactly once (no loop)
- [ ] The `/welcome` page renders for new users
- [ ] Existing users with decks are never redirected to `/welcome`
