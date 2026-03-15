---
status: pending
priority: p2
issue_id: "049"
tags: [code-review, performance, api, onboarding]
dependencies: []
---

# deck_count: Use Subquery, Specify Response Shape, Define Scope

## Problem Statement

Three issues with the `deck_count` addition to `/auth/me`:

1. **Performance:** Separate `COUNT(*)` query doubles DB round-trips on every page load (including tab-switch refreshes via AuthContext visibility handler).

2. **Response shape:** `sanitizeUser` constructs a fixed field set. `deck_count` comes from a separate query and won't be included unless explicitly added as a sibling field (like `daily_generation_limit`).

3. **Scope:** The query counts ALL decks (`WHERE user_id = $1`) including purchased ones. A user who only purchased decks but never generated one would have `deck_count > 0` and skip onboarding. Is this intentional?

## Findings

- **Performance Oracle:** Use correlated subquery to eliminate extra round-trip
- **TypeScript/JS Reviewer:** sanitizeUser doesn't include deck_count; response shape unspecified
- **Pattern Recognition:** Should be a sibling field like daily_generation_limit at auth.js:175

## Proposed Solutions

### Option A: Correlated subquery + sibling field (Recommended)
```sql
SELECT ...,
  (SELECT COUNT(*)::int FROM decks WHERE user_id = users.id) AS deck_count
FROM users WHERE id = $1 AND deleted_at IS NULL
```
Return as sibling: `{ user: sanitizeUser(user), daily_generation_limit, deck_count: row.deck_count }`

**Pros:** Single query, no extra round-trip, clear response shape
**Cons:** Subquery on every /me call (fast with idx_decks_user_id)
**Effort:** Small
**Risk:** Low

### Option B: Conditional subquery (only when onboarding not completed)
Only include `deck_count` when `preferences->>'onboarding_completed' IS NULL`. Eliminates subquery for 99% of requests.
**Pros:** Zero overhead for most users
**Cons:** Slightly more complex SQL
**Effort:** Small
**Risk:** Low

### Scope decision (product call):
- Count ALL decks → purchased-only users skip onboarding (current plan)
- Count only generated/duplicated → purchased-only users get onboarding

## Acceptance Criteria

- [ ] `deck_count` is returned in `/auth/me` response as a sibling field
- [ ] No additional DB round-trip (subquery or conditional approach)
- [ ] AuthContext exposes `deck_count` for ProtectedRoute onboarding check
