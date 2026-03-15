---
status: pending
priority: p3
issue_id: "032"
tags: [code-review, plan-review, security, privacy, phase-4]
dependencies: []
---

# Server-Side Sentry Init Missing beforeSend PII Scrubbing

## Problem Statement

The plan's client-side Sentry configuration includes a `beforeSend` hook that strips PII (personally identifiable information) from error events before sending them to Sentry. The server-side Sentry configuration has no such hook. Server errors frequently include request bodies (which may contain passwords, email addresses), user objects in error contexts, and database query parameters. Without PII scrubbing, sensitive user data will be sent to and stored in Sentry's external servers.

This is both a privacy concern and a potential compliance issue if the app handles users in GDPR/CCPA jurisdictions.

## Findings

- **Security Sentinel** (MEDIUM): Flagged the asymmetry between client and server PII handling
- **Spec Flow Analyzer** (Gap 16): Identified the missing server-side `beforeSend` as a privacy gap

## Proposed Solutions

### Option A: Add beforeSend to server Sentry init (Recommended)

Add a `beforeSend` hook to the server-side Sentry configuration that strips:
- Request body data (especially password fields)
- User email addresses (replace with user ID only)
- Database query parameters
- Any `Authorization` headers

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    if (event.request?.data) {
      delete event.request.data; // strip request body
    }
    if (event.user?.email) {
      delete event.user.email; // keep only user ID
    }
    return event;
  },
});
```

- **Effort**: Small — mirror the client-side pattern
- **Risk**: None — less data in Sentry is strictly better for privacy

### Option B: Use Sentry's server-side data scrubbing settings

Configure scrubbing rules in the Sentry dashboard instead of in code.

- **Effort**: Small — but depends on Sentry plan features and is less auditable
- **Risk**: Low — configuration drift between environments

## Acceptance Criteria

- [ ] Server-side Sentry init includes a `beforeSend` hook
- [ ] Request bodies are stripped from error events (especially password fields)
- [ ] User email addresses are removed from error contexts
- [ ] Authorization headers are not sent to Sentry
- [ ] Parity between client and server PII scrubbing approaches

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | PII scrubbing must be applied symmetrically — client-only scrubbing leaves server errors exposed |
