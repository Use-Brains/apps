---
status: pending
priority: p3
issue_id: "053"
tags: [code-review, pattern, duplication, marketplace-operations]
dependencies: []
---

# Extract `getStripe()` to Shared Service as Singleton

## Problem Statement

`getStripe()` is duplicated identically in `stripe.js` (line 9-11) and `seller.js` (line 7-9), creating a `new Stripe()` on every invocation. This is inconsistent with the `getResend()`/`getGeminiClient()` singleton patterns used by other services.

## Findings

- **Pattern Recognition (P2)**: Duplication confirmed; plan adds a third usage without addressing it.
- **Performance Oracle (P3-03)**: Constructor overhead per call is minimal but the pattern is wasteful.

## Proposed Solutions

Create `server/src/services/stripe.js`:

```javascript
import Stripe from 'stripe';
let stripe;
export function getStripe() {
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}
```

Import from both `routes/stripe.js` and `routes/seller.js`.

- **Effort**: Small (10 minutes)
- **Risk**: None

## Acceptance Criteria

- [ ] Single `getStripe()` in `services/stripe.js`
- [ ] Both route files import from shared location
- [ ] Singleton pattern matches `getGeminiClient()`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Pattern Recognition + Performance agents |
