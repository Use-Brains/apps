---
status: pending
priority: p1
issue_id: "002"
tags: [code-review, pattern-recognition, runtime-error]
dependencies: []
---

# Plan Uses `req.user.id` — Codebase Uses `req.userId`

## Problem Statement

Every code sample in the plan uses `req.user.id` (e.g., avatar upload, password change, export, delete account). The authenticate middleware sets `req.userId = payload.userId` (not `req.user`). Every existing route in the codebase uses `req.userId`. All plan code will fail at runtime because `req.user` is `undefined`.

## Findings

- **Pattern Recognition**: CRITICAL — `req.user` is undefined, every endpoint in the plan will crash
- **Location**: Plan lines 202, 216, 240, 251, 254, 257, 365, 378, 389

## Proposed Solutions

### Option A: Fix all plan code samples (Recommended)

Replace `req.user.id` with `req.userId` in all code samples during implementation.

- **Pros**: Matches codebase convention, simple find-replace
- **Cons**: None
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] No code uses `req.user.id` — all use `req.userId`
- [ ] All new endpoints work with the authenticate middleware

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Plan code samples don't match actual middleware |
