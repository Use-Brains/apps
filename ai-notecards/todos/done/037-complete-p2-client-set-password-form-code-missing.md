---
status: complete
priority: p2
issue_id: "037"
tags: [code-review, plan-review, frontend, phase-6]
dependencies: []
---

# Phase 6: Client-Side Set Password Form Handler Code Missing

## Problem Statement

The plan described the "Set Password" form (inputs, button) but didn't include the actual event handler, API call pattern, or `refreshUser()` integration. Without this, the implementer has to figure out: (1) how to call `api.changePassword` with null currentPassword, (2) that `refreshUser()` is critical after success, and (3) the error handling pattern.

## Findings

- **Pattern Recognition (Round 2):** P2 — no client-side code for Set Password form
- **Simplicity Reviewer (Round 2):** Flagged gap between server code completeness and client code absence
- **Architecture Strategist (Round 2):** Noted the form handler should follow existing Settings patterns
- **Frontend Races (Round 2):** P2 — without `refreshUser()`, stale `has_password` causes confusing UX

## Resolution

Added complete `handleSetPassword` handler with `api.changePassword(null, newPassword)`, `refreshUser()` call, and explanatory note about why refresh is critical (stale `has_password` would keep showing Set Password form after it's already set).
