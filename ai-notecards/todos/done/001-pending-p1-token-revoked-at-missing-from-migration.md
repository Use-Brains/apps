---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, data-integrity, security, migration]
dependencies: []
---

# `token_revoked_at` Column Missing From Migration 008

## Problem Statement

The plan references `token_revoked_at` extensively (password change sets it, account deletion sets it, authenticate middleware checks it), but the column does not exist in any migration. The proposed migration 008 SQL omits it entirely. The password change handler and account deletion handler will fail at runtime with: `column "token_revoked_at" of relation "users" does not exist`.

The column appears in `docs/solutions/auth-implementation-guide.md` as a design artifact but was never actually migrated.

## Findings

- **Data Integrity Guardian**: Confirmed `token_revoked_at` is not in migrations 001-007
- **Security Sentinel**: Noted this as Critical (C1) — middleware update depends on it
- **Pattern Recognition**: Did not flag (focused on code patterns)

## Proposed Solutions

### Option A: Add to migration 008 (Recommended)

Add `ALTER TABLE users ADD COLUMN token_revoked_at TIMESTAMPTZ;` to the migration 008 SQL.

- **Pros**: Simple, single migration, ships with the feature
- **Cons**: None
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Migration 008 includes `ALTER TABLE users ADD COLUMN token_revoked_at TIMESTAMPTZ`
- [ ] Password change handler can successfully `SET token_revoked_at = NOW()`
- [ ] Authenticate middleware can read `token_revoked_at` without error

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Column was designed but never migrated |
