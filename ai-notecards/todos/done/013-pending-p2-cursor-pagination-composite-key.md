---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, data-integrity, performance]
dependencies: []
---

# Study History Cursor Needs Composite Key (completed_at, id)

## Problem Statement

The study history query uses `completed_at < $2` as the cursor. If two sessions share the same timestamp, the cursor skips records. The marketplace already uses composite cursors for tie-breaking.

## Findings

- **Performance Oracle** (#7): MODERATE — timestamp-only cursor is not unique
- **Data Integrity Guardian** (#8): SIGNIFICANT — can skip rows
- **Architecture Strategist** (#3.3): Should match marketplace pattern

## Proposed Solutions

### Option A: Composite cursor (completed_at, id) (Recommended)

```sql
WHERE (ss.completed_at, ss.id) < ($2::timestamptz, $3::uuid)
ORDER BY ss.completed_at DESC, ss.id DESC
```

Update index: `CREATE INDEX ... ON study_sessions (user_id, completed_at DESC, id DESC)`

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Cursor pagination never skips records with identical timestamps
- [ ] Index matches the ORDER BY clause

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Follow marketplace composite cursor pattern |
