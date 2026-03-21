---
status: pending
priority: p3
issue_id: "055"
tags: [code-review, frontend, performance, marketplace-operations]
dependencies: []
---

# Countdown Timer Should Use setTimeout, Not requestAnimationFrame

## Problem Statement

The plan's countdown timer uses `requestAnimationFrame` in a tight loop that runs at 60fps for potentially hours (deadline is UTC midnight). The DOM updates once per second, but rAF fires 60 times per second — draining battery on mobile devices for no visible benefit.

## Findings

- **Frontend Races (P2-1)**: rAF at 60fps to update a seconds counter. Use `setTimeout(tick, 1000)` with `visibilitychange` handler for immediate recalculation on tab foreground.
- **Code Simplicity (P1)**: Recommends deferring the entire countdown timer for v1 — display static "Resets at [local time]" text instead.

## Proposed Solutions

### Option A: Defer countdown timer entirely (Recommended)

Show static text: `Resets at ${new Date(resetsAtUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`. Three lines of code, no timer.

### Option B: If implementing timer, use setTimeout + visibilitychange

```javascript
const tick = () => {
  const remaining = Math.max(0, retryDeadline - Date.now());
  setCountdownSeconds(Math.ceil(remaining / 1000));
  if (remaining <= 0) { setRetryDeadline(null); return; }
  timeoutId = setTimeout(tick, 1000);
};
```

Plus `visibilitychange` handler for instant recalculation on tab foreground.

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] No 60fps timer loop for a seconds counter
- [ ] Timer accurate when returning from background tab

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from marketplace-operations review | Frontend Races + Code Simplicity agents both flagged |
