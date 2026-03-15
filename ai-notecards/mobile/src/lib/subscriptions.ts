import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

const IOS_REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ENTITLEMENT = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT || 'pro';

let configuredUserId: string | null = null;
let configured = false;

export function canUseRevenueCat() {
  return Platform.OS === 'ios' && !!IOS_REVENUECAT_API_KEY;
}

export async function initializeSubscriptionIdentity(userId: string) {
  if (!canUseRevenueCat() || !IOS_REVENUECAT_API_KEY) return false;

  Purchases.setLogLevel(LOG_LEVEL.WARN);

  if (!configured) {
    Purchases.configure({ apiKey: IOS_REVENUECAT_API_KEY, appUserID: userId });
    configured = true;
    configuredUserId = userId;
    return true;
  }

  if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }

  return true;
}

export async function resetSubscriptionIdentity() {
  if (!canUseRevenueCat() || !configured) return;
  await Purchases.logOut();
  configuredUserId = null;
}

export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  if (!canUseRevenueCat()) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

export async function purchaseSubscription(aPackage: PurchasesPackage): Promise<CustomerInfo> {
  const result = await Purchases.purchasePackage(aPackage);
  return result.customerInfo;
}

export async function restoreSubscriptions(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!canUseRevenueCat()) return null;
  return Purchases.getCustomerInfo();
}

export function hasActiveProEntitlement(customerInfo: CustomerInfo | null) {
  if (!customerInfo) return false;
  return !!customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT];
}
