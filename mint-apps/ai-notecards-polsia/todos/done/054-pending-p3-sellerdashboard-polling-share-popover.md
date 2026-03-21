---
status: pending
priority: p3
issue_id: "054"
tags: [code-review, frontend, marketplace-operations]
dependencies: []
---

# SellerDashboard Polling Improvements + SharePopover Extraction

## Problem Statement

Two frontend pattern issues:

1. **Polling dependency**: The plan's `useEffect` dependency uses inline `listings.some(...)` instead of a `useMemo`-derived value. Also missing cancel check after await (state update on unmounted component).

2. **SharePopover duplication**: Planned for both `MarketplaceDeck.jsx` and `SellerDashboard.jsx` — should be extracted to `components/SharePopover.jsx` to avoid duplication. Follows the existing `Navbar` component extraction pattern.

## Findings

- **Pattern Recognition (P2)**: ESLint `exhaustive-deps` violation; `useMemo` recommended.
- **Frontend Races (P1-2)**: `setListings` called before cancel check after await.
- **Pattern Recognition (P2)**: SharePopover in two files creates maintenance burden.

## Proposed Solutions

### Polling: Use `useMemo` + cancel check

```javascript
const hasPending = useMemo(
  () => listings.some(l => l.status === 'pending_review' && l.moderation_status === 'pending'),
  [listings]
);

useEffect(() => {
  if (!hasPending) return;
  // ... poll with `if (canceled) return;` AFTER await ...
}, [hasPending]);
```

### SharePopover: Extract to component

Create `client/src/components/SharePopover.jsx` with props `{ url, title, cardCount, price }`.

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Polling uses `useMemo`-derived dependency
- [ ] Cancel check runs after every `await`
- [ ] SharePopover is a shared component used by both pages

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Pattern Recognition + Frontend Races agents |
