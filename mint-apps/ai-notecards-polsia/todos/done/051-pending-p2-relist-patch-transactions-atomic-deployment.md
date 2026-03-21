---
status: pending
priority: p2
issue_id: "051"
tags: [code-review, data-integrity, marketplace-operations, migration]
dependencies: ["043"]
---

# Relist + PATCH Routes Need Transactions and Atomic Deployment

## Problem Statement

Three related issues with listing modification routes when moderation is added:

1. **Relist bypasses moderation**: The current `POST /listings/:id/relist` route sets `status = 'active'` directly. After the coherence constraint, relisting a previously-rejected listing will fail with a CHECK violation (constraint requires `active + approved` but `moderation_status` is `rejected`). The route code must change atomically with the migration.

2. **PATCH lacks transaction**: `PATCH /listings/:id` runs description update and tag replacement as separate pool queries (not in a transaction). The plan adds `moderation_status = 'pending'` to this flow. If the status change succeeds but tag insert fails, the listing is stuck in `pending_review` with old tags.

3. **Deployment order**: Both route changes must deploy atomically with migration 010/011. If the migration applies and old code remains active, relisting or editing a rejected listing crashes.

## Findings

- **Data Integrity Guardian (P2-3)**: Relist UPDATE will violate coherence constraint for rejected listings.
- **Data Integrity Guardian (P2-7)**: PATCH route lacks transaction for moderation + tag updates.
- **Architecture Strategist**: Relist implementation guidance missing — only acceptance criterion exists.

## Proposed Solutions

### Relist: Branch on `moderation_status`

```javascript
if (listing.moderation_status === 'rejected') {
  // Re-screen required
  await pool.query(`UPDATE ... SET status = 'pending_review', moderation_status = 'pending', ...`);
  moderateListingAsync(listing.id).catch(...);
} else {
  // Normal relist
  await pool.query(`UPDATE ... SET status = 'active' WHERE ...`);
}
```

### PATCH: Wrap in transaction

Use `pool.connect()` + `client.query('BEGIN')` for description update + tag replacement + moderation re-trigger.

### Deployment: Code-first, migration-second

Deploy the code changes first (they are backward-compatible — branching on a column that defaults to `'approved'`). Then apply the migration.

- **Effort**: Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] Relist of rejected listing triggers re-moderation
- [ ] PATCH description change wraps in transaction with tag updates
- [ ] Code changes are backward-compatible with pre-migration schema
- [ ] No CHECK constraint violations during deployment

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Data Integrity Guardian + Architecture Strategist |
