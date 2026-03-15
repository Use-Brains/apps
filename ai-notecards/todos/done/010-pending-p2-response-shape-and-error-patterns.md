---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, pattern-recognition]
dependencies: []
---

# Response Shape and Error Handling Pattern Inconsistencies

## Problem Statement

Multiple pattern inconsistencies in the plan's code samples vs established codebase conventions.

## Findings

- **Pattern Recognition** (#3): `{ message: '...' }` not used in codebase — use `{ ok: true }`
- **Pattern Recognition** (#5): Magic-byte failure uses `status(400)` — codebase uses `status(422)` for content validation
- **Pattern Recognition** (#8): No `try/catch` in password, export, delete handlers — every existing route uses try/catch + console.error + 500 response

## Proposed Solutions

### Option A: Match existing patterns (Recommended)

- Use `res.json({ ok: true })` for success without data
- Use `status(422)` for content validation failures
- Wrap all handlers in try/catch with `console.error('Descriptive error:', err)` and `status(500)`

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] No `{ message }` responses — use `{ ok: true }` pattern
- [ ] Magic-byte validation failure returns 422
- [ ] All handlers have try/catch with console.error and 500 response

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Consistency with existing codebase patterns |
