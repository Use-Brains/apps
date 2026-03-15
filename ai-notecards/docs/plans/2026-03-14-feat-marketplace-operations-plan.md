---
title: "feat: Marketplace Operations"
type: feat
date: 2026-03-14
---

# Marketplace Operations

## Enhancement Summary

**Deepened on:** 2026-03-14
**Research agents used:** 14 (5 best-practices researchers, security sentinel, performance oracle, architecture strategist, data integrity guardian, frontend races reviewer, code simplicity reviewer, pattern recognition specialist, framework docs researcher, learnings researcher)

### Key Improvements
1. **Security hardening** — CSRF protection (`requireXHR`) missing on 14 state-changing endpoints; `requireActiveUser` updated to check `suspended` column (not just `deleted_at`/`token_revoked_at`); admin self-targeting guard; XSS escape with `he.encode()` in HTML email bodies only (not subjects); `GET /marketplace/:id` must filter on `status = 'active'`
2. **Error response format fix** — fix `api.js:17` to prefer `data.message || data.error`; keep `error` field human-readable in 429 responses (no `error_code` — YAGNI, no frontend consumer)
3. **Migration safety** — split migrations: `010_billing_portal.sql` (cancel columns), `011_content_moderation.sql` (moderation columns + NOT VALID constraints, `moderation_requested_at DEFAULT NULL`), `012_validate_moderation_constraints.sql` (VALIDATE only). Deploy migrations before code.
4. **Data integrity** — `subscription.deleted` wraps user downgrade + listing delist in transaction; `checkout.session.completed` clears cancel fields; listing count + duplicate title checks include `pending_review` status; moderation callback WHERE prevents flipping removed listings
5. **Frontend race conditions** — `refreshUser()` deduplication via `useRef` promise; all return flows (portal, Dashboard `?upgraded=true`, SellerDashboard `?connect=return`) gated on `loading`, URL cleaned first, `.catch()` added; `visibilitychange` refetch 5s throttle; clipboard `try/catch`
6. **Architecture fix** — OG crawler detection incompatible with split Vercel+Railway deployment; static OG tags for v1; `maybeAutoApprove()` fire-and-forget (not awaited); `fulfillPurchase` signature + return type fixed
7. **Pattern fixes** — extract `getStripe()` to shared singleton (4 call sites: stripe.js, seller.js, purchase.js, account.js/index.js); extract `SharePopover` to shared component; webhook `return` prevents double `res.json()`; `Promise.allSettled` for independent email sends; email preference check removed (YAGNI)
8. **Simplification** — manual moderation may be sufficient for v1; static OG tags recommended; email templates in single file; no countdown timer needed for v1

### Simplification Decision Points

Before implementing, decide on these trade-offs (marked with **[DECIDE]** in each phase):

| Decision | Simple (ship faster) | Full (more robust) |
|----------|---------------------|-------------------|
| Content moderation | Manual admin review | AI pre-screening via OpenRouter |
| OG tags | Static in index.html | Server-side crawler detection |
| Email templates | Add to existing `email.js` | New `emails/` directory |
| Rate limit frontend | Better toast messages | Countdown timer + generation counter |

---

## Overview

Five operational features that make the two-sided marketplace function as a real business: transactional emails, automated content moderation, listing share buttons with Open Graph tags, Stripe billing portal, and polished rate limit UX. The marketplace mechanics (payments, fulfillment, ratings) work, but the operational layer is missing.

**Brainstorm:** `docs/brainstorms/2026-03-14-marketplace-operations-brainstorm.md`

## Problem Statement

Sellers don't know when they make a sale. Buyers can't share what they bought. Offensive content goes live before anyone reviews it. Pro subscribers can't update their payment method. Users who hit rate limits see cryptic error messages. These are the gaps that would frustrate real users within their first week.

## Pre-Implementation Blockers

### 1. Revenue Split Discrepancy

> **CRITICAL:** The brainstorm specifies a 70/30 split (seller/platform), but `server/src/services/purchase.js` calculates `Math.round(listing.price_cents * 0.5)` — a 50/50 split — in **two places**: line 69 (`createPurchaseCheckout` → Stripe `application_fee_amount`) and line 139 (`fulfillPurchase` → `platform_fee_cents` stored in `purchases` table). If you fix one and not the other, Stripe collects one fee while the database records a different one, and `SellerDashboard` earnings (`seller.js:271` computes `SUM(price_cents - platform_fee_cents)`) will be wrong.
>
> **Fix:** Extract the fee rate to a shared constant in `purchase.js` and use it in both locations:
> ```javascript
> const PLATFORM_FEE_RATE = 0.3; // 70/30 seller/platform split
> const platformFee = Math.round(priceCents * PLATFORM_FEE_RATE);
> ```
> Decide which split is correct, update both sites, and verify against any existing Stripe transactions. This must be resolved before Phase 4 emails, which surface the earnings number to sellers.

### 2. CSRF + Auth Protection Gap

> **CRITICAL:** 14 state-changing endpoints lack `requireXHR` (CSRF protection) and critical routes lack `requireActiveUser` (suspended/deleted user protection).
>
> **Missing `requireXHR` (14 endpoints):** `stripe.js` (POST `/checkout`, POST `/cancel`), `seller.js` (POST `/listings`, PATCH `/listings/:id`, DELETE `/listings/:id`, POST `/listings/:id/relist`, POST `/accept-terms`, POST `/onboard`), `marketplace.js` (POST `/:id/flag`, POST `/:id/purchase`), `ratings.js` (POST `/`), `admin.js` (PATCH `/flags/:id`, PATCH `/users/:id/suspend`), `settings.js` (PATCH `/` profile update).
>
> **Missing `requireActiveUser`:** All stripe routes, all seller routes, all admin routes, `settings.js` PATCH `/` (profile update).
>
> **`requireActiveUser` must be updated first:** The current middleware (`auth.js` lines 40-57) only checks `deleted_at` and `token_revoked_at`. It does **not** check `suspended`. Suspension is only enforced at login time (`auth.js` line 118). A suspended user with a valid JWT passes `requireActiveUser` and retains full API access. Update the middleware to also check `suspended = true` and return `403 "Account suspended"`.
>
> **Admin self-targeting guard:** `PATCH /admin/users/:id/suspend` must check `req.params.id !== req.userId` (prevent admin self-suspension) and optionally reject targeting other admins. Without this, a compromised admin account can lock out all admins.
>
> **Fix:** First update `requireActiveUser` to check `suspended`. Then extract `requireXHR` to shared middleware (todo 006) and add to all 14 endpoints. Add `requireActiveUser` to stripe, seller, admin, and settings routes. Standardize middleware order: `requireXHR` → `authenticate` → `requireActiveUser` → rate limiter.

