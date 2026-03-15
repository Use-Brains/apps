# Institutional Learnings for Seller Onboarding Flow Implementation

## Search Context
- **Feature/Task**: Seller onboarding flow implementation with:
  1. Authentication flows (Google + Apple + Magic Link)
  2. Error handling and structured error codes
  3. Middleware patterns (CSRF, auth, plan checks, term acceptance)
  4. Email service (Resend integration)
  5. Account management and settings experience
  6. Seller flow and database schema

- **Keywords Used**: auth, password, email, middleware, error, seo, logging, database schema, seller, terms, onboarding
- **Files Scanned**: 2 solutions documents, 17 brainstorms/plans checked
- **Relevant Matches**: 2 comprehensive solution docs + seller onboarding plan

---

## Critical Solution Documents Found

### 1. Auth Revamp Implementation Guide
**File**: `docs/solutions/auth-implementation-guide.md`

**Severity**: HIGH

**Covers**:
- Google OAuth token verification and auto-account creation
- Magic link 6-digit code pattern (email-based passwordless)
- Resend integration for transactional emails
- JWT token management (24h expiry, httpOnly cookies, sameSite:lax)
- Database schema additions (google_user_id, google_email_verified)
- Error codes for auth flows (AUTH_MAGIC_CODE_INVALID, AUTH_MAGIC_CODE_EXPIRED, AUTH_MAGIC_RATE_LIMITED)
- Frontend login page component with three auth methods

**Key Insights for Seller Onboarding**:
- Already has complete auth infrastructure; magic link and Google auth are implemented
- EMAIL service via Resend is already set up for magic link codes
- Structured error codes pattern in `server/src/constants/errors.js` should be extended for seller-specific errors
- User auto-creation on first auth → new users may need seller flow prompts post-checkout
- Email is claimed by first auth method (no account linking in v1) — affects multi-provider scenarios

**Critical Pattern**: Token management uses JWT in httpOnly cookies with 24h expiry. The `setTokenCookie(res, userId)` helper is used consistently across all auth flows.

---

### 2. Account & Settings Experience
**File**: `docs/solutions/feature-patterns/account-settings-experience.md`

**Severity**: MEDIUM

**Covers**:
- Soft-delete with PII scrubbing (because purchases table has RESTRICT FK to users)
- Two-tier auth pattern: `authenticate` (stateless JWT) + `requireActiveUser` (DB check for sensitive ops)
- Token revocation for password changes (`token_revoked_at` + 1-second buffer)
- CSRF middleware using custom header validation
- Cursor-based pagination for study history (composite `(timestamp, id)` cursor)
- Avatar upload with magic-byte validation (preventing polyglot/renamed files)
- Preferences JSONB with allowlist validation and deep-merge
- Navbar dropdown with avatar and user menu (ARIA keyboard navigation)
- Debounce + serialize pattern for auto-save to prevent lost updates

**Key Insights for Seller Onboarding**:
- **Soft-delete pattern is critical**: The account deletion document references that purchases FK requires soft-delete. Seller terms acceptance and Connect status should also be preserved in soft-deleted accounts.
- **CSRF middleware**: Any state-changing endpoints (like terms acceptance) should use the `requireXHR` middleware pattern
- **Token revocation**: If implementing seller-specific operations that require re-verification, reuse the `token_revoked_at` pattern
- **Two-tier auth**: Use `authenticate` for general access, `requireActiveUser` for sensitive operations like accepting seller terms
- **Error codes structure**: Shows pattern for structured error responses (e.g., `{ error: 'terms_required', message: '...' }`)

**Reusable Patterns**:
1. Soft-delete with PII scrubbing (already in use)
2. Two-tier auth (authenticate + requireActiveUser)
3. CSRF middleware
4. Cursor pagination for lists
5. Allowlist validator for JSONB config

---

### 3. Seller Onboarding Flow & Dashboard Plan
**File**: `docs/plans/2026-03-13-feat-seller-onboarding-and-marketplace-listing-plan.md`

**Severity**: HIGH (directly applicable)

**Covers**:
- Database schema additions:
  - `users.seller_terms_accepted_at` (TIMESTAMPTZ)
  - `users.seller_terms_version` (INT, nullable)
  - `marketplace_listings.delisted_at` (TIMESTAMPTZ)
