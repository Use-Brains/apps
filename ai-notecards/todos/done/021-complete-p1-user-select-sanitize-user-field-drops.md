---
status: pending
priority: p1
issue_id: "021"
tags: [code-review, plan-review, correctness, phase-5]
dependencies: []
---

# Phase 5: Plan's USER_SELECT and sanitizeUser Rewrites Drop 13+ Fields

## Problem Statement

The plan rewrites `USER_SELECT` with only ~7 fields. The real `USER_SELECT` at `auth.js:11-16` has 20+ fields including `daily_generation_count`, `connect_charges_enabled`, `seller_terms_accepted_at`, `role`, `suspended`, `avatar_url`, `preferences`, and more. Similarly, `sanitizeUser` is rewritten with camelCase names when the real function uses snake_case. Implementing the plan as written would break every client feature that depends on these fields — the dashboard, seller flows, admin panel, settings page, and generation limits would all fail silently or crash.

## Findings

- **Pattern Recognition** (HIGH x2): Flagged both `USER_SELECT` and `sanitizeUser` rewrites as high-severity, noting the field count discrepancy and naming convention mismatch

## Proposed Solutions

### Option A: Show only the diff (Recommended)

The plan should only show what to ADD, not rewrite the entire constant:

- Add `email_verified` to the existing `USER_SELECT` string
- Add `email_verified: !!user.email_verified` to the existing `sanitizeUser` function
- Do NOT rewrite either function

- **Effort**: Small — fix the plan to show a targeted addition
- **Risk**: None

### Option B: Show full rewrite with all fields

Rewrite the plan's code examples to include all 20+ existing fields plus the new one.

- **Effort**: Medium — tedious and error-prone
- **Risk**: Still might miss a field; harder to review

## Acceptance Criteria

- [ ] Plan code example for `USER_SELECT` adds `email_verified` without removing existing fields
- [ ] Plan code example for `sanitizeUser` adds `email_verified` mapping without removing existing mappings
- [ ] All existing snake_case naming conventions are preserved
- [ ] Implementation does not alter any existing fields in `USER_SELECT` or `sanitizeUser`
- [ ] Dashboard, seller, admin, settings, and generation features remain functional after change

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Plan code examples that rewrite entire functions are dangerous — always show minimal diffs |
