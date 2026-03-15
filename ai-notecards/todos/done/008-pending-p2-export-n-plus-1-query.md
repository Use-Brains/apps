---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, performance]
dependencies: []
---

# Export Endpoint: N+1 Query Pattern

## Problem Statement

The export handler fetches all deck IDs, then loops through each deck issuing a separate `SELECT` for cards. For a user with 50 decks, this is 51 queries. With the 12-connection pool, concurrent exports could exhaust connections.

## Findings

- **Performance Oracle** (#1): CRITICAL — classic N+1, highest-impact fix
- **Security Sentinel** (H3): No timeout or row-count cap

## Proposed Solutions

### Option A: Single joined query (Recommended)

```sql
SELECT c.deck_id, d.title, c.front, c.back
FROM cards c
JOIN decks d ON d.id = c.deck_id
WHERE d.user_id = $1
ORDER BY c.deck_id, c.position
```

Group in memory by `deck_id`. Reduces N+1 to 2 queries (or 1 with this approach).

- **Pros**: Dramatic performance improvement, simple
- **Cons**: Loads all card text into memory (but this is kilobytes, not a concern)
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Export uses at most 2 database queries regardless of deck count
- [ ] Export has a reasonable deck cap (e.g., 500)
- [ ] Export response closes cleanly on error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Simplicity reviewer also notes streaming is over-engineered for expected data volumes |