### 4. `refreshUser()` Return-Flow Races (All Pages)

> The plan carefully fixes the portal return flow (gate on `loading`, clean URL first, `.catch()`). But two existing return flows have the same bugs:
>
> **Dashboard `?upgraded=true`** (`Dashboard.jsx` lines 140-148): No `loading` gate, URL cleanup after `refreshUser()` (causes double-fire in React strict mode), no `.catch()`. Apply the same pattern:
> ```javascript
> useEffect(() => {
>   if (loading) return;
>   if (searchParams.get('upgraded') === 'true') {
>     window.history.replaceState({}, '', '/dashboard');
>     toast.success('Welcome to Pro! Enjoy full access.');
>     refreshUser().then(() => setShowSellerPrompt(true))
>       .catch(() => toast.error('Could not refresh. Please reload.'));
>   }
> }, [loading]);
> ```
>
> **SellerDashboard `?connect=return`** (`SellerDashboard.jsx` lines 16-26): No URL cleanup at all — `?connect=return` persists through bfcache and strict-mode re-mounts, re-firing `refreshOnboarding()` + `refreshUser()` on every revisit. Apply the same pattern:
> ```javascript
> useEffect(() => {
>   if (loading) return;
>   const connectStatus = searchParams.get('connect');
>   if (connectStatus === 'return') {
>     window.history.replaceState({}, '', '/seller');
>     api.refreshOnboarding()
>       .then(() => refreshUser())
>       .catch(() => {});
>   }
> }, [loading]);
> ```

### 5. Marketplace Detail Exposes Non-Active Listings

> **CRITICAL:** `GET /marketplace/:id` (`marketplace.js` line 117) has no `status = 'active'` filter. Non-active listings (delisted, removed, `pending_review`) are viewable by anyone via direct URL. With moderation, rejected content remains accessible.
>
> **Fix:** Add `AND ml.status = 'active'` to the WHERE clause. Return 404 for non-active listings.

### 6. Error Response Format — `api.js` Fix

> **IMPORTANT:** Three existing endpoints use `error` as a machine code with a separate `message` field (`seller.js:79` `terms_required`, `plan.js:48` `upgrade_required`, `auth.js:29` `email_verification_required`). The client's `api.js:17` shows `data.error` in toasts, so users see raw codes like "terms_required".
>
> **Fix (one line):** In `client/src/lib/api.js:17`, change `new Error(data.error || ...)` to `new Error(data.message || data.error || ...)`. This fixes all existing and future cases.

### 3. Extract `getStripe()` to Shared Singleton

> `getStripe()` is duplicated in 4 locations: `routes/stripe.js`, `routes/seller.js`, `services/purchase.js`, and inline `new Stripe(...)` in `routes/account.js` (line 171) and `index.js` (line 103, Connect webhook). Creates a new `Stripe()` per call (inconsistent with `getResend()`/`getGeminiClient()` singletons). Extract to `server/src/services/stripe.js` with lazy-init singleton pattern and update all 4 call sites.

### 7. `refreshUser()` Deduplication + Throttle

> **File:** `client/src/lib/AuthContext.jsx`
>
> `refreshUser()` is called from multiple pages (Settings, Dashboard, SellerDashboard) with no guard against concurrent invocations. If two callers invoke it simultaneously, the second `/me` response may overwrite the first with staler data. This affects the billing portal return flow and post-upgrade flow.
>
> **Fix 1 — Deduplication guard** using a `useRef` promise:
> ```javascript
> const refreshPromise = useRef(null);
> const refreshUser = useCallback(async () => {
>   if (refreshPromise.current) return refreshPromise.current;
>   const promise = api.me().then(data => {
>     setUser(data.user);
>     return data;
>   }).finally(() => { refreshPromise.current = null; });
>   refreshPromise.current = promise;
>   return promise;
> }, []);
> ```
>
> **Fix 2 — `visibilitychange` throttle:** Rapid tab-switching (Alt-Tab cycling) fires a `/me` request on every focus event. The dedup ref only coalesces concurrent calls, not sequential rapid-fire calls after the previous one resolves. Add a 5-second timestamp guard:
> ```javascript
> const lastRefreshRef = useRef(0);
> const onVisible = () => {
>   if (document.visibilityState !== 'visible') return;
>   if (Date.now() - lastRefreshRef.current < 5000) return;
>   lastRefreshRef.current = Date.now();
>   refreshUser();
> };
> ```
>
> **Fix 3 — Error handling at callsites:** The dedup wrapper propagates rejections. Callers like `Settings.jsx:243` (`refreshUser()` with no await/catch) will get unhandled promise rejections on network failure. Audit all callsites to either await with `.catch()` or have the dedup wrapper swallow errors internally.

---

## Phase 1: Stripe Billing Portal

**Effort:** Small — one endpoint, one button, one migration for cancel tracking. Also add `requireActiveUser` to existing `/checkout` and `/cancel` routes.

### Backend

**File:** `server/src/routes/stripe.js`

Add after the `/cancel` route:

```javascript
// POST /api/stripe/portal — redirect Pro user to Stripe Billing Portal
router.post('/portal', requireXHR, authenticate, requireActiveUser, portalLimiter, async (req, res) => {
  const stripe = getStripe();
  const { rows } = await pool.query(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [req.userId]
  );
  if (!rows[0]?.stripe_customer_id) {
    return res.status(400).json({ error: 'No billing account found' });
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: rows[0].stripe_customer_id,
    return_url: `${process.env.CLIENT_URL}/settings?portal_return=true`,
  });
  res.json({ url: session.url });
});
```

**File:** `client/src/lib/api.js`

Add `createBillingPortal` method:

```javascript
createBillingPortal: () => request('/stripe/portal', { method: 'POST' }),
```

### Frontend

**File:** `client/src/pages/Settings.jsx`

- Add "Manage Billing" button in the Subscription section, adjacent to the existing Cancel button (only for Pro users with `stripe_customer_id`)
- **Add loading/disabled state:** Set `portalLoading` boolean on click, disable button, show "Redirecting to Stripe..." text. Portal session creation takes 500ms-2s — without this, users double-click and create multiple sessions.
- On click: call `api.createBillingPortal()`, redirect via `window.location.href = data.url`
- On return: detect `?portal_return=true`, gate on `loading === false` to avoid racing with AuthContext mount, call `refreshUser()`, then clean URL with `window.history.replaceState({}, '', '/settings')`

### Portal Configuration (Stripe Dashboard or API)

- Disable plan switching (only one plan)
- Enable: payment method updates, invoice history
- Enable portal cancellation with `mode: 'at_period_end'` + cancellation reasons (free churn analytics — same behavior as in-app cancel)
- Set branding: logo, accent color `#1B6B5A`

### Research Insights

