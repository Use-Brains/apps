---
status: pending
priority: p1
issue_id: "047"
tags: [code-review, data-integrity, duplication]
dependencies: []
---

# Empty Deck Duplication Causes SQL Syntax Error

## Problem Statement

The duplicate endpoint bulk-INSERTs cards using the pattern from `decks.js:134-145`. If the source deck has zero cards (user deleted all cards then duplicated), the VALUES clause is empty, producing invalid SQL: `INSERT INTO cards (...) VALUES  RETURNING *` — a runtime syntax error that crashes the request and rolls back the transaction.

## Findings

- **Data Integrity Guardian:** MEDIUM — edge case but produces a 500 error

## Proposed Solutions

### Option A: Guard with sourceCards.length check (Recommended)
```js
// After reading source cards:
if (sourceCards.length > 0) {
  // bulk INSERT cards
}
// Deck is created either way (empty deck is valid)
```
**Pros:** Simple, matches purchase.js pattern
**Cons:** None
**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] Duplicating a deck with zero cards succeeds (creates empty deck)
- [ ] Duplicating a deck with cards copies all cards
- [ ] No SQL syntax error for empty decks
