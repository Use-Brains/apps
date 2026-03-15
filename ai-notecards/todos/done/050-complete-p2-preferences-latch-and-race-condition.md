---
status: pending
priority: p2
issue_id: "050"
tags: [code-review, data-integrity, preferences, race-condition]
dependencies: []
---

# Preferences: One-Way Latch Rejects Payload + Read-Modify-Write Race

## Problem Statement

Two issues with the preferences endpoint:

1. **Latch rejection:** The plan's one-way latch returns `null` when `onboarding_completed: false` is sent, which rejects the ENTIRE preferences payload. If a user sends `{ analytics_opt_out: true, onboarding_completed: false }`, their opt-out preference change is lost.

2. **Race condition (pre-existing, worsened):** The preferences endpoint does a read-modify-write without `FOR UPDATE`. Two concurrent requests (e.g., consent banner + onboarding completion) can clobber each other. Adding two new preference keys makes this more likely.

## Findings

- **TypeScript/JS Reviewer:** HIGH — latch rejects entire payload
- **Architecture Strategist:** Confirmed — silently ignore instead of reject
- **Data Integrity Guardian:** HIGH — preferences race condition worsened by new keys

## Proposed Solutions

### Fix 1: Silently ignore invalid latch values
```js
if ('onboarding_completed' in input) {
  if (input.onboarding_completed === true) {
    clean.onboarding_completed = true;
  }
  // silently ignore false/other values
}
```

### Fix 2: Wrap read-modify-write in transaction with FOR UPDATE
```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    'SELECT preferences FROM users WHERE id = $1 FOR UPDATE', [req.userId]
  );
  const merged = deepMerge(rows[0].preferences || {}, validated);
  await client.query('UPDATE users SET preferences = $1 WHERE id = $2',
    [JSON.stringify(merged), req.userId]);
  await client.query('COMMIT');
  res.json({ preferences: merged });
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

**Effort:** Small-Medium
**Risk:** Low

## Acceptance Criteria

- [ ] Sending `onboarding_completed: false` does NOT reject the entire request
- [ ] Concurrent preference updates do not clobber each other
- [ ] `onboarding_completed` can only transition from unset/false to true (one-way)