**Security:**
- Add `requireActiveUser` middleware — deleted/suspended users retain JWT cookies and could access the portal without it
- Portal session URLs are single-use and short-lived — always create fresh, never cache

**Rate limiter definition:**
```javascript
const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.userId, // per-user, not per-IP
  standardHeaders: true,
});
```

**Webhook handling for portal actions:**
Portal actions fire the same webhook events as API actions. The current `customer.subscription.updated` handler only checks `status === 'active'` and misses the `cancel_at_period_end` signal. When a user cancels (via portal or in-app), the subscription status is still `"active"` — it runs until period end.

**New migration required:** `server/src/db/migrations/010_billing_portal.sql`:

```sql
-- 010_billing_portal.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ;
```

This must ship with Phase 1. Content moderation migration becomes `011`.

**Update `USER_SELECT` + `sanitizeUser`** — without this, the frontend never receives the new fields:

**File:** `server/src/routes/auth.js`

Add `cancel_at_period_end` and `cancel_at` to the `USER_SELECT` constant (line 11) so `/me` returns them. Also update `sanitizeUser` to include the new fields in its output. The Settings page needs these to display "Your subscription will cancel on [date]" when `cancel_at_period_end` is true.

**Updated webhook handler:**
```javascript
case 'customer.subscription.updated': {
  const subscription = event.data.object;
  const customerId = subscription.customer;
  if (subscription.cancel_at_period_end) {
    await pool.query(
      `UPDATE users SET cancel_at_period_end = true, cancel_at = $1
       WHERE stripe_customer_id = $2`,
      [new Date(subscription.cancel_at * 1000).toISOString(), customerId]
    );
  } else if (subscription.status === 'active') {
    await pool.query(
      `UPDATE users SET plan = 'pro', stripe_subscription_id = $1,
       cancel_at_period_end = false, cancel_at = NULL
       WHERE stripe_customer_id = $2`,
      [subscription.id, customerId]
    );
  }
  break;
}

case 'customer.subscription.deleted': {
  const subscription = event.data.object;
  const customerId = subscription.customer;
  // MUST be atomic — crash between queries = free user with active listings
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE users SET plan = 'free', stripe_subscription_id = NULL,
       cancel_at_period_end = false, cancel_at = NULL
       WHERE stripe_customer_id = $1 RETURNING id`,
      [customerId]
    );
    if (rows[0]) {
      await client.query(
        `UPDATE marketplace_listings SET status = 'delisted'
         WHERE seller_id = $1 AND status IN ('active', 'pending_review')`,
        [rows[0].id]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  break;
}
```

**Also update `checkout.session.completed` handler:**
When a user re-subscribes before their cancellation period ends, `checkout.session.completed` fires before `subscription.updated`. Clear cancel fields here too to prevent a brief stale "cancelling" UI:

```javascript
case 'checkout.session.completed': {
  // ... existing plan upgrade logic ...
  await pool.query(
    `UPDATE users SET plan = 'pro', trial_ends_at = NULL,
     cancel_at_period_end = false, cancel_at = NULL,
     stripe_subscription_id = $1
     WHERE stripe_customer_id = $2`,
    [subscriptionId, customerId]
  );
  break;
}
```

**Frontend race condition:**
The portal return redirect arrives before `AuthContext` finishes its initial `/me` fetch. If both fire `refreshUser()` concurrently, the older response could overwrite the newer one. Gate the portal return logic on `loading === false`:

```javascript
useEffect(() => {
  if (loading) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('portal_return') === 'true') {
    // Clean URL first to prevent re-trigger on strict-mode double-mount
    window.history.replaceState({}, '', '/settings');
    // Then refresh — handle errors so user knows if it fails
    refreshUser().catch(() => {
      toast.error('Could not refresh your account. Please reload.');
    });
  }
}, [loading]);
```

### Acceptance Criteria

- [ ] Pro users see "Manage Billing" button on Settings page
- [ ] Free/trial users do not see the button
- [ ] Clicking redirects to Stripe Billing Portal
- [ ] Returning from portal refreshes user state (gated on `loading === false`)
- [ ] URL query param cleaned after processing
- [ ] Users without `stripe_customer_id` see an error, not a crash
- [ ] Endpoint has `requireActiveUser` + `requireXHR` + rate limiting
- [ ] `cancel_at_period_end` tracked in webhook handler and displayed in UI
- [ ] `customer.subscription.deleted` clears `cancel_at_period_end = false, cancel_at = NULL`
- [ ] `customer.subscription.deleted` delists both `active` AND `pending_review` listings
- [ ] `requireActiveUser` added to existing `/checkout` and `/cancel` routes
- [ ] Existing `SellerDashboard` connect-return `refreshUser()` also gated on `loading === false`
- [ ] `USER_SELECT` and `sanitizeUser` updated to include `cancel_at_period_end` and `cancel_at`

---

## Phase 2: Rate Limit UX

**Effort:** Medium — backend error format changes + frontend improvements.

**[DECIDE]:** Full countdown timer with generation counter, or simpler improved toast messages? The simplicity reviewer argues the current toast-based approach is adequate for <1000 users — just improve the message text. The countdown timer + counter adds ~50 LOC of frontend code with edge cases (tab backgrounding, multi-tab sync). Recommendation: ship the backend changes (cheap, non-breaking), defer countdown timer to when usage data shows it matters.

### Backend Changes

**File:** `server/src/middleware/plan.js`

Update the 429 response in `checkGenerationLimits` to include `retry_after`. **Keep `error` as human-readable string** (the existing `api.js` `request()` function uses `data.error` as the displayed error message):

```javascript
if (currentCount >= limits.generationsPerDay) {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCDate(midnight.getUTCDate() + 1);
  midnight.setUTCHours(0, 0, 0, 0);
  const retryAfter = Math.ceil((midnight - now) / 1000);

  return res.status(429).json({
    error: `Daily generation limit reached (${limits.generationsPerDay}/day). ${
      plan === 'free' ? 'Upgrade to Pro for more generations.' : 'Limit resets tomorrow.'
    }`,
    retry_after: retryAfter,
  });
}
```

For the deck count limit, no `retry_after` (not time-based):

```javascript
return res.status(429).json({
  error: `Maximum deck limit reached (${limits.maxDecks}). Delete a deck or upgrade to Pro for unlimited decks.`,
});
```

**File:** `server/src/routes/generate.js`

Update the express-rate-limit `handler`:

```javascript
const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  handler: (req, res) => {
    const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
    res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retry_after: retryAfter,
    });
  },
});
```

**File:** `server/src/routes/auth.js`

Expose `daily_generation_limit` in the `/me` response (don't hardcode limits in frontend):

```javascript
const limits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;
res.json({
  user: sanitizeUser(user),
  daily_generation_limit: limits.generationsPerDay,
});
```

### Frontend Changes

**File:** `client/src/pages/Generate.jsx`

1. **Remaining generations display** — show "X of Y generations used today" from `/me` data. Update the counter from `data.generationsRemaining` after each successful generation (don't rely solely on `/me` — it would be one behind)
2. **Upgrade nudge** — for free users, show "Upgrade to Pro for 10 generations per day" inline below the generation counter
3. **If implementing countdown timer** — use `setTimeout` (1s interval) + `visibilitychange` handler, NOT `requestAnimationFrame` (rAF runs at 60fps for hours to update a seconds counter — drains battery on mobile for no visible benefit):

### Research Insights

**Why `setTimeout` + `visibilitychange` (not `requestAnimationFrame` or `setInterval`):**
- `setInterval` is throttled in background tabs — timer freezes and shows stale values
- `requestAnimationFrame` runs at 60fps to update a value that changes once per second — wasteful
- `setTimeout(tick, 1000)` with a `visibilitychange` handler that immediately recalculates on tab foreground gives accurate behavior without battery drain

```javascript
useEffect(() => {
  if (!retryDeadline) return;
  let timeoutId;
  const tick = () => {
    const remaining = Math.max(0, retryDeadline - Date.now());
    setCountdownSeconds(Math.ceil(remaining / 1000));
    if (remaining <= 0) { setRetryDeadline(null); return; }
    timeoutId = setTimeout(tick, 1000);
  };
  tick();
  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      clearTimeout(timeoutId);
      tick(); // recalculate immediately on tab foreground
    }
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearTimeout(timeoutId);
    document.removeEventListener('visibilitychange', onVisible);
  };
}, [retryDeadline]);
```

**Simpler alternative (recommended for v1):** Skip the countdown timer entirely. Show static text: `Resets at ${new Date(resetsAtUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` — 3 lines of code, no timer.

**Timezone display:** The server resets at UTC midnight. Show the reset time in the user's local timezone: `new Date(resetsAtUtc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })`. For countdown timers, timezone doesn't matter since you're computing a duration.

**Multi-tab stale counts:** Simplest fix — refetch `/me` on `visibilitychange` to `'visible'` (5 lines of code). BroadcastChannel is overkill for this use case.

### Acceptance Criteria

- [ ] Generate page shows "X of Y generations used today" on load
- [ ] Counter updates from generate response (not stale until next `/me`)
- [ ] Backend 429 generation limit includes `retry_after` seconds (without breaking existing error field)
- [ ] Free users see upgrade nudge alongside generation counter
- [ ] If countdown timer implemented: handles tab backgrounding via `setTimeout` + `visibilitychange`

---

## Phase 3: Listing Share Button + OG Tags

**Effort:** Small (share only) to Medium (share + OG crawler detection).

**[DECIDE]:** Static OG tags in `index.html` (every shared link shows generic "AI Notecards Marketplace" preview) vs server-side crawler detection (per-listing previews). The simplicity reviewer argues static tags are fine for <1000 users since you don't have traffic data showing people share listings yet. The full approach makes shared links dramatically more clickable on Twitter/Reddit/Discord. Recommendation: ship share buttons immediately (frontend-only), ship crawler detection if sharing is a growth priority.

### Share Popover (Shared Component)

**File:** `client/src/components/SharePopover.jsx` (new — extract to shared component)

Both `MarketplaceDeck.jsx` and `SellerDashboard.jsx` need the same share popover. Extract to a shared component to avoid duplication (follows the existing `Navbar` component extraction pattern):

```javascript
// Props: { url, title, cardCount, price }
export default function SharePopover({ url, title, cardCount, price }) { ... }
```

- Three options: Copy link, Twitter/X, Reddit
- Copy link: use `navigator.clipboard.writeText()` — the app runs on HTTPS in production (Vercel enforces it), and `localhost` is treated as secure context. No `execCommand` fallback needed.

```javascript
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Link copied!');
  } catch {
    toast.error('Could not copy link');
  }
}
```

- Twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
- Reddit: `https://reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
- Share URL: `window.location.origin + /marketplace/${listing.id}`
- Only show on `status === 'active'` listings (hide for pending_review, delisted)
- Design: small share icon (arrow-up-from-square), popover not modal, existing button styles
- **Popover outside-click:** Copy the `AvatarDropdown` pattern from `Navbar.jsx` — use `mousedown` listener with `buttonRef.current?.contains(e.target)` check to prevent toggle-bounce