- New endpoint: `POST /api/seller/accept-terms` (idempotent)
- Terms acceptance gates on three existing endpoints:
  1. `POST /api/seller/onboard` (Stripe Connect)
  2. `POST /api/seller/listings` (create listing)
  3. `POST /api/seller/listings/:id/relist` (relist)
- Dashboard UI: seller status-aware icons on deck cards
  - "Sell" (generated, 10+ cards, not listed, user is seller)
  - "View" (active listing)
  - "Relist" (delisted listing)
  - Greyed out (ineligible: purchased, <10 cards, not seller)
- Frontend flow:
  - Post-checkout seller prompt (banner)
  - Seller terms modal (checkbox)
  - Stripe Connect redirect
  - Return to dashboard with sell icons enabled

---

## Key Implementation Patterns to Follow

### 1. Middleware Chain Pattern
All protected routes use consistent middleware stacking:
```javascript
authenticate → checkTrialExpiry → requirePlan('pro') → [optional: requireActiveUser]
```

For seller-specific routes, add:
```javascript
authenticate → checkTrialExpiry → requirePlan('pro') → requireSellerTermsAccepted
```

### 2. Error Code Structure
Extend `server/src/constants/errors.js` with seller-specific codes:
```javascript
SELLER_TERMS_REQUIRED: 'terms_required',
SELLER_CONNECT_INCOMPLETE: 'seller_connect_incomplete',
SELLER_OPERATION_FORBIDDEN: 'seller_operation_forbidden',
```

### 3. Database Query Pattern for Terms Gating
When checking terms acceptance:
```sql
SELECT seller_terms_accepted_at, connect_charges_enabled
FROM users
WHERE id = $1 AND deleted_at IS NULL
```

Return 403 if either is missing:
```javascript
if (!userRows[0].seller_terms_accepted_at) {
  return res.status(403).json({
    error: 'terms_required',
    message: 'You must accept seller terms first.'
  });
}
```

### 4. Idempotent Terms Acceptance
The accept-terms endpoint should be idempotent:
- If `seller_terms_accepted_at` is already set, return 200 with existing timestamp
- Don't update the timestamp on repeated calls
- This prevents "false" re-acceptance tracking

### 5. Soft-Delete Considerations
When a user is deleted:
- Set `seller_terms_accepted_at = NULL` during PII scrub
- Set `stripe_connect_account_id = NULL` and `connect_charges_enabled = false`
- All active listings should be delisted (set `delisted_at`)
- Purchase records remain intact (RESTRICT FK preserved)

### 6. Frontend Auto-Save Pattern
For settings pages with rapid changes (e.g., seller settings toggle):
```javascript
// 300ms debounce + serialization
const savePreferences = (updatedPrefs) => {
  clearTimeout(saveTimerRef.current);
  saveTimerRef.current = setTimeout(async () => {
    if (savingRef.current) {
      pendingRef.current = updatedPrefs;
      return;
    }
    savingRef.current = true;
    try {
      await api.updatePreferences(updatedPrefs);
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        const next = pendingRef.current;
        pendingRef.current = null;
        savePreferences(next);
      }
    }
  }, 300);
};
```

---

## Common Gotchas & Prevention Strategies

### 1. RESTRICT Foreign Keys Require Soft-Delete
**Gotcha**: Trying to hard-delete a user when `purchases` table has `REFERENCES users(id) ON DELETE RESTRICT` will fail with 500 error.

**Solution**: Always use soft-delete with `deleted_at` + PII scrubbing.

**Apply to**: Any future account deletion flows.

### 2. Shallow Merge Loses Nested Keys in JSONB
**Gotcha**: Using SQL's `||` operator for JSONB merges works only at top level. Nested structures silently lose keys.

**Solution**: Perform deep merges at application layer before writing to DB.

**Apply to**: If storing seller preferences (e.g., `{ notifications: { email: true }, ... }`) in JSONB.

### 3. Token Revocation Timing Race Condition
**Gotcha**: If you set `token_revoked_at = NOW()` and immediately issue a new token, edge case where `iat` (issued-at) equals revocation time can fail.

