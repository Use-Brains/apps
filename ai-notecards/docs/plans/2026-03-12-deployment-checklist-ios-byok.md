# Deployment Checklist: iOS Swift Rewrite + BYOK Feature

**Date:** 2026-03-12
**Migration:** 005_byok_and_iap.sql
**Risk Level:** HIGH — schema changes to core `users` and `purchases` tables, new constraint model, encryption dependency, external Apple webhook integration

---

## Pre-Deploy (Required)

### 1. Environment Variables

All must be set BEFORE deploying code that references them. A missing `ENCRYPTION_KEY` will crash the encryption module on first BYOK key save. A missing Apple var will crash IAP verification.

- [ ] `ENCRYPTION_KEY` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store securely. This is irrecoverable: if lost, all encrypted BYOK keys become unreadable.
- [ ] `APPLE_BUNDLE_ID` — e.g. `com.ainotecards.app`
- [ ] `APPLE_KEY_ID` — from App Store Connect API key
- [ ] `APPLE_ISSUER_ID` — from App Store Connect
- [ ] `APPLE_IAP_KEY` — path to `.p8` signing key file on the server. Verify the file exists and is readable by the Node process.
- [ ] Verify none of these are committed to source control (check `.gitignore` includes `.p8` files and `.env`)
- [ ] Verify existing env vars still present: `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`

### 2. Dependencies

- [ ] `npm install @apple/app-store-server-library` — run in `server/` directory
- [ ] Verify `package-lock.json` is committed (reproducible builds)
- [ ] Run `npm audit` — no critical vulnerabilities in new dependency
- [ ] Verify the library version is pinned (not `latest` or `*`)

### 3. Apple App Store Connect Prerequisites

These are NOT code changes but must be complete before the webhook endpoint goes live:

- [ ] Apple Developer Account active and paid ($99/year)
- [ ] Apple Small Business Program enrolled (15% commission)
- [ ] IAP products created in App Store Connect:
  - `com.ainotecards.pro.monthly` (auto-renewable, $9/mo)
  - `com.ainotecards.byokpro.monthly` (auto-renewable, $5/mo)
  - `com.ainotecards.deck.tier1` through `com.ainotecards.deck.tier5` (consumables, $1-$5)
- [ ] App Store Server Notifications V2 URL configured in App Store Connect pointing to `https://<your-domain>/webhooks/apple`
- [ ] `.p8` signing key downloaded and deployed to server

### 4. Baseline SQL Queries (Run BEFORE Migration)

Connect to production database and record these values. Any post-deploy deviation = STOP.

```sql
-- Q1: Total user count and plan distribution
SELECT plan, COUNT(*) as count FROM users GROUP BY plan ORDER BY plan;

-- Q2: Verify password_hash is currently NOT NULL for all users
SELECT COUNT(*) as users_without_password FROM users WHERE password_hash IS NULL;
-- EXPECTED: 0 (all existing users have passwords)

-- Q3: Verify current plan CHECK constraint values
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'users'::regclass AND conname = 'users_plan_check';
-- EXPECTED: CHECK ((plan = ANY (ARRAY['free'::text, 'trial'::text, 'pro'::text])))

-- Q4: Total purchase count and stripe_payment_intent_id uniqueness
SELECT COUNT(*) as total_purchases FROM purchases;
SELECT COUNT(*) as null_stripe_pi FROM purchases WHERE stripe_payment_intent_id IS NULL;
-- EXPECTED null_stripe_pi: 0 (all existing purchases have Stripe PI)

-- Q5: Marketplace listing count by status
SELECT status, COUNT(*) FROM marketplace_listings GROUP BY status;

-- Q6: Verify purchases.seller_id FK behavior (NO CASCADE — this is expected)
SELECT
  tc.constraint_name,
  rc.delete_rule,
  rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'purchases' AND tc.constraint_type = 'FOREIGN KEY';
-- NOTE: seller_id should show NO ACTION (not CASCADE) — this is by design, and is WHY we need soft-delete

-- Q7: Record total card counts per deck for marketplace listings (for card_count backfill verification)
SELECT ml.id as listing_id, ml.title, COUNT(c.id) as actual_card_count
FROM marketplace_listings ml
JOIN cards c ON c.deck_id = ml.deck_id
WHERE ml.status = 'active'
GROUP BY ml.id, ml.title
ORDER BY ml.title;
-- SAVE THIS OUTPUT — compare against card_count column after backfill
```