**File:** `client/src/pages/MarketplaceDeck.jsx`

Import and render `<SharePopover>` next to Buy/Flag buttons.

**File:** `client/src/pages/SellerDashboard.jsx`

Import and render `<SharePopover>` on each listing card so sellers can share their own listings.

### Open Graph Tags

> **Architecture constraint:** Production uses split deployment — client on Vercel, server on Railway. Vercel proxy rewrites send only `/api/*` to Express. Crawler requests to `https://domain.com/marketplace/:id` hit **Vercel, not Express**. Server-side middleware in Express (`og.js`) will never see crawler traffic.

#### Option A: Static OG tags in `index.html` (Recommended for v1)

**File:** `client/index.html`

Add generic marketplace OG tags. Every shared link shows "AI Notecards Marketplace" with a branded image. No server changes, ships in 5 minutes:

```html
<meta property="og:title" content="AI Notecards Marketplace" />
<meta property="og:description" content="Buy and sell AI-generated flashcard decks" />
<meta property="og:image" content="https://ainotecards.com/og-marketplace.png" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

- **Pros**: Zero complexity, no new files, no deployment changes
- **Cons**: All shared links show same generic preview (no per-listing title/image)
- **Trade-off**: Acceptable for <1000 users — no traffic data showing people share listings yet

#### Option B: Vercel Edge Middleware (v2 — when sharing is a growth priority)

Per-listing OG tags via Vercel Edge Middleware can be added later if sharing metrics warrant it. The approach: create a `middleware.ts` at project root using `@vercel/edge` (NOT `next/server` — this is a Vite app) that checks user-agent and rewrites crawler requests to an API endpoint (`/api/og/marketplace/:id`) that returns minimal OG HTML. Express serves the OG HTML; Vercel handles the routing.

### Research Insights

**Static OG image:**
- Create a branded 1200×630 OG image with app logo and marketplace tagline
- Host at a stable URL (e.g., `/og-marketplace.png` in `client/public/`)

**If implementing per-listing OG (v2):**
- Use `he` npm package for HTML escaping (not hand-rolled `escapeHtml`)
- Set `Content-Security-Policy: default-src 'none'` on OG responses
- Validate `id` param is a valid UUID before querying
- Build redirect URL from `process.env.CLIENT_URL` + listing ID only (prevents open redirect)
- Add `Cache-Control: public, max-age=300` — crawlers hit the same URLs repeatedly
- Only query `title`, `description`, `price_cents`, `category_name` (no card content)

### Acceptance Criteria

- [ ] Share button visible on all active listings for all users
- [ ] Share button hidden on pending_review/delisted listings
- [ ] Copy link copies correct URL and shows toast (with error toast on failure)
- [ ] Twitter share opens pre-filled tweet with title, card count, price, URL
- [ ] Reddit share opens submit form with title and URL
- [ ] Popover dismisses on outside click without toggle-bounce
- [ ] If OG crawler detection implemented: crawlers receive correct per-listing OG tags
- [ ] SellerDashboard listing cards have share icon

---

## Phase 4: Transactional Emails

**Effort:** Medium — email templates + trigger points in webhooks.

**[DECIDE]:** Add templates to existing `email.js` (simpler, one file), or create `emails/` directory (cleaner separation at scale)? The pattern recognition reviewer notes `getResend()` is not exported from `email.js`, and `email.js` alongside `emails/` creates a naming collision. **Recommendation for v1:** add templates directly to `email.js` with a `sendTransactionalEmail(type, to, data)` function and a `TEMPLATES` map. When you reach 8+ email types, extract to a directory.

### Email Service

**File:** `server/src/services/email.js` (extend existing)

Keep `getResend()` module-private — `sendTransactionalEmail` calls it internally, so no external consumer needs the export. Add a template map and `sendTransactionalEmail` function:

```javascript
const TEMPLATES = {
  sale_notification: (data) => ({
    subject: `You sold ${data.title} for $${(data.earnings / 100).toFixed(2)}!`,  // plain text — no he.encode()
    html: `...`, // use he.encode(data.title) in HTML body — warm parchment palette
    text: `...`, // plain text fallback — no escaping needed
  }),
  purchase_confirmation: (data) => ({ ... }),
  subscription_confirmed: (data) => ({ ... }),
  subscription_cancelling: (data) => ({ ... }),
};

