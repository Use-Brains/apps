---
status: pending
priority: p3
issue_id: "057"
tags: [code-review, quality, patterns, consistency]
dependencies: []
---

# Code Quality Improvements: Hooks, Logging, Query Patterns, Shutdown

## Problem Statement

Several code quality improvements identified across reviewers that reduce duplication, improve debuggability, and follow better patterns.

## Findings

### 1. Extract async guard hook (3 identical patterns)
The ref-based double-click guard appears in `handleDuplicate`, "Duplicate & Edit" banner, and existing `savingRef` in Generate.jsx. Extract to `useAsyncGuard()` hook.

### 2. Empty catch blocks should console.warn in dev
All PostHog `try {} catch {}` blocks silently swallow errors. Add `if (import.meta.env.DEV) console.warn('[analytics]', err)` for debuggability.

### 3. Normalize COUNT query pattern across 3 locations
`decks.js:112` uses `COUNT(*)::int`, `plan.js:93` uses `COUNT(*)` with `parseInt`. Normalize to one pattern, ideally extract to a shared helper to prevent the 3 locations from diverging.

### 4. SIGTERM handler needs timeout guard and server drain
```js
process.on('SIGTERM', async () => {
  const timeout = setTimeout(() => process.exit(1), 5000);
  server.close();
  await shutdownAnalytics();
  await pool.end();
  clearTimeout(timeout);
  process.exit(0);
});
```

### 5. Cache localStorage consent in module variable
`localStorage.getItem('analytics_consent')` called on every `track()` and `identify()`. Read once and cache:
```js
let consentGranted = localStorage.getItem('analytics_consent') === 'granted';
export function updateConsent(granted) { consentGranted = granted; ... }
```

### 6. PostHog `cookieless_mode: 'on_reject'` mentioned in research but missing from init code
Either add it or remove from research claims.

### 7. Plan incorrectly claims pool.js is lazy-init
Pool is created eagerly at import time. Minor text inaccuracy — fix in plan.

## Acceptance Criteria

- [ ] Each improvement evaluated during implementation
- [ ] At minimum: empty catch blocks get dev logging, SIGTERM handler gets timeout
