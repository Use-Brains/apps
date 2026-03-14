---
title: "Account & Settings Experience: Avatar, Security, Preferences, Data Privacy"
date: 2026-03-14
category: feature-patterns
tags:
  - account-management
  - settings
  - avatar-upload
  - password-change
  - soft-delete
  - preferences
  - study-history
  - data-export
  - notification-preferences
  - navbar
  - supabase-storage
  - csrf
  - cursor-pagination
  - accessibility
  - react
  - express
  - postgresql
severity: medium
components:
  - database/migrations
  - server/middleware
  - server/routes/account
  - server/routes/preferences
  - server/services/supabase-storage
  - client/components/Navbar
  - client/pages/Settings
  - client/pages/Profile
symptoms:
  - No user avatar support
  - No profile or account management page
  - No password change flow
  - No notification or display preferences
  - No study history view
  - No data export capability
  - No account deletion option
  - Flat navbar with no user menu
  - Settings page limited to display name and subscription only
root_cause: "The app lacked the full account lifecycle expected of a consumer SaaS product with paid subscriptions; the existing Settings surface was minimal, and the database schema had no columns for avatars, preferences, or soft-delete state."
resolution_type: feature_implementation
---

# Account & Settings Experience

A four-phase feature implementation that added full account management to ai-notecards: a database migration introduced avatar, preferences (JSONB), and soft-delete columns plus a composite study-history index; the backend gained shared CSRF middleware, a requireActiveUser guard, Supabase Storage integration with magic-byte file validation, cursor-paginated study history, deck export, password change with token revocation, and soft-delete account deletion (necessitated by RESTRICT foreign keys on the purchases table). On the frontend, the Navbar was upgraded to an accessible avatar dropdown with ARIA menu semantics and keyboard support, and the Settings page was restructured into Security, Preferences (with debounced auto-save and deep-merge), Notifications, and Data & Privacy sections including a confirmation-gated account deletion modal.

---

## Problem

The app had a flat Navbar with inline links, a basic Settings page that only handled display name and subscription, no avatar, no profile page, no study history view, no password management, no notification preferences, no data export, and no account deletion. There was no token revocation mechanism, no CSRF protection on state-changing endpoints, and no soft-delete infrastructure. This was below MVP expectations for a consumer app with paid subscriptions.

## Solution Architecture

The feature was implemented across three layers in four coordinated phases:

**Database layer** -- Migration `008_account_settings.sql` adds five columns to `users` (`avatar_url`, `google_avatar_url`, `preferences JSONB`, `deleted_at`, `token_revoked_at`), a composite index for cursor pagination on `study_sessions`, and a size constraint on the preferences JSONB column.

**Backend layer** -- Six areas of change:
1. New route file `routes/account.js` for avatar upload/delete, password change, and account deletion
2. Extended `routes/settings.js` with preferences deep-merge endpoint and data export
3. Extended `routes/study.js` with cursor-paginated history and per-deck stats
4. New middleware `middleware/csrf.js` (custom header check) and extended `middleware/auth.js` (token revocation + soft-delete guard)
5. New service `services/storage.js` for Supabase Storage avatar operations
6. Updated `routes/auth.js` with `USER_SELECT` expansion, `sanitizeUser` avatar URL resolution, and `deleted_at` filtering on all auth queries

**Frontend layer** -- Three areas of change:
1. `Navbar.jsx` replaced the logout button with an `AvatarDropdown` component showing avatar image, user info, plan badge, and links to Profile/Settings/Seller Dashboard
2. New `Profile.jsx` page with avatar upload, display name editing, study stats grid, cursor-paginated session history, and per-deck stats
3. Expanded `Settings.jsx` with Security, Study Preferences, Notifications, Subscription, Seller, and Data & Privacy sections

---

## Key Implementation Patterns

### 1. Soft-Delete with PII Scrubbing

Account deletion uses soft-delete (sets `deleted_at`) because the `purchases` table has a `RESTRICT` foreign key to `users`. All PII is atomically scrubbed in a single transaction:

```sql
UPDATE users SET
  deleted_at = NOW(),
  email = 'deleted-' || id,
  display_name = NULL,
  avatar_url = NULL,
  google_avatar_url = NULL,
  password_hash = NULL,
  preferences = '{}',
  token_revoked_at = NOW(),
  google_user_id = NULL,
  stripe_customer_id = NULL,
  stripe_connect_account_id = NULL,
  connect_charges_enabled = false,
  connect_payouts_enabled = false,
  seller_terms_accepted_at = NULL
WHERE id = $1
```

The email is replaced with `'deleted-' || id` (not NULL) to preserve the unique constraint while making the row non-loginable. Stripe subscriptions are cancelled best-effort before the transaction. All auth queries filter `deleted_at IS NULL`.

### 2. Magic-Byte Avatar Validation

