---
status: pending
priority: p3
issue_id: "031"
tags: [code-review, plan-review, security, phase-4]
dependencies: []
---

# Missing Generic Express Error Handler After Sentry

## Problem Statement

The Express server has no catch-all error handler `(err, req, res, next)`. Without one, Express falls back to its default error handler. If `NODE_ENV` is accidentally unset or set to `development` in production, Express returns full stack traces in HTML responses. This leaks internal implementation details, file paths, dependency versions, and potentially sensitive data embedded in error messages.

Even with Sentry in place (Phase 4), Sentry's error handler passes errors through — it does not send a response. A generic handler is needed after Sentry to send a safe, generic error response.

## Findings

- **Architecture Strategist** (LOW): Noted the missing error handler as an architectural gap
- **Security Sentinel** (LOW): Flagged potential stack trace leakage in production

## Proposed Solutions

### Option A: Add generic error handler (Recommended)

Add a catch-all error handler as the last middleware in the Express app:

```javascript
// After all routes and Sentry error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});
```

- **Effort**: Small — 4 lines of code
- **Risk**: None

## Acceptance Criteria

- [ ] Express app has a catch-all `(err, req, res, next)` error handler as the last middleware
- [ ] Handler returns a generic JSON error response, never a stack trace
- [ ] Handler logs the error server-side for debugging
- [ ] Response status uses `err.status` if available, defaults to 500
- [ ] Verified: no stack traces leak in responses regardless of NODE_ENV setting

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Every Express app needs a generic error handler — the default leaks stack traces |
