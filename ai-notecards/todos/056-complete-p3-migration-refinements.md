---
status: pending
priority: p3
issue_id: "056"
tags: [code-review, migration, database, rollback]
dependencies: []
---

# Migration Refinements: LIKE Filter, Rollback Instructions, Post-Deploy Verification

## Problem Statement

The migration design is sound but has three areas for improvement.

## Findings

### 1. LIKE '%origin%' filter could match unintended future constraints
Migration 011 used a `NOT LIKE '%moderation_status%'` exclusion. The plan's `LIKE '%origin%'` has no exclusion. If a future constraint's definition contains "origin", it would be dropped.
**Fix:** Tighten to `AND pg_get_constraintdef(con.oid) LIKE '%origin%' AND pg_get_constraintdef(con.oid) LIKE '%generated%'`

### 2. Rollback instructions incomplete
- Missing `DELETE FROM schema_migrations WHERE version IN (13, 14)` — without this, re-running migrator skips the rolled-back migrations
- Rollback re-adds constraint as VALID (full table scan under load) — should use NOT VALID + VALIDATE
- No verification query or guidance for when 'duplicated' rows already exist

### 3. Post-deploy verification queries missing
Add verification SQL to confirm: constraint exists and is valid, new column exists, FK exists, partial index exists, no duplicate origin constraints, data integrity after first duplication.

## Proposed Solutions

Apply all three refinements to the plan before implementation.

**Effort:** Small
**Risk:** Low

## Acceptance Criteria

- [ ] LIKE filter is tightened with additional match criteria
- [ ] Rollback instructions include schema_migrations cleanup
- [ ] Rollback uses NOT VALID + VALIDATE pattern
- [ ] Post-deploy verification queries are documented
