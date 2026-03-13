import { beforeEach, describe, expect, it, vi } from 'vitest';

const { purchasesMock, purchasesUIMock, platformMock } = vi.hoisted(() => {
  return {
    platformMock: { OS: 'ios' },
    purchasesMock: {
      configure: vi.fn(),
      setLogLevel: vi.fn(),
      logIn: vi.fn(),
      logOut: vi.fn(),
      getCustomerInfo: vi.fn(),
      getOfferings: vi.fn(),
      purchasePackage: vi.fn(),
      restorePurchases: vi.fn(),
      LOG_LEVEL: {
        DEBUG: 'DEBUG',
      },
    },
    purchasesUIMock: {
      presentPaywall: vi.fn(),
      presentPaywallIfNeeded: vi.fn(),
      presentCustomerCenter: vi.fn(),
      PAYWALL_RESULT: {
        ERROR: 'ERROR',
        NOT_PRESENTED: 'NOT_PRESENTED',
      },
    },
  };
});

vi.mock('react-native', () => ({
  Platform: platformMock,
}));

vi.mock('react-native-purchases', () => ({
  default: purchasesMock,
}));

vi.mock('react-native-purchases-ui', () => ({
  default: purchasesUIMock,
  PAYWALL_RESULT: purchasesUIMock.PAYWALL_RESULT,
}));

async function loadModule() {
  return import('../../src/lib/revenuecat');
}

describe('revenuecat lib', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    platformMock.OS = 'ios';
    process.env.EXPO_PUBLIC_RC_TEST_API_KEY = 'test_key';
    process.env.EXPO_PUBLIC_RC_IOS_API_KEY = '';
    process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY = '';
    process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID = 'make_way_better_trades';
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;

    purchasesMock.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          { identifier: 'monthly', product: { title: 'Monthly' } },
          { identifier: 'yearly', product: { title: 'Yearly' } },
          { identifier: 'lifetime', product: { title: 'Lifetime' } },
        ],
      },
    });
  });

  it('configures purchases once with ios key preference', async () => {
    process.env.EXPO_PUBLIC_RC_IOS_API_KEY = 'ios_key';

    const { initRevenueCat } = await loadModule();
    initRevenueCat('user-1');
    initRevenueCat('user-2');

    expect(purchasesMock.configure).toHaveBeenCalledTimes(1);
    expect(purchasesMock.configure).toHaveBeenCalledWith({
      apiKey: 'ios_key',
      appUserID: 'user-1',
    });
  });

  it('logs in and logs out with identity sync', async () => {
    const customerInfo = { originalAppUserId: 'abc123', entitlements: { active: {} } };
    purchasesMock.getCustomerInfo.mockResolvedValue(customerInfo);

    const { syncRevenueCatIdentity } = await loadModule();

    const loginInfo = await syncRevenueCatIdentity('abc123');
    expect(purchasesMock.logIn).toHaveBeenCalledWith('abc123');
    expect(loginInfo).toBe(customerInfo);

    const logoutInfo = await syncRevenueCatIdentity(null);
    expect(purchasesMock.logOut).toHaveBeenCalled();
    expect(logoutInfo).toBe(customerInfo);
  });

  it('skips logOut when current user is already anonymous', async () => {
    const anonymousCustomerInfo = {
      originalAppUserId: '$RCAnonymousID:somerandombits',
      entitlements: { active: {} },
    };
    purchasesMock.getCustomerInfo.mockResolvedValue(anonymousCustomerInfo);
    purchasesMock.logOut.mockClear();

    const { syncRevenueCatIdentity } = await loadModule();

    await syncRevenueCatIdentity(null);
    expect(purchasesMock.logOut).not.toHaveBeenCalled();
  });

  it('maps packages by monthly yearly lifetime identifiers', async () => {
    const { getPackages } = await loadModule();
    const packages = await getPackages();

    expect((packages?.monthly as { identifier?: string } | null)?.identifier).toBe('monthly');
    expect((packages?.yearly as { identifier?: string } | null)?.identifier).toBe('yearly');
    expect((packages?.lifetime as { identifier?: string } | null)?.identifier).toBe('lifetime');
  });

  it('passes required entitlement when presenting paywall if needed', async () => {
    purchasesUIMock.presentPaywallIfNeeded.mockResolvedValue('NOT_PRESENTED');

    const { presentPaywallIfNeeded } = await loadModule();
    await presentPaywallIfNeeded();

    expect(purchasesUIMock.presentPaywallIfNeeded).toHaveBeenCalledWith({
      requiredEntitlementIdentifier: 'make_way_better_trades',
    });
  });

  it('throws when package identifier is missing from offerings', async () => {
    purchasesMock.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [{ identifier: 'monthly' }],
      },
    });

    const { purchaseByPackageId } = await loadModule();

    await expect(purchaseByPackageId('yearly')).rejects.toThrow('Package not found: yearly');
  });
});
