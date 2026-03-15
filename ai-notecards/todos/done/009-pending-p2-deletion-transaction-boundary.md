---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, data-integrity, architecture]
dependencies: []
---

# Account Deletion Lacks Transaction Boundary

## Problem Statement

The delete account handler performs Stripe cancellation (external API), database PII scrub, and storage deletion sequentially without a transaction. If the DB update fails after Stripe cancellation, the user's subscription is cancelled but their account is not deleted.

## Findings

- **Data Integrity Guardian** (#6): SIGNIFICANT — Stripe failure leaves inconsistent state
- **Architecture Strategist**: Noted Stripe calls should be best-effort

## Proposed Solutions

### Option A: Transaction for DB, best-effort for external calls (Recommended)

1. Cancel Stripe subscriptions (best-effort, log failures)
2. Wrap DB UPDATE in explicit transaction
3. Delete avatar from storage (best-effort)
4. Clear cookie and respond

- **Pros**: DB state is always consistent, Stripe failures don't block deletion
- **Cons**: Failed Stripe cancellation requires manual follow-up
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] DB PII scrub is wrapped in a transaction
- [ ] Stripe cancellation failure does not prevent account deletion
- [ ] Failed Stripe cancellations are logged for manual follow-up

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | External API calls should never block DB operations |