### 5. Database Backup

- [ ] Take a full database backup BEFORE running migration 005
- [ ] For Supabase: use `pg_dump` via direct connection string (`DATABASE_URL_DIRECT`)
- [ ] Store backup with timestamp: `notecards_backup_2026-03-12_pre_005.sql`
- [ ] Verify backup is restorable (test on a scratch database if possible)

```bash
pg_dump "$DATABASE_URL_DIRECT" > notecards_backup_2026-03-12_pre_005.sql
```

### 6. Web Frontend Regression Check

- [ ] Verify existing web app works (login, generate, study, marketplace, settings)
- [ ] The auth middleware change (Bearer token fallback) must NOT break cookie-based auth for the web frontend
- [ ] The `password_hash DROP NOT NULL` change must NOT affect existing email+password login flow

---

## Deploy Steps

### Step 1: Deploy Code (Without Running Migration)

| Item | Detail |
|------|--------|
| What | Deploy new backend code with migration file in place but not yet executed |
| Why | Verify code loads without errors before touching the database |
| Estimated time | < 2 minutes |
| Rollback | `git revert` or deploy previous commit |

- [ ] Deploy the new backend commit
- [ ] Verify server starts without crash (check logs for startup errors)
- [ ] Verify existing web frontend still works (cookie auth should be unaffected)
- [ ] Verify `/api/health` returns 200

### Step 2: Run Migration 005

| Item | Detail |
|------|--------|
| What | `npm run migrate` in server directory |
| Estimated time | < 30 seconds (ALTER TABLE + CREATE TABLE on small tables) |
| Batching | N/A — DDL operations, not data changes |
| Rollback | See Rollback Plan below |

**Migration 005 performs these operations in order:**

1. `ALTER TABLE users ADD COLUMN openrouter_api_key_encrypted TEXT` — nullable, no default, instant
2. `ALTER TABLE users ADD COLUMN preferred_model TEXT` — nullable, no default, instant
3. `ALTER TABLE users ADD COLUMN apple_original_transaction_id TEXT` — nullable, instant
4. `ALTER TABLE users ADD COLUMN apple_subscription_product_id TEXT` — nullable, instant
5. `ALTER TABLE users ADD COLUMN apple_subscription_expires_at TIMESTAMPTZ` — nullable, instant
6. `ALTER TABLE users ADD COLUMN apple_user_id TEXT UNIQUE` — adds unique index (brief lock on users table)
7. `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL` -- **DESTRUCTIVE: removes NOT NULL constraint**
8. `ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ` — nullable, instant
9. `ALTER TABLE users ADD COLUMN refresh_token_hash TEXT` — nullable, instant
10. `ALTER TABLE users DROP CONSTRAINT users_plan_check` — drops existing check
11. `ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'trial', 'pro', 'byok_pro'))` — adds new check with `byok_pro`
12. `ALTER TABLE purchases ADD COLUMN apple_iap_transaction_id TEXT` — nullable, instant
13. `ALTER TABLE purchases ALTER COLUMN stripe_payment_intent_id DROP NOT NULL` — **DESTRUCTIVE: removes NOT NULL constraint**
14. `ALTER TABLE purchases ADD CONSTRAINT purchases_payment_source_check CHECK (...)` — new check constraint
15. `ALTER TABLE purchases ADD CONSTRAINT purchases_apple_unique UNIQUE (apple_iap_transaction_id)` — unique index
16. `ALTER TABLE purchases ADD COLUMN seller_payout_eligible_at TIMESTAMPTZ` — nullable, instant
17. `ALTER TABLE purchases ADD COLUMN seller_payout_status TEXT DEFAULT 'pending' CHECK (...)` — with default
18. `ALTER TABLE marketplace_listings ADD COLUMN card_count INTEGER DEFAULT 0` — with default
19. `CREATE TABLE pending_iap_purchases (...)` — new table

