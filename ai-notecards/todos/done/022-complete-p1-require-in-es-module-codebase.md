---
status: pending
priority: p1
issue_id: "022"
tags: [code-review, plan-review, correctness, phase-4]
dependencies: []
---

# Phase 4: `require()` in ES Module Codebase Will Fail at Runtime

## Problem Statement

The ErrorBoundary `componentDidCatch` uses `const Sentry = require('@sentry/react')` inside a try/catch. The project uses ES modules throughout (`"type": "module"` in both `package.json` files, Vite bundler). `require()` is not available in ES modules and will throw a `ReferenceError`. Because it is wrapped in try/catch, the error is silently swallowed, meaning Sentry never receives ErrorBoundary errors. This defeats the purpose of adding Sentry error reporting in Phase 4.

## Findings

- **Architecture Strategist** (MEDIUM): Flagged ES module incompatibility
- **Frontend Races Reviewer** (MEDIUM): Identified the silent failure path in try/catch
- **Pattern Recognition** (HIGH): Confirmed `require()` contradicts project-wide ES module pattern
- **Spec Flow Analyzer** (Critical Q3): Raised as a critical question — the entire Sentry integration for client-side errors is non-functional

## Proposed Solutions

### Option A: Top-level import with runtime guard (Recommended)

```jsx
import * as Sentry from '@sentry/react';

// In componentDidCatch:
if (typeof Sentry?.captureException === 'function') {
  Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
}
```

- **Effort**: Small — change one import style and add a guard
- **Risk**: None — standard ES module pattern

### Option B: Dynamic import()

```jsx
componentDidCatch(error, errorInfo) {
  import('@sentry/react').then(Sentry => {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }).catch(() => {});
}
```

- **Effort**: Small — but introduces async behavior in error handling
- **Risk**: Low — dynamic import might not resolve if the module failed to load

## Acceptance Criteria

- [ ] No `require()` calls exist in client-side code
- [ ] Sentry is imported using ES module syntax (`import`)
- [ ] ErrorBoundary successfully reports errors to Sentry when Sentry is configured
- [ ] ErrorBoundary does not crash when Sentry is not configured (graceful fallback)
- [ ] Manual test: trigger an error in a wrapped component and verify it appears in Sentry dashboard

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Plan code must match project module system — require() in an ESM project silently fails |