export async function sendTransactionalEmail(type, to, data) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] Email (${type}) to ${to}:`, data);
    return true;
  }
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown email template: ${type}`);
  const { subject, html, text } = template(data);
  try {
    const client = await getResend();
    await client.emails.send({
      from: 'AI Notecards <noreply@mail.ainotecards.com>',
      to,
      subject,
      html,
      text,
      headers: { 'X-Entity-Ref-ID': crypto.randomUUID() },
    });
    return true;
  } catch (err) {
    console.error(`Failed to send ${type} email to ${to}:`, err);
    return false;
  }
}
```

### Trigger Points

**File:** `server/src/routes/stripe.js`

- **Sale + purchase emails:** Inside `payment_intent.succeeded`, after `fulfillPurchase()` succeeds. Gate on `result.isNew` for idempotency (`fulfillPurchase` must return `{ isNew: boolean, purchaseId }` — currently returns void). Send emails AFTER returning 200 to Stripe. **Use `return` after `res.json()`** — the existing webhook handler has a final `res.json({ received: true })` at the end of the switch block (`stripe.js` line 193). Without `return`, two responses fire and crash with `ERR_HTTP_HEADERS_SENT`:

```javascript
case 'payment_intent.succeeded': {
  const meta = {
    buyer_id: paymentIntent.metadata.buyer_id,
    listing_id: paymentIntent.metadata.listing_id,
    deck_id: paymentIntent.metadata.deck_id,
  };
  // NOTE: signature is (paymentIntentId, metadata) — NOT the full paymentIntent object
  const result = await fulfillPurchase(paymentIntent.id, meta);
  // Return 200 to Stripe immediately — MUST use return to prevent double res.json()
  res.json({ received: true });
  // Then send emails non-blocking (only for new purchases, not replays)
  if (result.isNew) {
    const { rows: [emailData] } = await pool.query(`
      SELECT buyer.email AS buyer_email, seller.email AS seller_email,
             ml.title, ml.price_cents
      FROM purchases p
      JOIN users buyer ON buyer.id = p.buyer_id
      JOIN users seller ON seller.id = p.seller_id
      JOIN marketplace_listings ml ON ml.id = p.listing_id
      WHERE p.id = $1
    `, [result.purchaseId]);

    if (emailData) {
      const earnings = Math.round(emailData.price_cents * (1 - PLATFORM_FEE_RATE));
      Promise.allSettled([
        sendTransactionalEmail('sale_notification', emailData.seller_email, {
          title: emailData.title,  // he.encode() applied inside template html body, NOT here
          earnings,
        }),
        sendTransactionalEmail('purchase_confirmation', emailData.buyer_email, {
          title: emailData.title,
          price: emailData.price_cents,
        }),
      ]).then(results => {
        results.filter(r => r.status === 'rejected').forEach(r =>
          console.error('Email send failed:', r.reason)
        );
      });
    }
  }
  return; // <-- CRITICAL: prevents hitting final res.json() at end of switch
}
```

> **Why `Promise.allSettled` over `Promise.all`:** If seller email fails but buyer email succeeds, `Promise.all` rejects with the first error and discards the buyer result. `Promise.allSettled` logs both failures independently.
>
> **Why `fulfillPurchase` must return `{ isNew }`:** Currently returns `undefined`. Restructure to return `{ isNew: true, purchaseId }` on successful insert (via `RETURNING` + row count), or `{ isNew: false }` on `ON CONFLICT DO NOTHING`. **Both early-exit paths must also return `{ isNew: false }`** — the deck-not-found path (line 126: `return;`) and the duplicate path (line 158: `return;`). If either returns `undefined`, `result.isNew` throws `TypeError`.

- **Subscription confirmed:** Inside `checkout.session.completed`, after plan update.
- **Subscription cancelling:** Handle `customer.subscription.updated` with `cancel_at_period_end === true`.

### Research Insights

**Resend idempotency keys:**
Resend supports idempotency keys (up to 256 chars, expire after 24h). Use format `<event-type>/<entity-id>` (e.g., `sale-notification/pi_abc123`). Pass as second argument to `resend.emails.send()`. This prevents duplicate emails even if your application-level deduplication has a gap.

**CAN-SPAM compliance:**
- Purchase confirmations and sale notifications are **transactional** — no unsubscribe link required.
- Subscription emails (welcome, cancelling) are also transactional.
- Only add unsubscribe if emails include promotional content (e.g., "Check out similar decks").
- No email preference opt-out needed for transactional emails — add opt-out infrastructure when marketing emails are introduced (v2).

**HTML template security (XSS prevention):**
- **Use `he.encode()` on ALL user-derived values** before HTML interpolation. Install `he` npm package. A listing titled `<img src="https://evil.com/track">` injects tracking pixels; `<style>` tags can restyle email client UIs.
- Apply in every template: `he.encode(data.title)`, `he.encode(data.sellerName)`, etc.
- Plain text fallbacks (`text:` field) don't need escaping.

```javascript
import he from 'he';
// In each template — he.encode() for HTML body only (subjects are plain text, not HTML)
subject: `You sold ${data.title} for $${(data.earnings / 100).toFixed(2)}!`,
html: `<p>Your deck <strong>${he.encode(data.title)}</strong> was purchased!</p>`,
```

### Acceptance Criteria

- [x] Seller receives email when their deck is purchased (with correct title and earnings)
- [x] Buyer receives email with link to start studying
- [x] Pro subscription activation sends welcome email
- [x] Cancellation sends email with period-end date
- [x] No email preference opt-out for transactional emails (add when marketing emails introduced)
- [x] Duplicate webhook replays don't send duplicate emails (gated on `fulfillPurchase().isNew`)
- [x] `fulfillPurchase` returns `{ isNew: boolean, purchaseId }` (not void)
- [x] Dev mode logs emails to console instead of sending
- [x] All user content escaped with `he.encode()` in HTML templates (no XSS)
- [x] `Promise.allSettled` used for independent email sends (not `Promise.all`)
- [x] Emails sent non-blocking (after 200 response to Stripe)
- [x] `return` after `res.json()` in each webhook case block (prevents double response)
- [x] Audit all existing webhook cases for missing `return` statements

---

## Phase 5: Automated Content Moderation

**Effort:** Large — new service, migration, listing flow changes, async screening.

**[DECIDE]:** AI pre-screening via OpenRouter, or manual admin review for v1? The simplicity reviewer argues that with single-digit new listings per week at launch, manual review is more reliable and requires zero additional dependencies. The existing admin flags queue at `/admin/flags` already works. **If choosing manual review:** add an `is_reviewed` boolean, send yourself an email/Slack notification on new listings, review from the admin panel. **If choosing AI screening:** proceed with the full plan below.

### Database Migrations

> **Migration safety:** The custom migrator (`db/migrator.js` lines 33-39) wraps every migration file in `BEGIN`/`COMMIT`. This means `NOT VALID` + `VALIDATE CONSTRAINT` in the same file defeats the purpose — the lock is held for the full duration of the VALIDATE scan. Split into separate files so the NOT VALID ADD runs in one short transaction and the VALIDATE runs in another.

**File:** `server/src/db/migrations/011_content_moderation.sql`

```sql
-- 011_content_moderation.sql
-- Adds AI content moderation columns + NOT VALID constraints (fast, minimal locks)