**Risk assessment per operation:**

| # | Operation | Lock level | Risk |
|---|-----------|-----------|------|
| 6 | UNIQUE on apple_user_id | ACCESS EXCLUSIVE (brief) | LOW — column is empty, index builds fast |
| 7 | DROP NOT NULL on password_hash | Brief lock | MEDIUM — existing app code must handle NULL passwords |
| 10-11 | DROP/ADD CHECK constraint | Brief lock | MEDIUM — window where no plan validation exists |
| 13 | DROP NOT NULL on stripe_payment_intent_id | Brief lock | MEDIUM — existing code must not assume NOT NULL |
| 14 | ADD CHECK constraint on purchases | Brief lock | LOW — validates existing data (all have stripe_pi set) |
| 17 | ADD COLUMN with DEFAULT | Table rewrite on PG < 11, instant on PG 11+ | Check PG version |

- [ ] Verify PostgreSQL version is 11+ (for instant ADD COLUMN WITH DEFAULT): `SELECT version();`
- [ ] Run migration: `cd server && npm run migrate`
- [ ] Verify migration completed: check for `Applied migration: 005_byok_and_iap.sql` in logs

### Step 3: Backfill card_count on marketplace_listings

This is a separate step because the migration SQL has it commented out.

```sql
-- Run this AFTER migration 005 completes
UPDATE marketplace_listings ml
SET card_count = (
  SELECT COUNT(*)
  FROM cards c
  JOIN decks d ON d.id = c.deck_id
  WHERE d.id = ml.deck_id
);
```

| Item | Detail |
|------|--------|
| Estimated time | < 5 seconds (small table) |
| Batching | Not needed unless > 10K listings |
| Verification | Compare with Q7 baseline saved above |

- [ ] Run backfill query
- [ ] Verify card_count matches baseline from Q7

### Step 4: Backfill seller_payout_status on Existing Purchases

Existing purchases were paid out immediately via Stripe Connect destination charges. They should be marked as `paid`, not `pending`.

```sql
-- Mark all existing purchases as already paid (they were immediate Stripe transfers)
UPDATE purchases
SET seller_payout_status = 'paid',
    seller_payout_eligible_at = created_at
WHERE seller_payout_status = 'pending'
  AND stripe_payment_intent_id IS NOT NULL;
```

- [ ] Run backfill query
- [ ] Verify: `SELECT seller_payout_status, COUNT(*) FROM purchases GROUP BY seller_payout_status;`
- [ ] EXPECTED: all existing purchases show `paid`, zero show `pending`

### Step 5: Verify Apple Webhook Endpoint

- [ ] Verify `POST /webhooks/apple` returns 200 when called (even with invalid payload it should not crash the server — it should return 400 or similar)
- [ ] Register the URL in App Store Connect Server Notifications V2 configuration
- [ ] Use Apple's sandbox to send a test notification if possible

### Step 6: Restart Server

- [ ] Restart the backend process to pick up new env vars and code
- [ ] Verify no startup errors in logs
- [ ] Verify `/api/health` returns 200

---

## Post-Deploy Verification (Within 5 Minutes)

### SQL Verification Queries