The upload endpoint validates file content at two layers. Multer's `fileFilter` checks the declared MIME type, but the real protection is `file-type`'s magic-byte detection on the raw buffer:

```js
const detected = await fileTypeFromBuffer(req.file.buffer);
if (!detected || !['image/jpeg', 'image/png'].includes(detected.mime)) {
  return res.status(422).json({ error: 'Invalid image file' });
}
```

This prevents a renamed `.exe` or polyglot file from being stored, regardless of the `Content-Type` header. The detected MIME (not the declared one) determines the storage path extension.

### 3. Token Revocation with requireActiveUser

Password changes set `token_revoked_at = NOW() - INTERVAL '1 second'` and immediately re-issue a fresh JWT for the current session. The `requireActiveUser` middleware compares the token's `iat` against `token_revoked_at`:

```js
if (rows[0].token_revoked_at && new Date(rows[0].token_revoked_at) > new Date(req.tokenIat * 1000)) {
  return res.status(401).json({ error: 'Session expired' });
}
```

The 1-second offset ensures the newly issued token (whose `iat` is "now") is strictly after the revocation timestamp. All other sessions holding older tokens are invalidated. The `authenticate` middleware remains stateless (no DB query) -- `requireActiveUser` is only applied to sensitive routes.

### 4. Cursor Pagination with Composite Key

Study history uses a `(completed_at, id)` composite cursor to avoid the offset-skip problem and handle timestamp ties:

```sql
WHERE ss.user_id = $1
  AND ss.completed_at IS NOT NULL
  AND ($2::timestamptz IS NULL OR (ss.completed_at, ss.id) < ($2::timestamptz, $3::uuid))
ORDER BY ss.completed_at DESC, ss.id DESC
LIMIT $4
```

The `$2::timestamptz IS NULL` clause makes the first page work without a cursor. The matching composite index covers `(user_id, completed_at DESC, id DESC) WHERE completed_at IS NOT NULL`. The API fetches `limit + 1` rows and uses the extra row to determine `hasMore`.

### 5. Preferences Deep-Merge with Allowlist Validation

Preferences are stored as a single JSONB column with a 1KB size constraint. The `validatePreferences` function acts as a strict allowlist:

```js
if ('card_order' in input) {
  if (!['shuffle', 'sequential'].includes(input.card_order)) return null;
  clean.card_order = input.card_order;
}
```

The validated partial is deep-merged with existing preferences (read-merge-write) so clients can send only changed keys. SQL's `||` operator does shallow merge and would silently drop nested `notifications` keys -- application-level deep merge is required.

### 6. Debounce + Serialize Auto-Save (Frontend)

Rapid toggle changes are handled with a 300ms debounce and serialization queue:

