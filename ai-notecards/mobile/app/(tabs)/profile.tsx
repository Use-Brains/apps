import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { canUseRevenueCat, getAvailablePackages, hasActiveProEntitlement, purchaseSubscription, restoreSubscriptions } from '@/lib/subscriptions';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import type { PurchasesPackage } from 'react-native-purchases';

export default function ProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { biometricEnabled, enableBiometricLock, disableBiometricLock, logout, user, refreshUser } = useAuth();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [billingBusy, setBillingBusy] = useState(false);
  const subscriptionPlatform = user?.subscriptionPlatform;

  const handleToggleBiometric = async (enabled: boolean) => {
    if (!enabled) {
      disableBiometricLock();
      return;
    }

    await enableBiometricLock();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      Alert.alert('Logout failed', error instanceof Error ? error.message : 'Please try again');
    }
  };

  useEffect(() => {
    if (!user?.id || !canUseRevenueCat()) return;

    void (async () => {
      try {
        setPackages(await getAvailablePackages());
      } catch {
        setPackages([]);
      }
    })();
  }, [user?.id]);

  const subscriptionPackages = useMemo(() => ({
    monthly: packages.find((entry) => entry.packageType === 'MONTHLY'),
    annual: packages.find((entry) => entry.packageType === 'ANNUAL'),
  }), [packages]);

  const handlePurchase = async (pkg: PurchasesPackage | undefined) => {
    if (!pkg) {
      Alert.alert('Unavailable', 'Subscription packages are not configured yet.');
      return;
    }

    setBillingBusy(true);
    try {
      const customerInfo = await purchaseSubscription(pkg);
      if (!hasActiveProEntitlement(customerInfo)) {
        throw new Error('Purchase completed but no active Pro entitlement was found.');
      }
      await api.reconcileRevenueCat();
      await refreshUser();
      Alert.alert('Pro unlocked', 'Your subscription is active.');
    } catch (error) {
      Alert.alert('Purchase failed', error instanceof Error ? error.message : 'Unable to complete purchase');
    } finally {
      setBillingBusy(false);
    }
  };

  const handleRestore = async () => {
    setBillingBusy(true);
    try {
      const customerInfo = await restoreSubscriptions();
      if (!hasActiveProEntitlement(customerInfo)) {
        Alert.alert('Nothing to restore', 'No active Apple subscription was found for this Apple ID.');
        return;
      }
      await api.reconcileRevenueCat();
      await refreshUser();
      Alert.alert('Restored', 'Your subscription has been restored.');
    } catch (error) {
      Alert.alert('Restore failed', error instanceof Error ? error.message : 'Unable to restore purchases');
    } finally {
      setBillingBusy(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setBillingBusy(true);
      if (subscriptionPlatform === 'apple') {
        await Linking.openURL('https://apps.apple.com/account/subscriptions');
        return;
      }

      const data = await api.createBillingPortal();
      await Linking.openURL(data.url);
    } catch (error) {
      Alert.alert('Unable to open billing', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setBillingBusy(false);
    }
  };

  const handleUpgradeOnWeb = async (billingPeriod: 'monthly' | 'annual') => {
    try {
      setBillingBusy(true);
      const data = await api.createStripeCheckout(billingPeriod);
      await Linking.openURL(data.url);
    } catch (error) {
      Alert.alert('Unable to open checkout', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setBillingBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Settings, preferences, and subscription</Text>

      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.rowTitle}>Biometric unlock</Text>
          <Text style={styles.rowSubtitle}>Require Face ID or Touch ID before reopening the app on this device.</Text>
        </View>
        <Switch value={biometricEnabled} onValueChange={(value) => void handleToggleBiometric(value)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.rowTitle}>Subscription</Text>
        <Text style={styles.rowSubtitle}>
          {user?.plan === 'pro'
            ? `You are on Pro${subscriptionPlatform ? ` via ${subscriptionPlatform}` : ''}.`
            : 'Upgrade to Pro to unlock unlimited decks and selling.'}
        </Text>
        {user?.cancelAtPeriodEnd && user.cancelAt ? (
          <Text style={styles.helperText}>
            Access remains active until {new Date(user.cancelAt).toLocaleDateString()}.
          </Text>
        ) : null}

        {user?.plan === 'pro' ? (
          <Pressable style={styles.primaryButton} onPress={() => void handleManageSubscription()} disabled={billingBusy}>
            <Text style={styles.primaryButtonText}>
              {subscriptionPlatform === 'apple' ? 'Manage in Apple' : 'Manage Billing'}
            </Text>
          </Pressable>
        ) : (
          <>
            {canUseRevenueCat() ? (
              <>
                <Pressable style={styles.primaryButton} onPress={() => void handlePurchase(subscriptionPackages.monthly)} disabled={billingBusy}>
                  <Text style={styles.primaryButtonText}>Subscribe Monthly in App</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void handlePurchase(subscriptionPackages.annual)} disabled={billingBusy}>
                  <Text style={styles.secondaryButtonText}>Subscribe Annual in App</Text>
                </Pressable>
                <Pressable onPress={() => void handleRestore()} disabled={billingBusy}>
                  <Text style={styles.linkText}>Restore Apple Purchases</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.primaryButton} onPress={() => void handleUpgradeOnWeb('monthly')} disabled={billingBusy}>
                  <Text style={styles.primaryButtonText}>Upgrade on Web — Monthly</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void handleUpgradeOnWeb('annual')} disabled={billingBusy}>
                  <Text style={styles.secondaryButtonText}>Upgrade on Web — Annual</Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>

      <Pressable style={styles.logoutButton} onPress={() => void handleLogout()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing['3xl'],
      justifyContent: 'center',
      gap: spacing.xl,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
      padding: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    copy: {
      flex: 1,
      gap: spacing.xs,
    },
    rowTitle: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
    rowSubtitle: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    section: {
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    helperText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.surface,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    linkText: {
      color: colors.primary,
      textAlign: 'center',
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    logoutButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    logoutText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
  });