```sql
-- V1: Verify new columns exist on users table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'openrouter_api_key_encrypted', 'preferred_model',
    'apple_original_transaction_id', 'apple_subscription_product_id',
    'apple_subscription_expires_at', 'apple_user_id',
    'deleted_at', 'refresh_token_hash'
  )
ORDER BY column_name;
-- EXPECTED: 8 rows, all nullable

-- V2: Verify password_hash is now nullable
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'password_hash';
-- EXPECTED: is_nullable = 'YES'

-- V3: Verify plan CHECK constraint includes byok_pro
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'users'::regclass AND conname = 'users_plan_check';
-- EXPECTED: CHECK ((plan = ANY (ARRAY['free'::text, 'trial'::text, 'pro'::text, 'byok_pro'::text])))

-- V4: Verify new purchases columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'purchases'
  AND column_name IN (
    'apple_iap_transaction_id', 'seller_payout_eligible_at', 'seller_payout_status'
  )
ORDER BY column_name;
-- EXPECTED: 3 rows

-- V5: Verify stripe_payment_intent_id is now nullable
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'purchases' AND column_name = 'stripe_payment_intent_id';
-- EXPECTED: is_nullable = 'YES'

-- V6: Verify payment source CHECK constraint exists
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'purchases'::regclass AND conname = 'purchases_payment_source_check';
-- EXPECTED: one of stripe_payment_intent_id or apple_iap_transaction_id must be NOT NULL

-- V7: Verify pending_iap_purchases table created
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'pending_iap_purchases'
ORDER BY ordinal_position;
-- EXPECTED: id, user_id, listing_id, product_id, created_at, completed_at

-- V8: Verify card_count column and backfill on marketplace_listings
SELECT id, title, card_count
FROM marketplace_listings
WHERE status = 'active'
ORDER BY title;
-- COMPARE with Q7 baseline — card_count must match actual card count for every listing

-- V9: Verify apple_user_id UNIQUE constraint
SELECT conname FROM pg_constraint
WHERE conrelid = 'users'::regclass AND contype = 'u'
  AND conname LIKE '%apple_user%';
-- EXPECTED: one unique constraint

-- V10: Verify no data corruption — plan distribution unchanged
SELECT plan, COUNT(*) FROM users GROUP BY plan ORDER BY plan;
-- COMPARE with Q1 baseline — must be identical

-- V11: Verify no existing purchases were broken by schema change
SELECT COUNT(*) FROM purchases WHERE stripe_payment_intent_id IS NULL AND apple_iap_transaction_id IS NULL;
-- EXPECTED: 0 (payment source check constraint would have blocked migration if any existed)

-- V12: Verify seller_payout_status backfill
SELECT seller_payout_status, COUNT(*) FROM purchases GROUP BY seller_payout_status;
-- EXPECTED: all existing = 'paid', zero = 'pending'

-- V13: Verify migration recorded
SELECT * FROM schema_migrations ORDER BY version;
-- EXPECTED: versions 1-5, version 5 with filename '005_byok_and_iap.sql'
```

### API Endpoint Verification

```bash
# E1: Existing web auth still works (cookie-based)
curl -s -X POST https://<domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"password123"}' \
  -c cookies.txt
# EXPECTED: 200 with user object, Set-Cookie header present

# E2: /api/auth/me still works with cookies
curl -s https://<domain>/api/auth/me -b cookies.txt
# EXPECTED: 200 with user object (not null)

# E3: Bearer token auth works (new functionality)
TOKEN=$(curl -s -X POST https://<domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"password123"}' | jq -r '.token // empty')
# NOTE: token will only be in response body if auth.js changes are deployed

# E4: Health check
curl -s https://<domain>/api/health
# EXPECTED: 200

# E5: Marketplace still works
curl -s https://<domain>/api/marketplace | jq '.listings | length'
# EXPECTED: same number as before deploy

# E6: Apple webhook endpoint exists (should reject invalid payloads, not 404)
curl -s -X POST https://<domain>/webhooks/apple \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
# EXPECTED: 400 or similar error (NOT 404, NOT 500)
```

### Encryption Module Verification

