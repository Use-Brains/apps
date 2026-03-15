import { beforeEach, describe, expect, it, vi } from 'vitest';

const { platformMock, purchasesMock } = vi.hoisted(() => ({
  platformMock: { OS: 'ios' },
  purchasesMock: {
    configure: vi.fn(),
    setLogLevel: vi.fn(),
    logIn: vi.fn(),
    logOut: vi.fn(),
    getOfferings: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
    getCustomerInfo: vi.fn(),
    LOG_LEVEL: {
      WARN: 'WARN',
    },
  },
}));

vi.mock('react-native', () => ({
  Platform: platformMock,
}));

vi.mock('react-native-purchases', () => ({
  default: purchasesMock,
  LOG_LEVEL: purchasesMock.LOG_LEVEL,
}));

async function loadModule() {
  return import('../../src/lib/subscriptions');
}

describe('subscription identity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    platformMock.OS = 'ios';
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = 'ios_key';
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT = 'pro';
  });

  it('configures purchases once for the first authenticated user', async () => {
    const { initializeSubscriptionIdentity } = await loadModule();

    await initializeSubscriptionIdentity('user-1');
    await initializeSubscriptionIdentity('user-1');

    expect(purchasesMock.configure).toHaveBeenCalledTimes(1);
    expect(purchasesMock.configure).toHaveBeenCalledWith({
      apiKey: 'ios_key',
      appUserID: 'user-1',
    });
    expect(purchasesMock.logIn).not.toHaveBeenCalled();
  });

  it('logs in when the authenticated user changes after initial configuration', async () => {
    const { initializeSubscriptionIdentity } = await loadModule();

    await initializeSubscriptionIdentity('user-1');
    await initializeSubscriptionIdentity('user-2');

    expect(purchasesMock.logIn).toHaveBeenCalledTimes(1);
    expect(purchasesMock.logIn).toHaveBeenCalledWith('user-2');
  });

  it('reports an active entitlement only when the configured entitlement is present', async () => {
    const { hasActiveProEntitlement } = await loadModule();

    expect(hasActiveProEntitlement({
      entitlements: {
        active: {
          pro: { identifier: 'pro' },
        },
      },
    } as never)).toBe(true);

    expect(hasActiveProEntitlement({
      entitlements: {
        active: {
          other: { identifier: 'other' },
        },
      },
    } as never)).toBe(false);
  });
});
