---
status: complete
priority: p1
issue_id: "035"
tags: [code-review, plan-review, frontend, backend, phase-6]
dependencies: []
---

# Phase 6: Existing !currentPassword Guard at account.js:106 Rejects Set Password Flow

## Problem Statement

The existing `PATCH /password` handler at `account.js:106` has `if (!currentPassword || !newPassword)` as its first guard. This rejects any request where `currentPassword` is absent — which is exactly the "Set Password" flow (user has no password, sends only `newPassword`). The new code in the plan must REPLACE the entire handler, not add to it.

## Findings

- **Frontend Races Reviewer (Round 2):** P1 — existing guard would reject the Set Password flow before new code runs
- **Pattern Recognition (Round 2):** Confirmed the guard is the first check in the handler

## Resolution

Added explicit note in the plan above the endpoint code: "The current endpoint at account.js:106 has `if (!currentPassword || !newPassword)` which rejects requests where `currentPassword` is absent. The new code below replaces the entire handler."