```bash
# Run from server directory — quick smoke test
node -e "
  const { encrypt, decrypt } = await import('./src/services/encryption.js');
  const testUserId = 'test-user-123';
  const testKey = 'sk-or-v1-test-key-12345';
  const encrypted = encrypt(testKey, testUserId);
  console.log('Encrypted format:', encrypted.substring(0, 3));
  const decrypted = decrypt(encrypted, testUserId);
  console.log('Round-trip OK:', decrypted === testKey);
  try {
    decrypt(encrypted, 'wrong-user-id');
    console.log('AAD check: FAILED (should have thrown)');
  } catch (e) {
    console.log('AAD check: PASSED (rejected wrong user)');
  }
"
# EXPECTED: "v1:" prefix, round-trip OK: true, AAD check: PASSED
```

---

## Rollback Plan

### Can we roll back?

**Partial — code is revertable, schema changes require manual reversal.**

The migration is a mix of additive (new columns, new table) and destructive (DROP NOT NULL, DROP/re-ADD CHECK constraints) changes. The additive parts are safe to leave in place. The destructive parts need careful handling.

### Rollback by Component

#### A. Code Rollback (Safe, Instant)

- [ ] Deploy previous git commit
- [ ] Restart server
- [ ] Verify `/api/health` returns 200
- [ ] Verify web frontend works

**Risk:** Old code does not know about `byok_pro` plan. If any user was upgraded to `byok_pro` before rollback, they will have an unrecognized plan. Fix with:
```sql
UPDATE users SET plan = 'pro' WHERE plan = 'byok_pro';
```

#### B. Schema Rollback (Manual SQL — Run Only If Needed)

Only run these if the migration caused problems. If the migration succeeded and the issue is in application code, prefer a code-only rollback (Section A) and leave the schema in place.

```sql
-- B1: Restore password_hash NOT NULL (ONLY if no Apple-auth users were created)
-- DANGER: This will fail if any user has NULL password_hash
SELECT COUNT(*) FROM users WHERE password_hash IS NULL;
-- If 0:
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
-- If > 0: DO NOT run this. Those users must be handled first.

-- B2: Restore stripe_payment_intent_id NOT NULL (ONLY if no Apple IAP purchases exist)
SELECT COUNT(*) FROM purchases WHERE stripe_payment_intent_id IS NULL;
-- If 0:
ALTER TABLE purchases ALTER COLUMN stripe_payment_intent_id SET NOT NULL;
-- If > 0: DO NOT run this. Those purchases must be handled first.

-- B3: Revert plan CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE users ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'trial', 'pro'));
-- DANGER: Will fail if any user has plan = 'byok_pro'. Fix first:
-- UPDATE users SET plan = 'pro' WHERE plan = 'byok_pro';

-- B4: Drop new columns (safe — they are all nullable and unused by old code)
ALTER TABLE users DROP COLUMN IF EXISTS openrouter_api_key_encrypted;
ALTER TABLE users DROP COLUMN IF EXISTS preferred_model;
ALTER TABLE users DROP COLUMN IF EXISTS apple_original_transaction_id;
ALTER TABLE users DROP COLUMN IF EXISTS apple_subscription_product_id;
ALTER TABLE users DROP COLUMN IF EXISTS apple_subscription_expires_at;
ALTER TABLE users DROP COLUMN IF EXISTS apple_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE users DROP COLUMN IF EXISTS refresh_token_hash;

-- B5: Drop new purchases columns
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_payment_source_check;
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_apple_unique;
ALTER TABLE purchases DROP COLUMN IF EXISTS apple_iap_transaction_id;
ALTER TABLE purchases DROP COLUMN IF EXISTS seller_payout_eligible_at;
ALTER TABLE purchases DROP COLUMN IF EXISTS seller_payout_status;

-- B6: Drop card_count from marketplace_listings
ALTER TABLE marketplace_listings DROP COLUMN IF EXISTS card_count;

-- B7: Drop new table
DROP TABLE IF EXISTS pending_iap_purchases;

-- B8: Remove migration record so it can be re-run
DELETE FROM schema_migrations WHERE version = 5;
```