**Solution**: Use `NOW() - INTERVAL '1 second'` when revoking.

**Apply to**: If implementing seller-specific token revocation (e.g., re-verify after terms acceptance).

### 4. OFFSET Pagination Skips Rows During Concurrent Writes
**Gotcha**: Using `OFFSET`/`LIMIT` on datasets that change over time silently skips or duplicates rows.

**Solution**: Use cursor-based pagination with composite `(timestamp, id)` cursor.

**Apply to**: If implementing paginated seller history (e.g., payout history).

### 5. Forgetting to Filter `deleted_at` Across All Queries
**Gotcha**: After implementing soft-delete, some queries return deleted users if you forget to add `AND deleted_at IS NULL`.

**Solution**: Add to all user-facing queries. Consider creating a safe wrapper or constant.

**Apply to**: All existing queries when soft-delete is introduced. Check:
- Auth queries (already done)
- Seller queries (new, need audit)
- Public queries (marketplace, ratings)

### 6. File Upload: Never Trust Client Metadata
**Gotcha**: Validating only MIME type or file extension; renamed `.exe` with `image/png` header passes client-side checks.

**Solution**: Always validate magic bytes on server side using `file-type` library.

**Apply to**: Future avatar uploads, seller deck cover images, etc.

---

## Files to Reference During Implementation

| File | Purpose |
|------|---------|
| `docs/solutions/auth-implementation-guide.md` | Complete auth patterns, Resend email setup, JWT token management |
| `docs/solutions/feature-patterns/account-settings-experience.md` | Soft-delete pattern, token revocation, two-tier auth, CSRF middleware |
| `docs/plans/2026-03-13-feat-seller-onboarding-and-marketplace-listing-plan.md` | Exact DB schema, endpoint specs, frontend flow for seller onboarding |
| `server/src/routes/auth.js` | JWT token creation, USER_SELECT shape, sanitizeUser pattern |
| `server/src/routes/seller.js` | Existing seller endpoints (onboard, create listing, relist) |
| `server/src/middleware/auth.js` | authenticate, requireActiveUser middleware |
| `server/src/constants/errors.js` | Error code constants (extend with seller codes) |
| `client/src/lib/api.js` | Fetch wrapper, API methods |
| `client/src/components/Navbar.jsx` | Avatar dropdown pattern with ARIA |

---

## Recommendations

1. **Extend error codes first** — Add `SELLER_TERMS_REQUIRED`, `SELLER_CONNECT_INCOMPLETE` to `server/src/constants/errors.js` before implementing endpoints.

2. **Reuse two-tier auth pattern** — Don't create new middleware; extend existing `authenticate` + `requireActiveUser` with an optional `requireSellerTermsAccepted` check.

3. **Make terms acceptance endpoint idempotent** — If already accepted, return 200 with existing timestamp. This prevents duplicate tracking.

4. **Guard seller routes carefully** — Terms acceptance should gate **before** Stripe Connect onboarding. Don't let users bypass terms.

5. **Test soft-delete with seller data** — When testing account deletion, verify:
   - Seller terms are cleared (`seller_terms_accepted_at = NULL`)
   - Active listings are delisted
   - Purchases remain intact
   - Stripe Connect account is disconnected

6. **Plan for email verification** — The auth guide includes `google_email_verified` but no email verification for magic link. If seller terms require verified email, add an optional `email_verified_at` column and verification flow later.

7. **Document seller role transitions** — Track state transitions (Non-Seller → Terms Accepted → Connect Complete → Active Seller → Delisted/Suspended) for debugging and analytics.

8. **Monitor CSRF attacks** — Use the `requireXHR` middleware on terms acceptance and other sensitive seller endpoints to prevent cross-site form submissions.

---

## Related Documentation in the Repository

- `docs/brainstorms/2026-03-13-seller-flow-brainstorm.md` — Original seller flow design decisions
- `docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md` — Auth design rationale
- `docs/brainstorms/2026-03-14-account-settings-experience-brainstorm.md` — Account feature trade-offs
- `CLAUDE.md` (root and apps/ai-notecards/) — Stack, conventions, environment variables
