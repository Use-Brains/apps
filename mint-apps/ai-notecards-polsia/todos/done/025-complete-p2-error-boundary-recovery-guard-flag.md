---
status: pending
priority: p2
issue_id: "025"
tags: [code-review, plan-review, frontend, race-condition, phase-3]
dependencies: []
---

# Phase 3: ErrorBoundary Needs Recovery Guard Flag to Prevent Re-render Cascade

## Problem Statement

Between `window.location.href = '/dashboard'` (or any navigation) and the actual page unload, React is still alive and processing. Stale timers, WebSocket callbacks, or parent component re-renders can trigger `setState` calls, causing the errored component tree to attempt re-rendering. This can produce a cascade of errors during the brief navigation window, potentially causing the error boundary itself to throw (uncatchable) or flash error UI before navigation completes.

## Findings

- **Frontend Races Reviewer** (HIGH): Identified the race window between navigation initiation and page unload as a re-render cascade risk

## Proposed Solutions

### Option A: Add `isRecovering` guard flag (Recommended)

Set an instance flag in `handleRecover` that short-circuits `render()`:

```jsx
handleRecover = () => {
  this.isRecovering = true;
  this.forceUpdate(); // render returns null
  window.location.href = '/';
};

render() {
  if (this.isRecovering) return null;
  if (this.state.hasError) return /* error UI */;
  return this.props.children;
}
```

- **Effort**: Small — 3-4 lines of code
- **Risk**: None

## Acceptance Criteria

- [ ] ErrorBoundary sets a guard flag before initiating navigation
- [ ] `render()` returns null when the guard flag is set
- [ ] No error cascade occurs between recovery click and page navigation
- [ ] Guard flag is an instance property (not state) to avoid triggering additional re-renders

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Navigation does not immediately stop React — guard flags prevent re-render cascades during page unload |
