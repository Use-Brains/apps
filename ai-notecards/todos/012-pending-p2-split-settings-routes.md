---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, architecture]
dependencies: []
---

# Split Settings Routes to Prevent File Bloat

## Problem Statement

The current `settings.js` is 36 lines. The plan adds 6 new endpoints with substantial logic (multer, magic-bytes, bcrypt, Stripe, streaming JSON). This would push it to 300-400 lines, violating the existing pattern of splitting by domain (e.g., `auth.js`, `auth-google.js`, `auth-magic.js`).

## Findings

- **Architecture Strategist** (#2.1): Most significant architectural concern — split into settings + account
- **Architecture Strategist** (#2.2): Missing service layer extraction for Supabase Storage

## Proposed Solutions

### Option A: Split into settings.js + account.js (Recommended)

- `settings.js` — profile, preferences, export (configuration)
- `account.js` — password, avatar upload/delete, account deletion (identity/security)

Register as `app.use('/api/account', accountRoutes)`.

Optionally create `services/storage.js` for Supabase Storage REST calls.

- **Pros**: Follows existing split pattern, files stay under 150 lines
- **Cons**: New route prefix `/api/account`
- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] No single route file exceeds ~200 lines
- [ ] Route organization follows existing auth split pattern

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Current codebase splits auth into 3 files |
