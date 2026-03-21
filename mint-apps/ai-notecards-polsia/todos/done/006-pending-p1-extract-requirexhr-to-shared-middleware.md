---
status: pending
priority: p1
issue_id: "006"
tags: [code-review, architecture, security]
dependencies: []
---

# Extract `requireXHR` to Shared Middleware

## Problem Statement

`requireXHR` is defined locally inside `generate.js` (lines 14-19) and is not exported. The plan calls for it on all new settings endpoints but doesn't address how it gets there. Duplicating the function creates maintenance drift. Additionally, the export endpoint's frontend `fetch` call doesn't include the `X-Requested-With` header (it bypasses the `api.js` wrapper), so it would be rejected.

## Findings

- **Architecture Strategist** (#3): Must-fix — extract to shared middleware
- **Security Sentinel** (H4): CSRF defense collapses if CORS ever relaxed; needs to be centralized
- **Pattern Recognition** (#4): SIGNIFICANT — function is local to generate.js, no export

## Proposed Solutions

### Option A: Move to `server/src/middleware/csrf.js` (Recommended)

Create a shared middleware file, import from both `generate.js` and `settings.js`.

- **Pros**: DRY, single source of truth, follows middleware pattern
- **Cons**: Minor refactor of generate.js imports
- **Effort**: Small
- **Risk**: None

Also fix: add `X-Requested-With: 'XMLHttpRequest'` header to the export `fetch` call in the frontend, or route through the `api.js` wrapper.

## Acceptance Criteria

- [ ] `requireXHR` is in a shared middleware file
- [ ] `generate.js` imports from the shared location
- [ ] All new settings endpoints use the shared `requireXHR`
- [ ] Export download includes `X-Requested-With` header

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Multiple agents flagged independently |
