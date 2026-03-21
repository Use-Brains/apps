---
status: pending
priority: p1
issue_id: "046"
tags: [code-review, security, marketplace-operations]
dependencies: []
---

# GET /marketplace/:id Exposes Non-Active Listings

## Problem Statement

The `GET /marketplace/:id` endpoint (`marketplace.js` line 117) has no `status = 'active'` filter. Any user (including unauthenticated) can view delisted, removed, or `pending_review` listings by knowing or guessing UUIDs. The browse endpoint correctly filters on `status = 'active'`, but the detail endpoint does not.

With content moderation (Phase 5), a rejected listing flagged for offensive content remains viewable via direct URL. Combined with the planned share buttons, a user could share a link to rejected content.

## Findings

- **Security Sentinel (P2-7)**: Confirmed — `WHERE ml.id = $1` with no status filter at line 117.
- **Architecture Strategist**: Confirmed the purchase flow checks `listing.status !== 'active'` separately, but this is defense-in-depth, not a substitute.

## Proposed Solutions

### Option A: Add status filter (Recommended)

```sql
WHERE ml.id = $1 AND ml.status = 'active'
```

Return 404 for non-active listings. Sellers view their own listings via `GET /seller/listings`.

- **Pros**: Simple, consistent with browse endpoint
- **Cons**: None
- **Effort**: Small (one line)
- **Risk**: None

## Acceptance Criteria

- [ ] Non-active listings return 404 on `GET /marketplace/:id`
- [ ] Sellers can still view their own listings via seller endpoints
- [ ] Share buttons don't link to inaccessible listings

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Security Sentinel flagged as moderation bypass vector |
