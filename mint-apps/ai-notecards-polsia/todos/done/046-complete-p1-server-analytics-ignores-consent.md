---
status: pending
priority: p1
issue_id: "046"
tags: [code-review, security, gdpr, analytics]
dependencies: []
---

# Server-Side trackServerEvent Ignores User Consent (GDPR)

## Problem Statement

The server-side `trackServerEvent` function fires events unconditionally. Events like `signup_completed`, `purchase_completed`, `seller_terms_accepted`, and `subscription_started` are sent to PostHog regardless of the user's `analytics_opt_out` preference. Under GDPR, server-side analytics events associated with a distinct user ID require the same consent as client-side tracking.

## Findings

- **Security Sentinel:** LOW severity but GDPR non-compliance
- **Architecture Strategist:** MEDIUM-HIGH — server events must respect opt-out

## Proposed Solutions

### Option A: Check opt-out preference before firing (Recommended)
```js
export async function trackServerEvent(userId, event, properties = {}) {
  const ph = getClient();
  if (!ph) return;
  // Check user's opt-out preference
  const { rows } = await pool.query(
    "SELECT preferences->>'analytics_opt_out' AS opted_out FROM users WHERE id = $1",
    [userId]
  );
  if (rows[0]?.opted_out === 'true') return;
  try { ph.capture({ distinctId: userId, event, properties }); } catch {}
}
```
**Pros:** GDPR compliant, respects user choice
**Cons:** Extra DB query per server event; could cache with short TTL
**Effort:** Medium
**Risk:** Low

### Option B: Separate aggregate events from user events
For aggregate analytics (signup counts, purchase counts), use PostHog without a distinct user ID. For user-linked events, check consent.
**Pros:** Gets aggregate data even from opted-out users
**Cons:** More complex, two tracking paths
**Effort:** Medium
**Risk:** Low

## Acceptance Criteria

- [ ] `trackServerEvent` checks user's `analytics_opt_out` preference before sending
- [ ] Users who opted out have zero server-side events in PostHog
- [ ] Performance impact is acceptable (cache preference if needed)
