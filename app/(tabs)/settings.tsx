import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { ENTITLEMENT_ID, PAYWALL_RESULT } from '@/lib/revenuecat';
import { colors, fontSize, spacing, borderRadius, fontWeight } from '@/lib/theme';

function formatDate(dateValue?: string | null) {
  if (!dateValue) {
    return 'N/A';
  }

  return new Date(dateValue).toLocaleDateString();
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const {
    loading: subscriptionLoading,
    busy: subscriptionBusy,
    customerInfo,
    activeEntitlement,
    isMakeWayBetterTradesActive,
    showPaywall,
    openCustomerCenter,
    restore,
    refresh,
    buy,
  } = useSubscription();

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'User';

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            Alert.alert('Error', 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  const handleImportPress = async () => {
    if (isMakeWayBetterTradesActive) {
      router.push('/(tabs)/journal/import');
      return;
    }

    const result = await showPaywall();

    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      router.push('/(tabs)/journal/import');
      return;
    }

    const latestInfo = await refresh();
    const unlocked = Boolean(latestInfo?.entitlements.active[ENTITLEMENT_ID]);

    if (unlocked) {
      router.push('/(tabs)/journal/import');
      return;
    }

    Alert.alert('Subscription required', 'Unlock Make Way Better Trades to import CSV trades.');
  };

  const handlePurchasePlan = async (packageId: 'monthly' | 'yearly' | 'lifetime') => {
    const info = await buy(packageId);

    if (info?.entitlements.active[ENTITLEMENT_ID]) {
      Alert.alert('Subscribed', 'Your access to Make Way Better Trades is active.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{displayName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email ?? ''}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Subscription</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Entitlement</Text>
            {subscriptionLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={isMakeWayBetterTradesActive ? styles.statusActive : styles.statusInactive}>
                {isMakeWayBetterTradesActive ? 'Active' : 'Inactive'}
              </Text>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Product</Text>
            <Text style={styles.value}>{activeEntitlement?.productIdentifier ?? 'N/A'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Expires</Text>
            <Text style={styles.value}>{formatDate(activeEntitlement?.expirationDate)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{customerInfo?.originalAppUserId ?? 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled]}
            onPress={showPaywall}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={styles.actionText}>Show Paywall</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled]}
            onPress={openCustomerCenter}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={styles.actionText}>Manage</Text>
          </Pressable>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled]}
            onPress={() => handlePurchasePlan('monthly')}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={styles.actionText}>Monthly</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled]}
            onPress={() => handlePurchasePlan('yearly')}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={styles.actionText}>Yearly</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled]}
            onPress={() => handlePurchasePlan('lifetime')}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={styles.actionText}>Lifetime</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.actionButton, (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled]}
          onPress={restore}
          disabled={subscriptionBusy || subscriptionLoading}
        >
          <Text style={styles.actionText}>Restore Purchases</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable
          style={[styles.actionButton, (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled]}
          onPress={handleImportPress}
          disabled={subscriptionBusy || subscriptionLoading}
        >
          <Text style={styles.actionText}>Import Trades CSV</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </View>

      <Text style={styles.version}>Trade Journal v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  value: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  statusActive: {
    color: colors.success,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  statusInactive: {
    color: colors.danger,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginHorizontal: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  logoutButton: {
    backgroundColor: colors.background,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.background,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  logoutText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  version: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: 'auto',
  },
});
