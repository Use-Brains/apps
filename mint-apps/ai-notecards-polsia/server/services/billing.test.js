import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRevenueCatWebhookPayload,
  calculatePlatformFeeCents,
  getPlatformFeeRate,
  getRevenueCatProductStateFromSubscriber,
  projectBillingState,
  syncRevenueCatStateForUser,
} from './billing.js';

function withEnv(values, fn) {
  const previous = new Map();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of previous.entries()) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
}

test('projectBillingState keeps user pro when Apple is active and Stripe is cancelled', () => {
  const projected = projectBillingState({
    subscription_platform: 'apple',
    stripe_subscription_id: 'sub_123',
    stripe_cancel_at_period_end: true,
    stripe_cancel_at: '2026-03-31T00:00:00.000Z',
    apple_subscription_active: true,
    apple_cancel_at_period_end: false,
    apple_cancel_at: null,
    apple_expires_at: '2026-04-30T00:00:00.000Z',
  });

  assert.deepEqual(projected, {
    plan: 'pro',
    subscriptionPlatform: 'apple',
    cancelAtPeriodEnd: false,
    cancelAt: '2026-04-30T00:00:00.000Z',
  });
});

test('getPlatformFeeRate defaults to 50/50 and respects env overrides', async () => {
  await withEnv(
    {
      MARKETPLACE_PLATFORM_FEE_RATE: undefined,
    },
    () => {
      assert.equal(getPlatformFeeRate(), 0.5);
      assert.equal(calculatePlatformFeeCents(500), 250);
    }
  );

  await withEnv(
    {
      MARKETPLACE_PLATFORM_FEE_RATE: '0.35',
    },
    () => {
      assert.equal(getPlatformFeeRate(), 0.35);
      assert.equal(calculatePlatformFeeCents(500), 175);
    }
  );
});

test('getRevenueCatProductStateFromSubscriber ignores unknown product ids', async () => {
  await withEnv(
    {
      REVENUECAT_ALLOWED_ENTITLEMENTS: 'pro',
      REVENUECAT_APPLE_MONTHLY_PRODUCT_ID: 'pro_monthly',
      REVENUECAT_APPLE_ANNUAL_PRODUCT_ID: 'pro_annual',
    },
    () => {
      const state = getRevenueCatProductStateFromSubscriber({
        entitlements: {
          pro: {
            product_identifier: 'unexpected_product',
            expires_date: '2099-01-01T00:00:00.000Z',
          },
        },
        subscriptions: {
          unexpected_product: {
            expires_date: '2099-01-01T00:00:00.000Z',
          },
        },
      });

      assert.equal(state.active, false);
      assert.equal(state.productId, null);
    }
  );
});

test('syncRevenueCatStateForUser persists Apple entitlement metadata for support and debugging', async () => {
  await withEnv(
    {
      REVENUECAT_ALLOWED_ENTITLEMENTS: 'pro',
      REVENUECAT_APPLE_MONTHLY_PRODUCT_ID: 'pro_monthly',
      REVENUECAT_APPLE_ANNUAL_PRODUCT_ID: 'pro_annual',
    },
    async () => {
      const calls = [];
      const client = {
        async query(sql, params) {
          calls.push({ sql, params });

          if (sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: 'user-1',
                plan: 'free',
                trial_ends_at: null,
                subscription_platform: null,
                stripe_subscription_id: null,
                stripe_cancel_at_period_end: false,
                stripe_cancel_at: null,
                apple_subscription_active: false,
                apple_product_id: null,
                apple_cancel_at_period_end: false,
                apple_cancel_at: null,
                apple_expires_at: null,
              }],
            };
          }

          if (sql.includes('RETURNING plan')) {
            return { rows: [{ plan: 'pro' }] };
          }

          return { rows: [], rowCount: 1 };
        },
      };

      await syncRevenueCatStateForUser(client, 'user-1', {
        entitlements: {
          pro: {
            product_identifier: 'pro_annual',
            expires_date: '2099-01-01T00:00:00.000Z',
          },
        },
        subscriptions: {
          pro_annual: {
            expires_date: '2099-01-01T00:00:00.000Z',
          },
        },
      });

      const updateCall = calls.find((entry) => entry.sql.includes('SET revenuecat_app_user_id'));
      assert.ok(updateCall, 'expected RevenueCat sync update query');
      assert.match(updateCall.sql, /apple_entitlement_id/);
      assert.match(updateCall.sql, /apple_last_synced_at/);
      assert.equal(updateCall.params[3], 'pro');
      assert.equal(updateCall.params[4], 'pro_annual');
    }
  );
});

test('applyRevenueCatWebhookPayload dedupes replayed events', async () => {
  await withEnv(
    {
      REVENUECAT_SECRET_API_KEY: undefined,
      REVENUECAT_ALLOWED_ENTITLEMENTS: 'pro',
      REVENUECAT_APPLE_MONTHLY_PRODUCT_ID: 'pro_monthly',
      REVENUECAT_APPLE_ANNUAL_PRODUCT_ID: 'pro_annual',
    },
    async () => {
      let insertAttempts = 0;
      const client = {
        async query(sql) {
          if (sql.includes('INSERT INTO revenuecat_webhook_events')) {
            insertAttempts += 1;
            return { rowCount: insertAttempts === 1 ? 1 : 0, rows: [] };
          }

          throw new Error(`Unexpected query in dedupe test: ${sql}`);
        },
      };

      const first = await applyRevenueCatWebhookPayload(client, {
        event: {
          id: 'evt_1',
          app_user_id: 'user-1',
          type: 'INITIAL_PURCHASE',
          product_id: 'pro_monthly',
        },
      }).catch(() => ({ deduped: false }));

      const second = await applyRevenueCatWebhookPayload(client, {
        event: {
          id: 'evt_1',
          app_user_id: 'user-1',
          type: 'INITIAL_PURCHASE',
          product_id: 'pro_monthly',
        },
      });

      assert.equal(first.deduped, false);
      assert.equal(second.deduped, true);
    }
  );
});
