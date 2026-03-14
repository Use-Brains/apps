---
status: pending
priority: p1
issue_id: "004"
tags: [code-review, security, data-integrity, privacy]
dependencies: []
---

# Account Deletion PII Scrub is Incomplete

## Problem Statement

The soft-delete UPDATE scrubs `email`, `display_name`, `avatar_url`, `google_avatar_url`, `password_hash`, and `preferences` — but omits several PII-linked columns. Additionally, Google OAuth login could match a deleted user by `google_user_id`, blocking re-registration.

## Findings

- **Security Sentinel** (H2): `google_user_id` not cleared — allows re-registration fingerprinting and blocks Google re-signup
- **Data Integrity Guardian** (#4): `stripe_customer_id`, `stripe_connect_account_id`, `connect_charges_enabled`, `connect_payouts_enabled`, `seller_terms_accepted_at` all contain identity-linked data
- **Data Integrity Guardian** (#5): Google OAuth handler and login queries need `AND deleted_at IS NULL`

## Proposed Solutions

### Option A: Expand PII scrub + update auth queries (Recommended)

Add to the soft-delete UPDATE:
```sql
google_user_id = NULL,
stripe_customer_id = NULL,
stripe_connect_account_id = NULL,
connect_charges_enabled = false,
connect_payouts_enabled = false,
seller_terms_accepted_at = NULL
```

Add `AND deleted_at IS NULL` to:
- Login query (`auth.js` line 89)
- Google OAuth lookup (`auth-google.js`)
- Signup email uniqueness check (`auth.js` line 60)

- **Pros**: Complete PII removal, prevents ghost re-login
- **Cons**: Slightly larger UPDATE statement
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] All identity-linked columns nullified on soft-delete
- [ ] Google OAuth cannot match a deleted user
- [ ] Email/password login cannot match a deleted user
- [ ] Signup with deleted user's email succeeds

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-14 | Created from code review | Multiple agents flagged this independently |
