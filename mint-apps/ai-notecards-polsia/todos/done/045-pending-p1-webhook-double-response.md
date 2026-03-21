---
status: pending
priority: p1
issue_id: "045"
tags: [code-review, bug, marketplace-operations, stripe]
dependencies: []
---

# Webhook Email Trigger Causes Double `res.json()` Response

## Problem Statement

The plan proposes sending `res.json({ received: true })` early inside the `payment_intent.succeeded` case block (before fire-and-forget emails), but the existing webhook handler already sends `res.json({ received: true })` at the end of the switch block (`stripe.js` line 193). This will send two responses, crashing with `ERR_HTTP_HEADERS_SENT`.

## Findings

- **Pattern Recognition (P1)**: Confirmed the existing final `res.json({ received: true })` at line 193 of `stripe.js` runs after the switch block. The plan's early return inside the case does not prevent execution from reaching line 193.

## Proposed Solutions

### Option A: Return after each case's response (Recommended)

Add `return` after `res.json()` in each case block, including the new email-sending case. Remove or guard the final `res.json()`.

```javascript
case 'payment_intent.succeeded': {
  // ... fulfillment + email logic ...
  res.json({ received: true });
  // fire-and-forget emails
  Promise.all([...]).catch(...);
  return; // <-- prevents hitting final res.json()
}
```

- **Pros**: Simple, clear control flow
- **Cons**: Need to audit all existing cases for missing `return`
- **Effort**: Small
- **Risk**: None

### Option B: Guard final response with `res.headersSent`

```javascript
if (!res.headersSent) res.json({ received: true });
```

- **Pros**: No-touch for existing cases
- **Cons**: Hides logic bugs; prefer explicit returns
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Webhook handler sends exactly one response per request
- [ ] Fire-and-forget email code runs after response is sent
- [ ] No `ERR_HTTP_HEADERS_SENT` errors in webhook processing

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Pattern Recognition agent caught this |
