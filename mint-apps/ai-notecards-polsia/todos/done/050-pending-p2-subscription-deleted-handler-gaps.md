---
status: pending
priority: p2
issue_id: "050"
tags: [code-review, data-integrity, stripe, marketplace-operations]
dependencies: ["043"]
---

# Subscription Deleted Handler Gaps — Cancel Fields + Pending Listings

## Problem Statement

The `customer.subscription.deleted` webhook handler has two gaps that will cause stale state after the marketplace-operations changes:

1. **Doesn't clear cancel fields**: Handler sets `plan = 'free'` and clears `stripe_subscription_id`, but does not clear `cancel_at_period_end` and `cancel_at`. When a user re-subscribes later, they show stale "cancelling on [date]" UI until the next `subscription.updated` event.

2. **Leaves `pending_review` listings orphaned**: Handler only delists `status = 'active'` listings. A `pending_review` listing from a cancelled user could auto-approve and go active for a free user who can no longer sell.

## Findings

- **Data Integrity Guardian (P2-2)**: `cancel_at_period_end = false, cancel_at = NULL` missing from `subscription.deleted` UPDATE.
- **Data Integrity Guardian (P2-4)**: Pending listings survive subscription deletion; could auto-approve for downgraded user.

## Proposed Solutions

### Fix both in the same handler update

```sql
-- Clear cancel fields
UPDATE users SET plan = 'free', stripe_subscription_id = NULL,
  cancel_at_period_end = false, cancel_at = NULL
WHERE stripe_customer_id = $1;

-- Delist active AND pending listings
UPDATE marketplace_listings SET status = 'delisted'
WHERE seller_id = (...) AND status IN ('active', 'pending_review');
```

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] `subscription.deleted` clears `cancel_at_period_end` and `cancel_at`
- [ ] Both `active` and `pending_review` listings are delisted on subscription deletion
- [ ] Re-subscribing user does not see stale cancellation UI

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Data Integrity Guardian flagged both gaps |
