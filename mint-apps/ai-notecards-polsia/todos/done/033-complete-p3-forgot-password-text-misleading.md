---
status: pending
priority: p3
issue_id: "033"
tags: [code-review, plan-review, ux, copy, phase-6]
dependencies: []
---

# Phase 6: "Forgot Your Password?" Text Is Misleading Since No Password Login Exists

## Problem Statement

The Login page has no password field — users sign in with a magic code (email-based authentication). The plan adds "Forgot your password?" text to the login page. This implies a password-based login exists, which it does not. Users who never set a password will be confused by the prompt. Users who did set a password (via Settings) will expect a password reset flow, which also does not exist — the "forgot password" link presumably leads to the magic code flow they are already on.

## Findings

- **Spec Flow Analyzer** (Gap 6): Identified the copy as misleading given the passwordless login flow

## Proposed Solutions

### Option A: Reword to match the actual auth flow (Recommended)

Replace "Forgot your password?" with copy that reflects the passwordless login:

- "You can always sign in with a code — no password needed."
- "No password? No problem. We'll email you a sign-in code."

- **Effort**: Small — copy change only
- **Risk**: None

### Option B: Remove the text entirely

If there is no password login and no password reset flow, there is nothing to communicate. Remove the text.

- **Effort**: Small
- **Risk**: None — less UI clutter

### Option C: Add a password login option

If password login should exist alongside magic codes, implement it. But this is a significant scope addition.

- **Effort**: Large — new auth flow, new UI, password reset flow needed
- **Risk**: Medium — scope creep for pre-launch

## Acceptance Criteria

- [ ] Login page does not reference "forgot password" unless a password login flow exists
- [ ] Any helper text on the login page accurately describes the available auth methods
- [ ] Copy is reviewed for consistency with the actual auth UX

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | UI copy must match actual functionality — referencing nonexistent features confuses users |