#### C. Environment Variable Rollback

New env vars (`ENCRYPTION_KEY`, `APPLE_*`) can remain set — old code ignores them. No action needed.

#### D. npm Dependency Rollback

If reverting `package.json`:
```bash
cd server && npm install  # reinstalls from reverted package-lock.json
```

#### E. ENCRYPTION_KEY Loss Recovery

**If `ENCRYPTION_KEY` is lost, ALL encrypted BYOK API keys are irrecoverable.** Users would need to re-enter their OpenRouter keys. Mitigation:
- [ ] Store `ENCRYPTION_KEY` in a secure secrets manager (not just `.env`)
- [ ] Document the key in a secure location accessible to the team
- [ ] Consider key escrow for disaster recovery

---

## Feature Flag Strategy

This deployment does not use feature flags in the traditional sense, but the features are **naturally gated** by the deployment sequence:

| Feature | Gate Mechanism | Activation |
|---------|---------------|------------|
| Bearer token auth | Code change in `auth.js` | Active immediately on deploy (backward compatible) |
| Refresh tokens | New endpoints + iOS client | Dormant until iOS app ships |
| Sign in with Apple | New endpoint + iOS client | Dormant until iOS app ships |
| BYOK key storage | New endpoint + encryption module | Dormant until iOS app ships |
| Apple IAP verification | New endpoint + StoreKit | Dormant until iOS app ships |
| Apple webhooks | Endpoint exists, but Apple only calls it when configured | Dormant until App Store Connect configuration |
| `byok_pro` plan | CHECK constraint allows it, but no code path creates it yet | Dormant until IAP verification creates it |
| Seller payout hold | Only applies to Apple IAP purchases | Dormant until first Apple purchase |
| Soft-delete | Only triggered by `DELETE /api/auth/account` | Dormant until iOS app ships |

**Recommendation:** If you want explicit feature flags for safety, add these to your existing admin flags system:

```sql
-- Optional: add feature flags to control rollout
-- (Only if the admin flags table supports key-value flags)
INSERT INTO admin_flags (key, enabled) VALUES
  ('apple_iap_enabled', false),
  ('byok_enabled', false),
  ('apple_auth_enabled', false);
```

Then check these flags in the new route handlers before processing. This gives you a kill switch for each feature independent of code deployment.

---

## Monitoring Plan (First 24 Hours)

### Immediate (First 5 Minutes)

| Check | How | Alert Condition |
|-------|-----|-----------------|
| Server running | `/api/health` | Non-200 response |
| No crash loops | Process manager / logs | Restart count > 0 |
| Web login works | Manual test | Cookie auth failure |
| Migration applied | `SELECT * FROM schema_migrations WHERE version = 5` | Row missing |

### First Hour

| Check | How | Alert Condition |
|-------|-----|-----------------|
| Error rate in server logs | `grep -c "Error\|error\|ERR" server.log` | Spike above baseline |
| Database connection pool | Check active/idle connections | Pool exhaustion |
| Existing Stripe webhooks | Check Stripe dashboard for failed deliveries | Any 500 responses |
| Auth middleware | Monitor 401 responses | Spike (would indicate cookie parsing broken) |

### First 24 Hours

| Check | How | Alert Condition |
|-------|-----|-----------------|
| Users can still sign up | Test signup flow | Failure |
| Users can still generate | Test generation flow | Failure |
| Users can still purchase from marketplace | Test purchase flow | Stripe webhook failures |
| `password_hash` integrity | `SELECT COUNT(*) FROM users WHERE password_hash IS NULL AND apple_user_id IS NULL` | Any rows (would mean a user lost their password without Apple auth) |
| Plan distribution | `SELECT plan, COUNT(*) FROM users GROUP BY plan` | Unexpected changes |
| Purchase integrity | `SELECT COUNT(*) FROM purchases WHERE stripe_payment_intent_id IS NULL AND apple_iap_transaction_id IS NULL` | Any rows (constraint violation somehow bypassed) |
| Apple webhook endpoint | Monitor for unexpected 500s on `/webhooks/apple` | Any 500 response |

