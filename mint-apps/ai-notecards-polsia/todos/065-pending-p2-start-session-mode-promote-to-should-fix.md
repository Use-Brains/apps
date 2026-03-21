---
status: pending
priority: p2
issue_id: "065"
tags: [code-review, typescript, mobile, type-safety]
dependencies: ["059"]
---

# startSession mode: string Should Be Fixed Now (StudyMode Type Already Exists)

## Problem Statement

`api.startSession()` in `mobile/src/lib/api.ts` line 113 accepts `mode: string`. The `StudyMode` union type (`'flip' | 'multiple_choice' | 'type_answer' | 'match'`) is already defined in `types/api.ts` line 52.

The plan defers this to brainstorm #3 (study mode). That is unnecessarily risky for a one-word change. Any typo in the mode string (`'flip '`, `'Flip'`, `'multiple-choice'`) becomes a silent runtime server error rather than a compile error. The type exists; using it costs one word.

## Findings

- **TypeScript Reviewer (Review Round 3):** P2-A — `StudyMode` type exists; deferral is unjustified; one-word fix

Affected: `mobile/src/lib/api.ts` line 113

## Proposed Solutions

### Option A: Use existing StudyMode type (Recommended)

```typescript
// Before:
startSession: (deckId: string, mode: string, cardIds: string[]) =>

// After:
startSession: (deckId: string, mode: StudyMode, cardIds: string[]) =>
```

Add import: `import type { StudyMode } from '../types/api';`

**Pros:** One word; type already exists; typos become compile errors immediately
**Cons:** None
**Effort:** Trivial
**Risk:** None

## Acceptance Criteria

- [ ] `api.startSession()` `mode` parameter typed as `StudyMode` (not `string`)
- [ ] `StudyMode` imported from `../types/api`
- [ ] `npx tsc --noEmit` passes
