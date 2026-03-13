import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Purchases, { type CustomerInfo } from 'react-native-purchases';
import {
  ENTITLEMENT_ID,
  PAYWALL_RESULT,
  getCustomerInfo,
  hasEntitlement,
  presentCustomerCenter,
  presentPaywallIfNeeded,
  purchaseByPackageId,
  restorePurchases,
  type RevenueCatPackageId,
} from '@/lib/revenuecat';

function isPurchaseCancelled(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {
    userCancelled?: boolean;
    code?: number;
  };

  return (
    maybeError.userCancelled === true ||
    maybeError.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

export function useSubscription() {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const info = await getCustomerInfo();
    setCustomerInfo(info);
    return info;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const nativeSupported = Platform.OS === 'ios' || Platform.OS === 'android';

    const listener = (updatedInfo: CustomerInfo) => {
      if (isMounted) {
        setCustomerInfo(updatedInfo);
      }
    };

    if (nativeSupported) {
      Purchases.addCustomerInfoUpdateListener(listener);
    }

    refresh()
      .catch((error) => {
        console.warn('[RevenueCat] Failed to load customer info', error);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (nativeSupported) {
        Purchases.removeCustomerInfoUpdateListener(listener);
      }
    };
  }, [refresh]);

  const buy = useCallback(async (packageId: RevenueCatPackageId) => {
    setBusy(true);

    try {
      const info = await purchaseByPackageId(packageId);
      setCustomerInfo(info);
      return info;
    } catch (error) {
      if (!isPurchaseCancelled(error)) {
        const maybeError = error as { code?: number };

        if (
          maybeError.code ===
          Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR
        ) {
          const restoredInfo = await restorePurchases();
          setCustomerInfo(restoredInfo);
          return restoredInfo;
        }

        if (
          maybeError.code ===
          Purchases.PURCHASES_ERROR_CODE.NETWORK_ERROR
        ) {
          Alert.alert('Network error', 'Check your internet connection and try again.');
        } else if (
          maybeError.code ===
          Purchases.PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR
        ) {
          Alert.alert('Purchases unavailable', 'In-app purchases are disabled on this device.');
        } else {
          Alert.alert('Purchase failed', getErrorMessage(error, 'Unable to complete purchase.'));
        }
      }
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setBusy(true);

    try {
      const info = await restorePurchases();
      setCustomerInfo(info);

      if (hasEntitlement(info)) {
        Alert.alert('Restored', 'Your purchases were restored successfully.');
      } else {
        Alert.alert('No active subscription', 'No active purchases were found to restore.');
      }

      return info;
    } catch (error) {
      Alert.alert('Restore failed', getErrorMessage(error, 'Unable to restore purchases.'));
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const showPaywall = useCallback(async () => {
    setBusy(true);

    try {
      const result = await presentPaywallIfNeeded();
      await refresh();

      if (result === PAYWALL_RESULT.ERROR) {
        Alert.alert('Paywall error', 'Unable to present subscription options right now.');
      }

      return result;
    } catch (error) {
      Alert.alert('Paywall error', getErrorMessage(error, 'Unable to present paywall.'));
      return PAYWALL_RESULT.ERROR;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const openCustomerCenter = useCallback(async () => {
    setBusy(true);

    try {
      await presentCustomerCenter();
      await refresh();
    } catch (error) {
      Alert.alert(
        'Unable to open subscriptions',
        getErrorMessage(error, 'Please try again in a moment.'),
      );
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const activeEntitlement = useMemo(
    () => customerInfo?.entitlements.active[ENTITLEMENT_ID] ?? null,
    [customerInfo],
  );

  return {
    loading,
    busy,
    customerInfo,
    activeEntitlement,
    isMakeWayBetterTradesActive: hasEntitlement(customerInfo),
    refresh,
    buy,
    restore,
    showPaywall,
    openCustomerCenter,
  };
}
