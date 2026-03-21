import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildClientUrl,
  getClientBuildConfig,
  getFeatureAvailability,
  getFeatureFlags,
  getMarketplacePurchaseAvailability,
  getRuntimeConfig,
  getStorageConfig,
} from './runtime.js';

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

test('getFeatureFlags uses safe defaults and respects explicit false values', async () => {
  await withEnv(
    {
      FEATURE_SELLER_TOOLS: 'false',
      FEATURE_NATIVE_BILLING: 'false',
      FEATURE_NATIVE_AUTH_SESSIONS: undefined,
    },
    () => {
      const flags = getFeatureFlags();
      assert.equal(flags.sellerTools, false);
      assert.equal(flags.nativeBilling, false);
      assert.equal(flags.nativeAuthSessions, true);
    }
  );
});

test('getFeatureFlags defaults seller tools off in the handoff runtime', async () => {
  await withEnv(
    {
      FEATURE_SELLER_TOOLS: undefined,
    },
    () => {
      const flags = getFeatureFlags();
      assert.equal(flags.sellerTools, false);
    }
  );
});

test('getStorageConfig infers supabase provider and supports public base override', async () => {
  await withEnv(
    {
      STORAGE_PROVIDER: undefined,
      STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com/public',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    },
    () => {
      const storage = getStorageConfig();
      assert.equal(storage.provider, 'supabase');
      assert.equal(storage.publicBaseUrl, 'https://cdn.example.com/public');
      assert.equal(storage.isConfigured, true);
    }
  );
});

test('getRuntimeConfig exposes client url and nested runtime sections', async () => {
  await withEnv(
    {
      CLIENT_URL: 'https://app.example.com',
      FEATURE_PUSH_NOTIFICATIONS: 'false',
    },
    () => {
      const runtime = getRuntimeConfig();
      assert.equal(runtime.clientUrl, 'https://app.example.com');
      assert.equal(runtime.features.pushNotifications, false);
      assert.ok(runtime.storage);
    }
  );
});

test('buildClientUrl uses the shared public app url with normalized paths and query params', async () => {
  await withEnv(
    {
      CLIENT_URL: 'https://app.example.com/',
    },
    () => {
      const url = buildClientUrl('/dashboard', {
        query: {
          purchased: true,
          source: 'checkout',
        },
      });

      assert.equal(url, 'https://app.example.com/dashboard?purchased=true&source=checkout');
    }
  );
});

test('getClientBuildConfig is opt-in and preserves explicit dist path overrides', async () => {
  await withEnv(
    {
      SERVE_CLIENT_BUILD: 'true',
      CLIENT_DIST_PATH: '/srv/polsia/client-dist',
    },
    () => {
      const config = getClientBuildConfig();
      assert.equal(config.enabled, true);
      assert.equal(config.distPath, '/srv/polsia/client-dist');
    }
  );
});

test('getClientBuildConfig defaults unified serving on when env is unset', async () => {
  await withEnv(
    {
      SERVE_CLIENT_BUILD: undefined,
      CLIENT_DIST_PATH: undefined,
    },
    () => {
      const config = getClientBuildConfig();
      assert.equal(config.enabled, true);
      assert.equal(config.distPath, null);
    }
  );
});

test('getMarketplacePurchaseAvailability disables iOS purchase handoff when env flag is false', async () => {
  await withEnv(
    {
      IOS_MARKETPLACE_WEB_PURCHASES_ENABLED: 'false',
    },
    () => {
      const availability = getMarketplacePurchaseAvailability();
      assert.equal(availability.ios_native.enabled, false);
      assert.equal(availability.ios_native.code, 'IOS_MARKETPLACE_WEB_PURCHASES_DISABLED');
      assert.match(availability.ios_native.message, /temporarily disabled/i);
    }
  );
});

test('getFeatureAvailability exposes a consistent disabled payload for seller tools', async () => {
  await withEnv(
    {
      FEATURE_SELLER_TOOLS: 'false',
    },
    () => {
      const availability = getFeatureAvailability('sellerTools');
      assert.equal(availability.enabled, false);
      assert.equal(availability.code, 'SELLER_TOOLS_DISABLED');
      assert.match(availability.message, /seller/i);
    }
  );
});
