const DEFAULT_CLIENT_URL = 'http://localhost:5173';
const DEFAULT_STORAGE_PROVIDER = 'none';

function parseBooleanFlag(value, defaultValue = true) {
  if (value === undefined) return defaultValue;
  return value !== 'false';
}

function normalizeBaseUrl(value, fallback = DEFAULT_CLIENT_URL) {
  return (value || fallback).replace(/\/+$/, '');
}

export function getFeatureFlags(env = process.env) {
  return {
    sellerTools: parseBooleanFlag(env.FEATURE_SELLER_TOOLS, false),
    nativeAuthSessions: parseBooleanFlag(env.FEATURE_NATIVE_AUTH_SESSIONS, true),
    nativeBilling: parseBooleanFlag(env.FEATURE_NATIVE_BILLING, true),
    pushNotifications: parseBooleanFlag(env.FEATURE_PUSH_NOTIFICATIONS, true),
  };
}

export function getStorageConfig(env = process.env) {
  const inferredProvider = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? 'supabase'
    : DEFAULT_STORAGE_PROVIDER;
  const provider = env.STORAGE_PROVIDER || inferredProvider;
  const publicBaseUrl = env.STORAGE_PUBLIC_BASE_URL
    || (provider === 'supabase' && env.SUPABASE_URL
      ? `${env.SUPABASE_URL}/storage/v1/object/public`
      : null);

  return {
    provider,
    publicBaseUrl,
    supabaseUrl: env.SUPABASE_URL || null,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || null,
    isConfigured: provider !== 'none' && !!publicBaseUrl,
  };
}

export function getMarketplacePurchaseAvailability(env = process.env) {
  const iosNativeWebCheckoutEnabled = parseBooleanFlag(env.IOS_MARKETPLACE_WEB_PURCHASES_ENABLED, true);

  return {
    ios_native: {
      enabled: iosNativeWebCheckoutEnabled,
      code: iosNativeWebCheckoutEnabled ? null : 'IOS_MARKETPLACE_WEB_PURCHASES_DISABLED',
      message: iosNativeWebCheckoutEnabled
        ? null
        : 'Marketplace purchases are temporarily disabled in the iOS app.',
    },
  };
}

export function getFeatureAvailability(featureKey, env = process.env) {
  const features = getFeatureFlags(env);
  const enabled = !!features[featureKey];

  const metadata = {
    sellerTools: {
      code: 'SELLER_TOOLS_DISABLED',
      message: 'Seller tools are disabled in this deployment.',
    },
    nativeAuthSessions: {
      code: 'NATIVE_AUTH_SESSIONS_DISABLED',
      message: 'Native auth sessions are disabled in this deployment.',
    },
    nativeBilling: {
      code: 'NATIVE_BILLING_DISABLED',
      message: 'Native billing is disabled in this deployment.',
    },
    pushNotifications: {
      code: 'PUSH_NOTIFICATIONS_DISABLED',
      message: 'Push notifications are disabled in this deployment.',
    },
  }[featureKey];

  if (!metadata) {
    throw new Error(`Unknown feature key: ${featureKey}`);
  }

  return {
    enabled,
    code: enabled ? null : metadata.code,
    message: enabled ? null : metadata.message,
  };
}

export function buildClientUrl(pathname = '/', options = {}, env = process.env) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const url = new URL(normalizedPath, `${normalizeBaseUrl(env.CLIENT_URL)}/`);

  if (options.query && typeof options.query === 'object') {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export function getClientBuildConfig(env = process.env) {
  return {
    enabled: parseBooleanFlag(env.SERVE_CLIENT_BUILD, true),
    distPath: env.CLIENT_DIST_PATH || null,
  };
}

export function getRuntimeConfig(env = process.env) {
  return {
    clientUrl: normalizeBaseUrl(env.CLIENT_URL),
    features: getFeatureFlags(env),
    storage: getStorageConfig(env),
    marketplace: {
      purchaseAvailability: getMarketplacePurchaseAvailability(env),
    },
    deployment: {
      clientBuild: getClientBuildConfig(env),
    },
  };
}
