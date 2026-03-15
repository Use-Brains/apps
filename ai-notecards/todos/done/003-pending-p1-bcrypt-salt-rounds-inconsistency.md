---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, security, pattern-recognition]
dependencies: []
---

# bcrypt Salt Rounds: Plan Uses 10, Codebase Uses 12

## Problem Statement

The password change endpoint in the plan uses `bcrypt.hash(newPassword, 10)`. The codebase defines `SALT_ROUNDS = 12` in `auth.js` (line 8) and uses it consistently in signup and seed. Using 10 instead of 12 creates passwords with weaker hashing than those created at signup.

## Findings

- **Pattern Recognition**: CRITICAL — silent security degradation
- **Location**: Plan line 251 vs `server/src/routes/auth.js:8`

## Proposed Solutions

### Option A: Import SALT_ROUNDS from auth.js (Recommended)

```javascript
import { SALT_ROUNDS } from './auth.js';
const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
```

- **Pros**: DRY, consistent, if rounds change they change everywhere
- **Cons**: Requires exporting SALT_ROUNDS from auth.js (may already be exported)
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] Password change uses same salt rounds as signup (12)
- [ ] `SALT_ROUNDS` is imported, not hardcoded

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | auth.js exports SALT_ROUNDS = 12 |
