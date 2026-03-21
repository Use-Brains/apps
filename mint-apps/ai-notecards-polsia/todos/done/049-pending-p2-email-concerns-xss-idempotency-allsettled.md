---
status: pending
priority: p2
issue_id: "049"
tags: [code-review, security, marketplace-operations, email]
dependencies: []
---

# Email Template Concerns — XSS Escape, Idempotency, Error Handling

## Problem Statement

Three related issues with the planned transactional email implementation:

1. **XSS in templates**: Plan acknowledges escaping is needed but code snippets use raw template interpolation. A listing titled `<img src="https://evil.com/track">` could inject tracking pixels into buyer emails.

2. **`fulfillPurchase` returns void**: The email trigger gates on `purchaseRows.length > 0`, but `fulfillPurchase` returns `undefined`. The plan needs to restructure it to return `{ isNew: boolean }` or similar.

3. **`Promise.all` swallows second failure**: If seller email fails but buyer succeeds, `Promise.all` rejects with the first error and discards the buyer result. `Promise.allSettled` logs both.

## Findings

- **Security Sentinel (P2-2)**: Email template XSS — CSS injection, image tracking, form injection possible via user-controlled content in HTML emails.
- **Data Integrity Guardian (P2-6)**: `fulfillPurchase` returns void, email can't check idempotency.
- **Performance Oracle (P2-02)**: Orphaned promise on process shutdown — documented, acceptable for v1.
- **Frontend Races (P3-2)**: `Promise.allSettled` preferred over `Promise.all` for independent email sends.

## Proposed Solutions

### XSS: Use `he.encode()` on all user-derived values

```javascript
import he from 'he';
const safeTitle = he.encode(data.title);
```

### Idempotency: Return purchase data from `fulfillPurchase`

```javascript
// Returns { isNew: true, purchaseId: '...' } or { isNew: false }
```

### Error handling: Use `Promise.allSettled`

```javascript
Promise.allSettled([...]).then(results => {
  results.filter(r => r.status === 'rejected').forEach(r =>
    console.error('Email send failed:', r.reason)
  );
});
```

- **Effort**: Small-Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] All user-controlled content escaped with `he.encode()` before HTML interpolation
- [ ] `fulfillPurchase` returns whether it was a new purchase
- [ ] Both email failures logged independently
- [ ] Listing title XSS does not execute in email clients

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Security + Data Integrity + Frontend Races agents |
