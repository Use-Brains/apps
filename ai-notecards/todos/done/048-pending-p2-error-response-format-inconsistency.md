---
status: pending
priority: p2
issue_id: "048"
tags: [code-review, pattern, backward-compat, marketplace-operations]
dependencies: []
---

# Error Response Format Inconsistency — `error` Field Semantics

## Problem Statement

The `error` field is used inconsistently: most endpoints use it as a human-readable string, but 3 existing endpoints use it as a machine code with a separate `message` field. The client's `api.js:17` does `new Error(data.error || ...)`, so machine codes like `terms_required` display as raw toast messages.

The plan correctly adds `error_code` as a new field for rate limits but does not remediate the 3 existing inconsistencies.

## Findings

- **Pattern Recognition (P1)**: Identified 3 existing violations:
  - `seller.js:79` — `{ error: 'terms_required', message: '...' }`
  - `seller.js:225`, `seller.js:334` — similar pattern
  - `plan.js:48` — `{ error: 'upgrade_required', message: '...' }`
  - `auth.js:29` — `{ error: 'email_verification_required', message: '...' }`
- **Architecture Strategist**: Confirmed frontend `request()` uses `data.error` for display.

## Proposed Solutions

### Option A: Fix api.js to prefer `data.message` (Recommended)

One-line change in `client/src/lib/api.js:17`:

```javascript
// Before:
throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { data });
// After:
throw Object.assign(new Error(data.message || data.error || `HTTP ${response.status}`), { data });
```

- **Pros**: Fixes all existing and future cases; non-breaking
- **Cons**: None
- **Effort**: Small (one line)
- **Risk**: None

### Option B: Migrate existing responses to new format

Change the 3 locations to use `{ error: 'Human message', error_code: 'machine_code' }`.

- **Pros**: Consistent with plan's new pattern
- **Cons**: More changes; any frontend code checking `err.data.error === 'terms_required'` breaks
- **Effort**: Small-Medium
- **Risk**: Low

## Acceptance Criteria

- [ ] Toast messages show human-readable text, not machine codes
- [ ] `api.js` prefers `data.message` over `data.error` for Error construction
- [ ] New rate limit responses use `error_code` field consistently

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Pattern Recognition + Architecture agents both flagged |