-- 1. Add moderation columns (safe in PG 11+, no table rewrite for NOT NULL DEFAULT)
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS moderation_requested_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop existing inline CHECK on status (find by catalog, not by assumed name)
DO $$
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'marketplace_listings'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%status%'
      AND pg_get_constraintdef(con.oid) NOT LIKE '%moderation_status%'
  LOOP
    EXECUTE format('ALTER TABLE marketplace_listings DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

-- 3. Add NOT VALID constraints (instant — no full table scan)
ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_status_check
  CHECK (status IN ('active', 'delisted', 'removed', 'pending_review')) NOT VALID;

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_moderation_status_check
  CHECK (moderation_status IN ('pending', 'approved', 'rejected')) NOT VALID;

ALTER TABLE marketplace_listings
  ADD CONSTRAINT marketplace_listings_status_moderation_coherence
  CHECK (
    (status = 'active' AND moderation_status = 'approved')
    OR (status = 'pending_review' AND moderation_status IN ('pending', 'rejected'))
    OR (status IN ('delisted', 'removed'))
  ) NOT VALID;

-- 4. Index for admin moderation queue
CREATE INDEX IF NOT EXISTS idx_listings_moderation_pending
  ON marketplace_listings (moderation_requested_at)
  WHERE moderation_status = 'pending';
```

**File:** `server/src/db/migrations/012_validate_moderation_constraints.sql`

```sql
-- 012_validate_moderation_constraints.sql
-- Validate constraints in separate transaction (holds ShareUpdateExclusiveLock during scan
-- but does NOT block reads/writes — only blocks other DDL)

ALTER TABLE marketplace_listings VALIDATE CONSTRAINT marketplace_listings_status_check;
ALTER TABLE marketplace_listings VALIDATE CONSTRAINT marketplace_listings_moderation_status_check;
ALTER TABLE marketplace_listings VALIDATE CONSTRAINT marketplace_listings_status_moderation_coherence;
```

### Moderation Service

**File:** `server/src/services/moderation.js` (new)

- Lazy-init OpenAI SDK with OpenRouter base URL: `new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })`
- Model: `meta-llama/llama-3.1-8b-instruct` (cheap, fast)
- Prompt: classify title + description + card content for explicit/sexual content, hate speech, violence, spam/gibberish, copyright red flags
- Returns `{ pass: boolean, reason: string }`
- 15-second timeout on the API call (not the full 60 seconds — the 60s is the auto-approve window)
- Handle error modes: timeout → fail-open, 401/402 → log critical alert + fail-open, malformed response → fail-open
- Token budget: truncate card content to first 500 characters per card side (30 cards × 2 sides × 500 chars = 30K chars max ≈ 7500 tokens)

**File:** `server/.env.example`

Add `OPENROUTER_API_KEY=sk-or-xxx`

### Listing Creation Flow Changes

**File:** `server/src/routes/seller.js`

Modify `POST /listings`:

1. **Update existing validation queries** — the listing count check (`WHERE seller_id = $1 AND status = 'active'`) and duplicate title check must include `pending_review` status. Otherwise a seller can bypass the 50-listing limit by submitting listings faster than moderation approves them:
   ```javascript
   // Count check: include pending_review
   WHERE seller_id = $1 AND status IN ('active', 'pending_review')
   // Duplicate title check: include pending_review
   WHERE seller_id = $1 AND title = $2 AND status IN ('active', 'pending_review')
   ```
2. Insert listing with `status = 'pending_review'`, `moderation_status = 'pending'`, `moderation_requested_at = NOW()` — **inside** the existing transaction
3. Return `201` with the listing (status shows `pending_review`)
4. Fire async moderation **AFTER COMMIT** (not inside transaction). Always attach `.catch()`:

```javascript
await client.query('COMMIT');
res.status(201).json({ listing });

