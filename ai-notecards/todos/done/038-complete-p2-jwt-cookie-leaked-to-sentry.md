---
status: complete
priority: p2
issue_id: "038"
tags: [code-review, plan-review, security, sentry, phase-4]
dependencies: []
---

# Phase 4: JWT Cookie Leaked to Sentry via Request Headers

## Problem Statement

The server Sentry `beforeSend` stripped `event.user.email` and `event.request.data`, but didn't strip `event.request.cookies` or `event.request.headers.cookie`. The JWT (which contains `userId`) would be sent to Sentry with every server error event. While Sentry is a trusted service, minimizing PII exposure is defense-in-depth.

## Findings

- **Security Sentinel (Round 2):** MEDIUM — JWT in cookie leaks to Sentry

## Resolution

Added `delete event.request.cookies` and `delete event.request.headers.cookie` to the server `beforeSend` handler.
