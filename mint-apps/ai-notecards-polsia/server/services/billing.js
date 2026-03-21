const DEFAULT_ENTITLEMENT = 'pro';
const DEFAULT_MARKETPLACE_PLATFORM_FEE_RATE = 0.5;

export function getPlatformFeeRate() {
  const configured = Number(process.env.MARKETPLACE_PLATFORM_FEE_RATE);

  if (!Number.isFinite(configured) || configured < 0 || configured > 1) {
    return DEFAULT_MARKETPLACE_PLATFORM_FEE_RATE;
  }

  return configured;
}

export function calculatePlatformFeeCents(priceCents) {
  return Math.round(priceCents * getPlatformFeeRate());
}

export function calculateSellerEarningsCents(priceCents) {
  return priceCents - calculatePlatformFeeCents(priceCents);
}

export const PLATFORM_FEE_RATE = getPlatformFeeRate();

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(date) {
  return date ? date.toISOString() : null;
}

export function getAllowedStripePrices() {
  return {
    monthly: process.env.STRIPE_PRO_PRICE_ID,
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
  };
}

export function getStripePriceIdForPeriod(period = 'monthly') {
  const normalized = period === 'annual' ? 'annual' : 'monthly';
  const priceId = getAllowedStripePrices()[normalized];
  if (!priceId) {
    throw Object.assign(new Error(`Missing Stripe price configuration for ${normalized}`), { status: 500 });
  }
  return priceId;
}

export function isAllowedRevenueCatProduct(productId) {
  const allowed = [
    process.env.REVENUECAT_APPLE_MONTHLY_PRODUCT_ID,
    process.env.REVENUECAT_APPLE_ANNUAL_PRODUCT_ID,
  ].filter(Boolean);

  return typeof productId === 'string' && allowed.includes(productId);
}

export function isAllowedRevenueCatEntitlement(entitlementId) {
  const allowed = (process.env.REVENUECAT_ALLOWED_ENTITLEMENTS || DEFAULT_ENTITLEMENT)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return typeof entitlementId === 'string' && allowed.includes(entitlementId);
}

function derivePrimaryPlatform(user) {
  const stripeActive = !!user.stripe_subscription_id;
  const appleActive = !!user.apple_subscription_active;

  if (stripeActive && appleActive) {
    return user.subscription_platform === 'apple' ? 'apple' : 'stripe';
  }
  if (appleActive) return 'apple';
  if (stripeActive) return 'stripe';
  return null;
}

export function projectBillingState(user) {
  const primaryPlatform = derivePrimaryPlatform(user);

  if (!primaryPlatform) {
    return {
      plan: 'free',
      subscriptionPlatform: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
    };
  }

  if (primaryPlatform === 'apple') {
    return {
      plan: 'pro',
      subscriptionPlatform: 'apple',
      cancelAtPeriodEnd: !!user.apple_cancel_at_period_end,
      cancelAt: user.apple_cancel_at || user.apple_expires_at || null,
    };
  }

  return {
    plan: 'pro',
    subscriptionPlatform: 'stripe',
    cancelAtPeriodEnd: !!user.stripe_cancel_at_period_end,
    cancelAt: user.stripe_cancel_at || null,
  };
}

export async function reconcileUserBillingState(client, userId) {
  const { rows } = await client.query(
    `SELECT id, plan, trial_ends_at, subscription_platform, stripe_subscription_id,
            stripe_cancel_at_period_end, stripe_cancel_at,
            apple_subscription_active, apple_product_id, apple_cancel_at_period_end, apple_cancel_at, apple_expires_at
     FROM users
     WHERE id = $1
     FOR UPDATE`,
    [userId]
  );

  const user = rows[0];
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const projected = projectBillingState(user);

  const { rows: [updated] } = await client.query(
    `UPDATE users
     SET plan = $2,
         subscription_platform = $3,
         cancel_at_period_end = $4,
         cancel_at = $5,
         trial_ends_at = CASE WHEN $2 = 'pro' THEN NULL ELSE trial_ends_at END
     WHERE id = $1
     RETURNING plan`,
    [userId, projected.plan, projected.subscriptionPlatform, projected.cancelAtPeriodEnd, projected.cancelAt]
  );

  if (user.plan === 'pro' && updated.plan === 'free') {
    await client.query(
      `UPDATE marketplace_listings
       SET status = 'delisted', updated_at = NOW()
       WHERE seller_id = $1 AND status IN ('active', 'pending_review')`,
      [userId]
    );
  }

  return projected;
}

export async function fetchRevenueCatSubscriber(appUserId) {
  if (!process.env.REVENUECAT_SECRET_API_KEY) {
    throw Object.assign(new Error('RevenueCat secret API key is not configured'), { status: 500 });
  }

  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw Object.assign(
      new Error(`RevenueCat subscriber lookup failed (${response.status})${text ? `: ${text}` : ''}`),
      { status: 502 }
    );
  }

  const data = await response.json();
  return data.subscriber || null;
}

