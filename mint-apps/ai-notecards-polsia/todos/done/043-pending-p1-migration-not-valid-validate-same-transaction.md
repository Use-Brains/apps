---
status: pending
priority: p1
issue_id: "043"
tags: [code-review, data-integrity, migration, marketplace-operations]
dependencies: []
---

# Migration 010 Will Fail — NOT VALID + VALIDATE in Same Transaction

## Problem Statement

Two critical migration issues:

**1. NOT VALID + VALIDATE in same transaction:** The migrator (`db/migrator.js` lines 33-39) wraps every migration in `BEGIN`/`COMMIT`. The `NOT VALID` + `VALIDATE CONSTRAINT` pattern requires two separate transactions to achieve its purpose (brief `ACCESS EXCLUSIVE` lock for add, then `SHARE UPDATE EXCLUSIVE` for validate). In one transaction, the lock is held for the full validation scan, defeating the purpose. On some PostgreSQL versions, `VALIDATE` in the same transaction as `ADD ... NOT VALID` may error.

**2. Missing cancel columns migration:** Phase 1 (Billing Portal) adds `cancel_at_period_end BOOLEAN` and `cancel_at TIMESTAMPTZ` to the `users` table, but no migration is defined for them. The plan mentions "Add via migration" but migration 010 only touches `marketplace_listings`. The webhook handler code (plan lines 144-162) will crash without these columns.

## Findings

- **Data Integrity Guardian (P1-1)**: Confirmed migrator wraps in single transaction. Migration 009 also has this pattern — either worked by coincidence (tiny table) or held lock for full duration.
- **Architecture Strategist**: Flagged as should-fix for consistency with migration 009 conventions.
- **Data Integrity Guardian (P1-4)**: cancel columns have no migration defined.

## Proposed Solutions

### Option A: Split into multiple migrations (Recommended)

1. Create `010_billing_portal.sql` for `cancel_at_period_end` + `cancel_at` on `users` table
2. Create `011_content_moderation.sql` with column additions + `ADD CONSTRAINT ... NOT VALID` only
3. Create `012_validate_moderation_constraints.sql` with the three `VALIDATE CONSTRAINT` statements

- **Pros**: Each migration is a single transaction; validates run in their own transaction with lighter locks
- **Cons**: More migration files
- **Effort**: Small
- **Risk**: None

### Option B: Add `-- no-transaction` directive to migrator

Modify `migrator.js` to detect a comment directive and skip the `BEGIN`/`COMMIT` wrapper.

- **Pros**: Keeps one file
- **Cons**: Migrator change is more complex; individual statements are not atomic
- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] `cancel_at_period_end` and `cancel_at` columns added to `users` table via migration
- [ ] Cancel columns migration ships before/with Phase 1 (Billing Portal)
- [ ] `NOT VALID` and `VALIDATE CONSTRAINT` run in separate transactions
- [ ] Content moderation migration renumbered appropriately

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Data Integrity + Architecture agents both flagged |
