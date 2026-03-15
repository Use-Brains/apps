---
status: pending
priority: p2
issue_id: "024"
tags: [code-review, plan-review, ux, phase-3]
dependencies: []
---

# Phase 3: ErrorBoundary Recovery Hardcodes /dashboard — Breaks for Unauthenticated Users

## Problem Statement

The ErrorBoundary `handleRecover` navigates to `/dashboard`. On public pages (Marketplace, Pricing, Terms of Service), unauthenticated users who encounter an error and click "Go to Dashboard" are redirected to `/login` because `/dashboard` requires authentication. This is a confusing UX — the user hit an error, clicked a recovery button, and ended up at a login page they may not have an account for.

## Findings

- **Architecture Strategist** (LOW): Noted the hardcoded route as inflexible
- **Pattern Recognition** (MEDIUM): Flagged the auth-required destination as problematic for public pages
- **Spec Flow Analyzer** (Gap 12): Identified this as a user flow gap — public page errors have no sensible recovery path

## Proposed Solutions

### Option A: Navigate to `/` (Recommended)

Change `handleRecover` to navigate to `/` (the landing page), which is accessible to all users regardless of auth state.

- **Effort**: Small — change one string
- **Risk**: None

### Option B: Use `window.location.reload()`

Reload the current page instead of navigating away. The error state is cleared and the user stays where they were.

- **Effort**: Small
- **Risk**: Low — if the error is deterministic, the user gets stuck in a reload loop. Could add a retry counter.

### Option C: Context-aware navigation

Check auth state and navigate to `/dashboard` if authenticated, `/` otherwise.

- **Effort**: Medium — ErrorBoundary is a class component, needs auth context integration
- **Risk**: Low — adds complexity for marginal benefit over Option A

## Acceptance Criteria

- [ ] ErrorBoundary recovery button navigates to a publicly accessible page
- [ ] Unauthenticated users on public pages can recover without being sent to login
- [ ] Recovery button label matches the destination (e.g., "Go to Home" not "Go to Dashboard" if navigating to `/`)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Error recovery paths must work for all user types, not just authenticated users |