```js
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

The debounce collapses rapid changes. If a save is in-flight when a new change arrives, `pendingRef` queues it and replays after completion. This prevents concurrent PATCH requests that could cause lost updates.

### 7. Avatar URL Resolution in sanitizeUser

The database stores only the relative storage path (`avatars/uuid.png`). The `sanitizeUser` function resolves it to a full URL with cache-busting at response time:

```js
if (user.avatar_url && STORAGE_BASE) {
  const cacheBust = user.updated_at ? `?v=${new Date(user.updated_at).getTime()}` : '';
  resolvedAvatar = `${STORAGE_BASE}/${user.avatar_url}${cacheBust}`;
} else if (user.google_avatar_url) {
  resolvedAvatar = user.google_avatar_url;
}
```

This keeps paths portable across environments and allows CDN changes without data migration.

---

## Files Changed

| File | What changed |
|------|-------------|
| `server/src/db/migrations/008_account_settings.sql` | New: avatar, preferences, soft-delete columns + pagination index + JSONB size constraint |
| `server/src/middleware/csrf.js` | New: `requireXHR` middleware extracted from generate.js |
| `server/src/middleware/auth.js` | Added `requireActiveUser` middleware; `authenticate` now exposes `req.tokenIat` |
| `server/src/services/storage.js` | New: `uploadAvatar` and `deleteAvatar` via Supabase Storage REST API |
| `server/src/routes/account.js` | New: avatar upload/delete, password change (with token revocation), account deletion (soft-delete with PII scrub) |
| `server/src/routes/settings.js` | Added preferences update (allowlist + deep-merge) and JSON deck export |
| `server/src/routes/study.js` | Added cursor-paginated history and per-deck stats endpoints |
| `server/src/routes/auth.js` | Expanded USER_SELECT, updated sanitizeUser with avatar resolution, added soft-delete filters |
| `server/src/routes/auth-google.js` | Added Google avatar capture, soft-delete filters |
| `server/src/routes/generate.js` | Imports requireXHR from shared middleware |
| `server/src/index.js` | Mounted account routes at `/api/account` |
| `client/src/components/Navbar.jsx` | Replaced flat links with AvatarDropdown (mousedown click-outside, ARIA menu, Escape key) |
| `client/src/pages/Profile.jsx` | New: avatar upload, inline name edit, stats grid, paginated history, deck stats |
| `client/src/pages/Settings.jsx` | Restructured: Security, Preferences (debounced auto-save), Notifications, Data & Privacy |
| `client/src/lib/api.js` | Added all new API methods for account, study, preferences, export |
| `client/src/App.jsx` | Added `/profile` route |

---

## Prevention Strategies

### Best Practices

- **Always use soft-delete when foreign keys exist.** Hard DELETE fails against RESTRICT constraints. Default to `deleted_at` + PII scrubbing.
- **Never trust client-supplied metadata for file uploads.** Always validate magic bytes server-side via `fileTypeFromBuffer`.
- **Keep authentication stateless; gate on active status only where it matters.** Separate `authenticate` (JWT only) from `requireActiveUser` (DB check).
- **Use cursor-based pagination instead of OFFSET** for any dataset that changes over time. Composite `(timestamp, id)` cursors handle ties.
- **Validate user-supplied JSON against a strict allowlist** before writing to JSONB columns. Reject unknown keys outright.
- **Perform deep merges in application code, not SQL.** The Postgres `||` operator does shallow merge, silently dropping nested keys.
- **Add a time buffer when revoking tokens that will be immediately reissued.** `NOW() - INTERVAL '1 second'` prevents the race where `iat` equals revocation time.
- **Store asset references as relative paths, not full URLs.** Resolve at response time with cache-busting `?v=` param.
- **Use direct REST calls to external storage** when the surface area is small (upload/delete/read). Avoid heavy SDK dependencies.
- **Debounce rapid user actions and serialize network calls.** 300ms debounce + serialization queue prevents lost updates from concurrent requests.

### Common Pitfalls

- Assuming RESTRICT foreign keys will work with DELETE (they won't -- 500 error)
- Relying on file extension or Content-Type header for security (trivially spoofed)
- Using OFFSET pagination for lists with concurrent writes (silent row skipping/duplication)
- Shallow-merging nested JSONB in Postgres (nested keys silently lost)
- Forgetting the token revocation timing edge case (intermittent auth failures)
- Hardcoding CDN/storage URLs in the database (painful migration later)

---

## Reusable Patterns

These patterns should be extracted and reused across the codebase:

1. **Soft-Delete with PII Scrubbing** -- Apply to any user-facing entity with inbound foreign keys
2. **Magic-Byte File Validation** -- Parameterize allowed types and max size for any upload endpoint
3. **Two-Tier Auth (authenticate + requireActiveUser)** -- Scales to any new service
4. **Composite Cursor Pagination** -- Generalize `(timestamp, id)` cursor into a shared utility
5. **Preferences Allowlist Validator** -- Generic `validateAgainstSchema(payload, schema)` for any JSONB column
6. **Application-Level Deep Merge for JSONB** -- Wrap read-merge-write in a transactional helper
7. **Relative-Path Asset Resolution** -- Standardize `resolveAssetUrl(path, updatedAt)` utility
8. **Debounce + Serialize Auto-Save** -- Package into a reusable React hook

---

## Related Documentation

### Feature-Specific
- `docs/brainstorms/2026-03-14-account-settings-experience-brainstorm.md` -- Brainstorm covering avatar dropdown design, Profile vs Settings split, study stats, soft-delete
- `docs/plans/2026-03-14-feat-account-settings-experience-plan.md` -- Implementation plan with 7 key improvements from 11 research agents
- `docs/solutions/auth-implementation-guide.md` -- Auth infrastructure reference (JWT, token_revoked_at design, auth route patterns)

### Related Features
- `docs/brainstorms/2026-03-13-auth-revamp-brainstorm.md` -- Google + Magic Link auth (avatar auto-pull, google_connected)
- `docs/brainstorms/2026-03-13-seller-flow-brainstorm.md` -- Seller onboarding (Settings integration, account deletion handling)
- `docs/brainstorms/2026-03-13-photo-upload-ai-vision-brainstorm.md` -- File upload pattern (magic-byte validation reference at generate.js)
- `docs/brainstorms/2026-03-13-deck-rating-and-results-screen-brainstorm.md` -- Study stats and deck_stats table
- `docs/brainstorms/2026-03-12-marketplace-and-production-brainstorm.md` -- Purchases FK constraints that forced soft-delete, Supabase Storage

### Review Findings
All 18 findings in `todos/` (6 P1, 10 P2, 2 P3) were addressed during implementation, including: token_revoked_at missing from migration, PII scrub incomplete, JSONB shallow merge, N+1 export query, cursor pagination composite key, avatar cache-busting, and token revocation race condition.
