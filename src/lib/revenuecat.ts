import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

const DEFAULT_ENTITLEMENT_ID = 'make_way_better_trades';

export const ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT_ID ?? DEFAULT_ENTITLEMENT_ID;

export const PACKAGE_IDS = {
  monthly: 'monthly',
  yearly: 'yearly',
  lifetime: 'lifetime',
} as const;

export type RevenueCatPackageId = keyof typeof PACKAGE_IDS;

let configured = false;

function isNativePurchasesPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getRevenueCatApiKey() {
  const testKey = process.env.EXPO_PUBLIC_RC_TEST_API_KEY;

  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_RC_IOS_API_KEY || testKey;
  }

  if (Platform.OS === 'android') {
    return process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY || testKey;
  }

  return testKey;
}

function assertNativeSupport() {
  if (!isNativePurchasesPlatform()) {
    throw new Error('RevenueCat is only supported on iOS and Android in this app.');
  }
}

export function initRevenueCat(appUserID?: string | null) {
  if (!isNativePurchasesPlatform() || configured) {
    return;
  }

  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    throw new Error('Missing RevenueCat API key. Set EXPO_PUBLIC_RC_TEST_API_KEY or platform-specific keys.');
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey,
    appUserID: appUserID ?? null,
  });

  configured = true;
}

export async function syncRevenueCatIdentity(appUserID: string | null) {
  if (!isNativePurchasesPlatform()) {
    return null;
  }

  if (appUserID) {
    await Purchases.logIn(appUserID);
  } else {
    const currentInfo = await Purchases.getCustomerInfo();
    if (!currentInfo.originalAppUserId.startsWith('$RCAnonymousID')) {
      await Purchases.logOut();
    }
  }

  return Purchases.getCustomerInfo();
}

export function hasEntitlement(customerInfo: CustomerInfo | null | undefined) {
  return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);
}

export async function getCustomerInfo() {
  if (!isNativePurchasesPlatform()) {
    return null;
  }

  return Purchases.getCustomerInfo();
}

export async function getPackages() {
  if (!isNativePurchasesPlatform()) {
    return null;
  }

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;

  if (!current) {
    return null;
  }

  const byIdentifier = new Map(
    current.availablePackages.map((pkg: { identifier: string }) => [pkg.identifier, pkg]),
  );

  return {
    monthly: byIdentifier.get(PACKAGE_IDS.monthly) ?? null,
    yearly: byIdentifier.get(PACKAGE_IDS.yearly) ?? null,
    lifetime: byIdentifier.get(PACKAGE_IDS.lifetime) ?? null,
    all: current.availablePackages,
  };
}

export async function purchasePackage(pkg: PurchasesPackage) {
  assertNativeSupport();
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function purchaseByPackageId(packageId: RevenueCatPackageId) {
  const packages = await getPackages();

  if (!packages) {
    throw new Error('No active RevenueCat offering found.');
  }

  const selectedPackage = packages[packageId];

  if (!selectedPackage) {
    throw new Error(`Package not found: ${packageId}`);
  }

  return purchasePackage(selectedPackage);
}

export async function restorePurchases() {
  assertNativeSupport();
  return Purchases.restorePurchases();
}

export async function presentPaywallIfNeeded() {
  if (!isNativePurchasesPlatform()) {
    return PAYWALL_RESULT.NOT_PRESENTED;
  }

  return RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ENTITLEMENT_ID,
  });
}

export async function presentPaywall() {
  if (!isNativePurchasesPlatform()) {
    return PAYWALL_RESULT.NOT_PRESENTED;
  }

  return RevenueCatUI.presentPaywall();
}

export async function presentCustomerCenter() {
  assertNativeSupport();
  await RevenueCatUI.presentCustomerCenter();
}

export { PAYWALL_RESULT };
