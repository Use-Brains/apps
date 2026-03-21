---
status: pending
priority: p2
issue_id: "026"
tags: [code-review, plan-review, frontend, stale-state, phase-6]
dependencies: []
---

# Phase 6: Client Must Call refreshUser() After Password Set to Sync has_password State

## Problem Statement

After a successful password set (first-time for OAuth users), the in-memory user object in `AuthContext` still has `has_password: false`. The Settings page continues showing the "Set Password" form instead of the "Change Password" form. If the user submits the "Set Password" form again, the server returns "Current password is required" because a password now exists — a confusing error message that doesn't match the UI the user sees.

## Findings

- **Frontend Races Reviewer** (HIGH): Identified stale client-side state after password mutation as a high-severity UX bug
- **Spec Flow Analyzer** (Gap 2, Q10): Flagged the missing state refresh and raised it as a critical flow question

## Proposed Solutions

### Option A: Call refreshUser() after successful password set/change (Recommended)

In the Settings page password handler, after the API call succeeds, call `refreshUser()` (which hits `GET /api/auth/me` and updates AuthContext):

```jsx
const res = await api.patch('/api/account/password', { newPassword, currentPassword });
if (res.ok) {
  await refreshUser(); // sync has_password, token_revoked_at, etc.
  toast.success('Password updated');
}
```

- **Effort**: Small — one line after the success check
- **Risk**: None — `refreshUser` is an existing AuthContext method

### Option B: Optimistically update user state

Set `has_password: true` in local state without a server round-trip.

- **Effort**: Small
- **Risk**: Low — state could drift if the server update failed silently

## Acceptance Criteria

- [ ] After successful password set, `user.has_password` is `true` in AuthContext
- [ ] Settings page shows "Change Password" form (not "Set Password") after setting a password
- [ ] No confusing "Current password is required" error when the form reflects current state
- [ ] Works for both first-time password set (OAuth users) and password change flows

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Mutations that change user properties must refresh client-side auth state |