export function getRevenueCatProductStateFromSubscriber(subscriber) {
  if (!subscriber || typeof subscriber !== 'object') {
    return {
      active: false,
      entitlementId: null,
      productId: null,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      lastSyncedAt: new Date(),
    };
  }

  const entitlements = Object.entries(subscriber.entitlements || {});
  const activeEntitlement = entitlements.find(([entitlementId, value]) => {
    const expiresAt = parseDate(value?.expires_date);
    return isAllowedRevenueCatEntitlement(entitlementId) && (!expiresAt || expiresAt > new Date());
  });

  if (!activeEntitlement) {
    return {
      active: false,
      entitlementId: null,
      productId: null,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      lastSyncedAt: new Date(),
    };
  }

  const [entitlementId, entitlement] = activeEntitlement;
  const productId = entitlement.product_identifier || null;

  if (!isAllowedRevenueCatProduct(productId)) {
    return {
      active: false,
      entitlementId: null,
      productId: null,
      expiresAt: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      lastSyncedAt: new Date(),
    };
  }

  const subscription = subscriber.subscriptions?.[productId] || {};
  const expiresAt = parseDate(subscription.expires_date || entitlement.expires_date);
  const unsubscribeDetectedAt = parseDate(subscription.unsubscribe_detected_at);

  return {
    active: !expiresAt || expiresAt > new Date(),
    entitlementId,
    productId,
    expiresAt,
    cancelAtPeriodEnd: !!unsubscribeDetectedAt,
    cancelAt: unsubscribeDetectedAt || expiresAt,
    lastSyncedAt: new Date(),
  };
}

export async function syncRevenueCatStateForUser(client, userId, subscriber) {
  const state = getRevenueCatProductStateFromSubscriber(subscriber);

  await client.query(
    `UPDATE users
     SET revenuecat_app_user_id = COALESCE(revenuecat_app_user_id, $2),
         apple_subscription_active = $3,
         apple_entitlement_id = $4,
         apple_product_id = $5,
         apple_expires_at = $6,
         apple_cancel_at_period_end = $7,
         apple_cancel_at = $8,
         apple_last_synced_at = $9
     WHERE id = $1`,
    [
      userId,
      userId,
      state.active,
      state.entitlementId,
      state.productId,
      toIso(state.expiresAt),
      state.cancelAtPeriodEnd,
      toIso(state.cancelAt),
      toIso(state.lastSyncedAt),
    ]
  );

  return reconcileUserBillingState(client, userId);
}

export async function applyRevenueCatWebhookPayload(client, payload) {
  const event = payload?.event || payload;
  const userId = event?.app_user_id;
  if (!userId) {
    throw Object.assign(new Error('RevenueCat webhook missing app_user_id'), { status: 400 });
  }

  const eventId = event.id || event.event_id;
  if (eventId) {
    const { rowCount } = await client.query(
      `INSERT INTO revenuecat_webhook_events (event_id, event_type, app_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, event.type || 'unknown', userId]
    );
    if (rowCount === 0) {
      return { deduped: true };
    }
  }

  if (process.env.REVENUECAT_SECRET_API_KEY) {
    const subscriber = await fetchRevenueCatSubscriber(userId);
    await syncRevenueCatStateForUser(client, userId, subscriber);
    return { deduped: false, reconciled: true };
  }

  const productId = event.product_id || event.new_product_id || null;
  if (productId && !isAllowedRevenueCatProduct(productId)) {
    return { deduped: false, skipped: true };
  }

  const expiresAt = parseDate(event.expiration_at_ms ? Number(event.expiration_at_ms) : event.expires_at);
  const isActiveEvent = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE'].includes(event.type);
  const isCancelEvent = event.type === 'CANCELLATION';
  const isExpiredEvent = event.type === 'EXPIRATION';

  await client.query(
    `UPDATE users
     SET revenuecat_app_user_id = COALESCE(revenuecat_app_user_id, $2),
         apple_subscription_active = $3,
         apple_entitlement_id = $4,
         apple_product_id = $5,
         apple_expires_at = $6,
         apple_cancel_at_period_end = $7,
         apple_cancel_at = $8,
         apple_last_synced_at = $9
     WHERE id = $1`,
    [
      userId,
      userId,
      isActiveEvent,
      isExpiredEvent ? null : event.entitlement_id || null,
      isExpiredEvent ? null : productId,
      toIso(expiresAt),
      isCancelEvent,
      isCancelEvent ? toIso(expiresAt) : null,
      new Date().toISOString(),
    ]
  );

  await reconcileUserBillingState(client, userId);
  return { deduped: false, reconciled: true };
}