// Fire-and-forget moderation (after commit, after response)
moderateListing(listing.id, deck_id).catch(err =>
  console.error('Moderation failed for listing', listing.id, err)
);
```

5. In the async moderation handler, use conditional UPDATE to prevent race with auto-approve:

```javascript
// Only update if still pending AND in pending_review status
// Prevents flipping moderation_status on removed/delisted listings
await pool.query(
  `UPDATE marketplace_listings
   SET moderation_status = $1, moderation_reason = $2,
       status = CASE WHEN $1 = 'approved' THEN 'active' ELSE status END
   WHERE id = $3 AND moderation_status = 'pending' AND status = 'pending_review'`,
  [result.pass ? 'approved' : 'rejected', result.reason, listingId]
);
```

### Auto-Approve: Cleanup-First Approach (Not OR Clause)

Instead of injecting an OR clause into every marketplace browse query (which breaks existing partial indexes and creates phantom state), **run a cleanup UPDATE before the browse query**:

**File:** `server/src/routes/marketplace.js`

> **Debounce required:** Running a write on every GET converts the busiest read endpoint into a write endpoint — all 5 code-focused reviewers flagged this independently. Use a module-level timestamp guard to limit cleanup to once per 30 seconds:

```javascript
let lastCleanup = 0;

async function maybeAutoApprove() {
  const now = Date.now();
  if (now - lastCleanup < 30_000) return; // skip if < 30s since last run
  lastCleanup = now;
  await pool.query(`
    UPDATE marketplace_listings
    SET status = 'active', moderation_status = 'approved',
        moderation_reason = 'auto-approved (timeout)'
    WHERE status = 'pending_review'
      AND moderation_status = 'pending'
      AND moderation_requested_at < NOW() - INTERVAL '60 seconds'
  `);
}

// At the start of GET /api/marketplace — fire-and-forget (don't block response)
// Pending listings are invisible to the browse query (status = 'active' filter),
// so there's no reason to await the cleanup before querying
maybeAutoApprove().catch(err => console.error('Auto-approve cleanup failed:', err));
// Then query only status = 'active' as before — existing indexes work unchanged
```

This preserves all existing partial indexes (`WHERE status = 'active'`), eliminates the OR clause complexity, limits writes to once per 30 seconds (not per request), and auto-approve catches up after restart since it uses a time-based WHERE clause.

### Re-Moderation on Updates

**File:** `server/src/routes/seller.js`

Modify `PATCH /listings/:id`: when `description` is updated, set `moderation_status = 'pending'`, `moderation_requested_at = NOW()`, `status = 'pending_review'`, and fire async re-screening. Tag updates alone do not trigger re-moderation. **Wrap in transaction** — the current PATCH runs description update and tag replacement as separate `pool.query()` calls (not transactional). If the status change succeeds but tag insert fails, the listing is stuck in `pending_review` with old tags:

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Update description + moderation status
  await client.query(
    `UPDATE marketplace_listings
     SET description = $1, moderation_status = 'pending',
         moderation_requested_at = NOW(), status = 'pending_review'
     WHERE id = $2 AND seller_id = $3`,
    [description, id, req.userId]
  );
  // Replace tags (delete + insert)
  await client.query('DELETE FROM listing_tags WHERE listing_id = $1', [id]);
  if (tags?.length) {
    await client.query(
      `INSERT INTO listing_tags (listing_id, tag) VALUES ${tags.map((_, i) => `($1, $${i + 2})`).join(', ')}`,
      [id, ...tags]
    );
  }
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
// Fire-and-forget re-moderation AFTER commit
if (descriptionChanged) {
  moderateListing(id, listing.deck_id).catch(err =>
    console.error('Re-moderation failed for listing', id, err)
  );
}
```

Also update `POST /listings/:id/relist`: **branch on `moderation_status`**. If the listing was previously rejected (`moderation_status = 'rejected'`), going directly to `active` violates the coherence constraint (`active` requires `approved`). Branch:

```javascript
if (listing.moderation_status === 'rejected') {
  // Re-screen required — can't go directly to active
  await pool.query(
    `UPDATE marketplace_listings
     SET status = 'pending_review', moderation_status = 'pending',
         moderation_requested_at = NOW()
     WHERE id = $1 AND seller_id = $2`,
    [id, req.userId]
  );
  moderateListing(id, listing.deck_id).catch(err =>
    console.error('Re-moderation failed for relist', id, err)
  );
} else {
  // Normal relist (previously delisted, not rejected)
  await pool.query(
    `UPDATE marketplace_listings SET status = 'active'
     WHERE id = $1 AND seller_id = $2`,
    [id, req.userId]
  );
}
```

> **Deployment order:** Migration 011/012 must run **before** code deploy. The new listing creation INSERT sets `moderation_status = 'pending'` and `status = 'pending_review'` — these values violate the existing CHECK constraint and fail without the migration. The new code also reads `moderation_status` from query results (relist branching, seller dashboard badges) — without the column, these crash with undefined. Deploy sequence: run migration 011 → run migration 012 → deploy code. The migration is backward-compatible with old code because existing rows get `moderation_status = 'approved'` (the default) and old code never references the new column.

### Seller Dashboard UI

**File:** `client/src/pages/SellerDashboard.jsx`

- Show a yellow "Under Review" badge on listings with `status === 'pending_review'` and `moderation_status === 'pending'`
- Show a red "Rejected" badge with `moderation_reason` for `moderation_status === 'rejected'` — "Under Review" forever is a terrible experience
- **Poll for status changes** when pending listings exist (exponential backoff, 3s → 30s cap). Use `useMemo` for the dependency (inline `listings.some(...)` violates ESLint `exhaustive-deps`). Add cancel check **after** await (prevents state update on unmounted component):

```javascript
const hasPending = useMemo(
  () => listings.some(l => l.status === 'pending_review' && l.moderation_status === 'pending'),
  [listings]
);

useEffect(() => {
  if (!hasPending) return;
  let delay = 3000;
  let canceled = false;
  let timeoutId;
  const poll = async () => {
    if (canceled) return;
    try {
      const data = await api.getSellerListings();
      if (canceled) return; // <-- cancel check AFTER await (prevents stale setState)
      setListings(data.listings);
      if (data.listings.some(l => l.status === 'pending_review' && l.moderation_status === 'pending') && !canceled) {
        delay = Math.min(delay * 1.5, 30000);
        timeoutId = setTimeout(poll, delay);
      }
    } catch { /* swallow — stale data is better than error toasts every 3s */ }
  };
  timeoutId = setTimeout(poll, delay);
  return () => { canceled = true; clearTimeout(timeoutId); };
}, [hasPending]);
```

### Research Insights

**Data integrity — cross-column CHECK is critical:**
Without the coherence constraint, a bug could set `status = 'active'` with `moderation_status = 'rejected'`, making flagged content publicly visible. The constraint makes this impossible at the database level.

**Race condition — late moderation result vs auto-approve:**
If auto-approve runs at T=61s and moderation returns at T=62s, the conditional UPDATE (`WHERE moderation_status = 'pending'`) returns 0 rows because auto-approve already changed it to `'approved'`. The moderation result is safely discarded. This makes both paths idempotent and order-independent.

