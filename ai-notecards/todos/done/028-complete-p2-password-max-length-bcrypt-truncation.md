---
status: pending
priority: p2
issue_id: "028"
tags: [code-review, plan-review, security, phase-6]
dependencies: []
---

# Phase 6: Password Validation Needs Max Length (bcrypt 72-byte Truncation)

## Problem Statement

The password validation only enforces a minimum of 8 characters with no maximum length. Bcrypt silently truncates input at 72 bytes. A user who sets a 100-character password can log in with just the first 72 characters — a subtle security issue that violates the principle of least surprise. Additionally, without a max length on the password field, the `express.json()` default 1MB body limit means an attacker could submit extremely large password strings, consuming bcrypt CPU time (bcrypt is intentionally slow, so hashing a 1MB string is wasteful even though it gets truncated).

## Findings

- **Security Sentinel** (HIGH): Flagged bcrypt truncation as a security concern and the missing max length as an abuse vector
- **Spec Flow Analyzer** (Gap 3): Identified the missing upper bound in password validation

## Proposed Solutions

### Option A: Add max 128 character validation (Recommended)

Add server-side and client-side validation capping passwords at 128 characters. This is well above the 72-byte bcrypt limit but prevents abuse.

```javascript
if (newPassword.length > 128) {
  return res.status(400).json({ error: 'Password must be 128 characters or fewer' });
}
```

- **Effort**: Small — one validation check on server, one on client
- **Risk**: None

### Option B: Max 72 characters (strict bcrypt match)

Cap at exactly 72 characters to match bcrypt's actual limit.

- **Effort**: Small
- **Risk**: Low — some users may find 72 characters limiting, though unlikely in practice

### Option C: Add common password blocklist

In addition to length limits, check against a list of common passwords (e.g., top 10,000).

- **Effort**: Medium — need to source and maintain a blocklist
- **Risk**: Low — could be added later as a separate enhancement

## Acceptance Criteria

- [ ] Server-side validation rejects passwords longer than 128 characters
- [ ] Client-side validation shows an error for passwords longer than 128 characters
- [ ] Error message clearly states the maximum length
- [ ] Minimum 8 character requirement is preserved

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-13 | Created from synthesized technical review | Bcrypt silently truncates at 72 bytes — always enforce a max password length |