### Ongoing (After iOS App Launch)

| Metric | How | Alert Condition |
|--------|-----|-----------------|
| Apple IAP verification failures | Log `iap_verify_failed` events | > 5% failure rate |
| BYOK encryption errors | Log `encryption_error` events | Any occurrence |
| Refresh token failures | Log `refresh_token_failed` events | > 10% of auth requests |
| Orphaned pending_iap_purchases | `SELECT COUNT(*) FROM pending_iap_purchases WHERE completed_at IS NULL AND created_at < NOW() - INTERVAL '1 hour'` | Count increasing over time |
| Seller payout processing | `SELECT COUNT(*) FROM purchases WHERE seller_payout_status = 'pending' AND seller_payout_eligible_at <= NOW()` | Count not decreasing (cron not running) |
| Sign in with Apple failures | Log `apple_auth_failed` events | Any occurrence in first week |
| NULL password_hash audit | `SELECT COUNT(*) FROM users WHERE password_hash IS NULL AND apple_user_id IS NULL` | Any rows = data integrity issue |

### Key Log Patterns to Watch

```
# Errors that indicate migration issues
"relation.*does not exist"           # Table/column not created
"violates check constraint"          # Plan or payout_status value rejected
"null value in column.*password_hash" # Old code path still enforces NOT NULL

# Errors that indicate auth issues
"Authentication required"             # Spike = middleware broken
"Invalid or expired token"            # Spike = JWT or refresh flow broken

# Errors that indicate encryption issues
"Unsupported encryption version"      # Key format wrong
"AAD mismatch"                        # Wrong user ID used for decryption
"ENCRYPTION_KEY"                      # Missing env var

# Errors that indicate Apple integration issues
"SignedDataVerifier"                   # Apple library initialization failed
"appAccountToken mismatch"            # Security check working correctly (not an error to fix)
```

---

## Data Invariants (Must Remain True At All Times)

These invariants must hold before, during, and after deployment. Any violation is a stop-the-deploy signal.

- [ ] Every existing user has a non-NULL `password_hash` (until Apple-auth users are created)
- [ ] Every existing purchase has a non-NULL `stripe_payment_intent_id` (until Apple IAP purchases exist)
- [ ] Every purchase has at least one payment source (`stripe_payment_intent_id IS NOT NULL OR apple_iap_transaction_id IS NOT NULL`)
- [ ] User plan values are within the CHECK constraint set (`free`, `trial`, `pro`, `byok_pro`)
- [ ] `seller_payout_status` values are within the CHECK constraint set (`pending`, `eligible`, `paid`, `refunded`)
- [ ] No user has `plan = 'byok_pro'` without a corresponding Apple IAP record or manual admin action
- [ ] No user has `apple_user_id` set AND `password_hash` set to NULL unless they authenticated via Apple
- [ ] The `ENCRYPTION_KEY` env var can decrypt any value in `users.openrouter_api_key_encrypted`
- [ ] `card_count` on `marketplace_listings` matches actual card count in related deck
- [ ] `purchases.seller_id` FK integrity — no orphaned references (soft-delete preserves user rows)
- [ ] Web frontend continues to function identically (cookie auth, existing flows)

---

## Estimated Total Deploy Time

| Phase | Duration |
|-------|----------|
| Pre-deploy checks + backup | 15-20 minutes |
| Code deploy | 2 minutes |
| Migration 005 | < 30 seconds |
| Backfill queries | < 1 minute |
| Post-deploy verification | 10-15 minutes |
| **Total** | **~30-40 minutes** |
