---
status: pending
priority: p1
issue_id: "005"
tags: [code-review, data-integrity, architecture]
dependencies: []
---

# JSONB `||` Shallow Merge Loses Nested Notification Keys

## Problem Statement

PostgreSQL's `||` operator performs a shallow top-level merge. The `notifications` key is a nested object. If a user sends `{"notifications": {"study_reminders": false}}`, the merge replaces the entire `notifications` object, losing `marketplace_activity`. This is a silent data loss bug.

## Findings

- **Security Sentinel** (M2): Confirmed shallow merge behavior with example
- **Data Integrity Guardian** (#7): Flagged as SIGNIFICANT — will cause incorrect behavior
- **Architecture Strategist**: Noted this needs attention

## Proposed Solutions

### Option A: Deep-merge in application code (Recommended)

Read current preferences, deep-merge validated input, write full object back.

```javascript
const { rows } = await pool.query('SELECT preferences FROM users WHERE id = $1', [req.userId]);
const current = rows[0].preferences;
const merged = { ...current, ...validated };
if (validated.notifications) {
  merged.notifications = { ...current.notifications, ...validated.notifications };
}
await pool.query('UPDATE users SET preferences = $1 WHERE id = $2', [JSON.stringify(merged), req.userId]);
```

- **Pros**: Correct deep-merge, full control over merge logic
- **Cons**: Extra SELECT query (negligible cost)
- **Effort**: Small
- **Risk**: Low

### Option B: Flatten preferences structure (Alternative)

Remove nesting: use `notification_study_reminders` and `notification_marketplace_activity` as top-level keys. Then `||` works correctly.

- **Pros**: Eliminates the problem entirely, simpler
- **Cons**: Slightly less organized key structure
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Updating one notification toggle does not erase the other
- [ ] Test: set both toggles → change one → verify other is preserved

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | 3 agents flagged this independently |
