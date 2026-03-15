---
status: pending
priority: p3
issue_id: "017"
tags: [code-review, simplicity, scope]
dependencies: []
---

# Scope Simplification Opportunities

## Problem Statement

The simplicity reviewer identified several areas where the plan is over-scoped or over-engineered for current needs.

## Findings

- **Simplicity Reviewer**: 9 YAGNI violations identified. Key recommendations:

1. **Defer Profile page (Phase 3)** — Put study stats on Dashboard instead. Eliminates ~200 LOC, 2 endpoints, cursor pagination index.
2. **Defer notification toggles** — Building UI for toggles that do nothing. Add when email delivery is built.
3. **Consider plain columns instead of JSONB** — Only 2 settings (card_order, auto_flip_seconds) after removing notifications. Plain columns get database-level type checking for free.
4. **Use explicit Save button instead of auto-save** — Matches existing Settings UI pattern. Eliminates 30-line debounce+serialize mechanism.
5. **Drop mutual exclusion for export/delete** — Manufactured concern, each button has its own loading state.
6. **Drop avatar generation counter** — Upload + await + refreshUser is sufficient.
7. **Simplify export to non-streaming** — Expected data volumes are kilobytes, not gigabytes.
8. **Single avatar_url column** — Set Google photo URL on signup, overwrite on upload, null on delete. Eliminates `google_avatar_url` column and fallback logic.

## Decision Needed

These are suggestions, not bugs. The user should decide which simplifications to accept.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Simplicity reviewer recommends reducing 4 phases to 2 |