**Migration safety:**
- The inline CHECK from `003_marketplace.sql` may have an auto-generated name (not necessarily `marketplace_listings_status_check`). The DO block queries `pg_constraint` to find the actual name.
- `NOT VALID` constraints in `011`, `VALIDATE` in `012` — the migrator wraps each file in `BEGIN`/`COMMIT`, so this split is required for minimal lock duration. The `011` transaction is instant (no scan); the `012` transaction holds `ShareUpdateExclusiveLock` during validation but does not block reads or writes.

**Debounce re-moderation on description updates:**
If a seller rapidly edits their description, each edit fires a new moderation call. Only trigger re-moderation on explicit save actions (which the current PATCH endpoint represents — it's not auto-save).

### Acceptance Criteria

- [ ] New listings go to `pending_review` → async AI screening → `active` if clean
- [ ] Flagged listings stay in `pending_review` with `moderation_status = 'rejected'` and visible reason
- [ ] Listings auto-approve after 60 seconds via debounced cleanup UPDATE (once per 30s, not per request)
- [ ] Auto-approve survives server restarts (time-based WHERE clause, not in-memory state)
- [ ] Description edits trigger re-moderation (listing goes back to `pending_review`)
- [ ] PATCH handler wraps description + tag updates in transaction
- [ ] Relist re-screens if listing was previously rejected
- [ ] SellerDashboard shows distinct "Under Review" and "Rejected" badges
- [ ] SellerDashboard polls for status changes (useMemo dependency, cancel check after await)
- [ ] Async moderation uses conditional UPDATE (`WHERE moderation_status = 'pending'`)
- [ ] Relist of rejected listing goes to `pending_review` + re-screens (not directly to `active`)
- [ ] Migration deploys before code (new INSERT values require new CHECK constraint; migration is backward-compatible with old code)
- [ ] Fire-and-forget always has `.catch()` handler
- [ ] Cross-column CHECK constraint prevents `active + rejected` state
- [ ] OpenRouter errors logged with severity (401/402 = critical, timeout = warning)
- [ ] Existing listings unaffected (default `moderation_status = 'approved'`, `moderation_requested_at = NULL`)
- [ ] Listing count + duplicate title checks include `pending_review` status (prevent limit bypass)
- [ ] `maybeAutoApprove()` is fire-and-forget (not awaited — pending listings invisible to browse query)
- [ ] Moderation callback WHERE includes `AND status = 'pending_review'` (prevent flipping removed listings)

---

## Key Files Reference

### Backend
| File | Changes |
|------|---------|
| `server/src/routes/stripe.js` | Add `/portal` endpoint + email triggers with `return` + `cancel_at_period_end` webhook handling + clear cancel fields on `subscription.deleted` |
| `server/src/routes/seller.js` | Moderation on create + listing count/title checks include `pending_review` + re-moderation on update (transactional) + relist branches on `moderation_status` |
| `server/src/routes/generate.js` | Structured rate limit error with `retry_after` |
| `server/src/routes/auth.js` | Expose `daily_generation_limit` in `/me` + add `cancel_at_period_end`/`cancel_at` to `USER_SELECT` and `sanitizeUser` |
| `server/src/routes/marketplace.js` | Debounced auto-approve cleanup (fire-and-forget, once per 30s) + `status = 'active'` filter on `GET /:id` |
| `server/src/middleware/plan.js` | Add `retry_after` to generation limit 429 (human-readable `error` message) |
| `server/src/services/stripe.js` | New — extracted `getStripe()` singleton (replaces inline `new Stripe()` in `routes/stripe.js`, `routes/seller.js`, `services/purchase.js`, `routes/account.js`, and `index.js`) |
| `server/src/services/purchase.js` | Extract `PLATFORM_FEE_RATE` constant (fix both line 69 + 139) + `fulfillPurchase` returns `{ isNew: boolean, purchaseId }` |
| `server/src/services/moderation.js` | New — OpenRouter AI screening (if AI moderation chosen) |
| `server/src/services/email.js` | Add transactional email templates + `sendTransactionalEmail()` + `he.encode()` for XSS |
| `server/src/db/migrations/010_billing_portal.sql` | New — `cancel_at_period_end` + `cancel_at` columns on users |
| `server/src/db/migrations/011_content_moderation.sql` | New — moderation columns + NOT VALID constraints |
| `server/src/db/migrations/012_validate_moderation_constraints.sql` | New — VALIDATE only (separate transaction for minimal locks) |
| `server/.env.example` | Add `OPENROUTER_API_KEY` |
| `client/src/lib/api.js` | Fix error handler (line 17): `data.message \|\| data.error` (prefer human-readable message) + add `createBillingPortal` method |
| All state-changing routes (14) | Add `requireXHR` middleware (CSRF fix) |
| Stripe, seller, admin routes | Add `requireActiveUser` middleware |

### Frontend
| File | Changes |
|------|---------|
| `client/src/lib/AuthContext.jsx` | `refreshUser()` deduplication via `useRef` promise + `visibilitychange` 5s throttle |
| `client/src/pages/Settings.jsx` | "Manage Billing" button + portal return refresh (gated on loading, URL cleaned first, error toast) |
| `client/src/pages/Generate.jsx` | Generation counter + upgrade nudge + (optional) countdown timer (`setTimeout` + `visibilitychange`) |
| `client/src/components/SharePopover.jsx` | New — shared share popover (used by MarketplaceDeck + SellerDashboard) |
| `client/src/pages/MarketplaceDeck.jsx` | Import `SharePopover` |
| `client/src/pages/SellerDashboard.jsx` | Import `SharePopover` + "Under Review"/"Rejected" badges + polling (useMemo + cancel check) + connect-return fix |
| `client/src/pages/Dashboard.jsx` | Fix `?upgraded=true` return flow (gate on `loading`, clean URL first, `.catch()`) |
| `client/index.html` | Static OG tags (v1) |

---

## Scope Boundaries

**In scope:** Five marketplace operational features as described above.

**Out of scope:**
- Push notifications / in-app notification center (v2)
- Seller analytics dashboard with charts (v2)
- Refund system (Stripe handles disputes)
- Full marketplace SEO beyond OG tags (sitemaps, structured data, SSR)
- Rating digest emails (post-launch nice-to-have)
- Seller payout schedule visibility (Stripe Connect dashboard handles this)
- Per-listing OG tags via Vercel Edge Middleware (v2 — static OG tags for v1)
- Dynamic per-listing OG image generation (v2 — static branded image for v1)
- Email retry queue / dead-letter queue (v2 — log failures for v1)
- BroadcastChannel multi-tab sync (v2 — `visibilitychange` refetch is sufficient)
- Moderation audit/events table (v2 — structured logging for v1)
