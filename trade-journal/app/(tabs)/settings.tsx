import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from '@/hooks/use-subscription';
import { ENTITLEMENT_ID, PAYWALL_RESULT } from '@/lib/revenuecat';
import {
  fontSize,
  spacing,
  borderRadius,
  fontWeight,
  THEME_MODES,
  THEME_STYLES,
  THEME_PALETTES,
  themeModeLabels,
  themeStyleLabels,
  themePaletteLabels,
  useTheme,
  useThemedStyles,
  type AppTheme,
  type ThemeMode,
  type ThemePalette,
  type ThemeStyle,
} from '@/lib/theme';
import { GlassCard } from '@/components/GlassCard';
import { IosGlassBackground } from '@/components/IosGlassBackground';

function formatDate(dateValue?: string | null) {
  if (!dateValue) {
    return 'N/A';
  }

  return new Date(dateValue).toLocaleDateString();
}

export default function SettingsScreen() {
  const router = useRouter();
  const { selection, setMode, setStyle, setPalette, theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { colors } = theme;
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

  const isGlass = selection.style === 'ios_glass';
  const isMaterial = selection.style === 'android_material';
  const insets = useSafeAreaInsets();

  const displayName = user?.user_metadata?.display_name ?? user?.email ?? 'User';

  const applyThemeChange = (kind: 'mode' | 'style' | 'palette', value: string) => {
    const isSameSelection =
      (kind === 'mode' && selection.mode === value) ||
      (kind === 'style' && selection.style === value) ||
      (kind === 'palette' && selection.palette === value);

    if (isSameSelection) {
      return;
    }

    if (kind === 'mode') {
      setMode(value as ThemeMode);
    } else if (kind === 'style') {
      setStyle(value as ThemeStyle);
    } else {
      setPalette(value as ThemePalette);
    }
  };

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

  /**
   * SectionCard: renders a glass panel on ios_glass, an elevated M3 surface on
   * android_material, or the classic flat card on other themes.
   */
  const SectionCard = ({ children, style }: { children: React.ReactNode; style?: object }) => {
    if (isGlass) {
      return (
        <GlassCard intensity="medium" style={style}>
          {children}
        </GlassCard>
      );
    }
    if (isMaterial) {
      return (
        <View style={[styles.card, styles.cardMaterial, style]}>
          {children}
        </View>
      );
    }
    return <View style={[styles.card, style]}>{children}</View>;
  };

  const scrollContent = (
    <ScrollView
      style={[styles.container, isGlass && styles.containerGlass]}
      contentContainerStyle={[styles.content, isGlass && styles.contentGlass, { paddingTop: spacing.lg + insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isGlass && styles.sectionTitleGlass]}>Account</Text>
        <SectionCard>
          <View style={styles.row}>
            <Text style={[styles.label, isGlass && styles.labelGlass]}>Name</Text>
            <Text style={[styles.value, isGlass && styles.valueGlass]}>{displayName}</Text>
          </View>
          <View style={[styles.divider, isGlass && styles.dividerGlass]} />
          <View style={styles.row}>
            <Text style={[styles.label, isGlass && styles.labelGlass]}>Email</Text>
            <Text style={[styles.value, isGlass && styles.valueGlass]}>{user?.email ?? ''}</Text>
          </View>
        </SectionCard>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isGlass && styles.sectionTitleGlass]}>Appearance</Text>
        <SectionCard>
          <View style={[styles.appearanceGroup, isGlass && styles.appearanceGroupGlass]}>
            <Text style={[styles.appearanceLabel, isGlass && styles.appearanceLabelGlass]}>Mode</Text>
            <View style={styles.optionRow}>
              {THEME_MODES.map((mode) => {
                const active = selection.mode === mode;
                return (
                  <Pressable
                    key={mode}
                    style={[
                      styles.optionChip,
                      isGlass && styles.optionChipGlass,
                      isMaterial && styles.optionChipMaterial,
                      active && styles.optionChipActive,
                      active && isGlass && styles.optionChipActiveGlass,
                      active && isMaterial && styles.optionChipActiveMaterial,
                    ]}
                    onPress={() => applyThemeChange('mode', mode)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        isGlass && styles.optionChipTextGlass,
                        active && styles.optionChipTextActive,
                        active && isGlass && styles.optionChipTextActiveGlass,
                      ]}
                    >
                      {themeModeLabels[mode]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.appearanceDivider, isGlass && styles.dividerGlass]} />

          <View style={[styles.appearanceGroup, isGlass && styles.appearanceGroupGlass]}>
            <Text style={[styles.appearanceLabel, isGlass && styles.appearanceLabelGlass]}>Look</Text>
            <View style={styles.optionRow}>
              {THEME_STYLES.map((style) => {
                const active = selection.style === style;
                return (
                  <Pressable
                    key={style}
                    style={[
                      styles.optionChip,
                      isGlass && styles.optionChipGlass,
                      isMaterial && styles.optionChipMaterial,
                      active && styles.optionChipActive,
                      active && isGlass && styles.optionChipActiveGlass,
                      active && isMaterial && styles.optionChipActiveMaterial,
                    ]}
                    onPress={() => applyThemeChange('style', style)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        isGlass && styles.optionChipTextGlass,
                        active && styles.optionChipTextActive,
                        active && isGlass && styles.optionChipTextActiveGlass,
                      ]}
                    >
                      {themeStyleLabels[style]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.appearanceDivider, isGlass && styles.dividerGlass]} />

          <View style={[styles.appearanceGroup, isGlass && styles.appearanceGroupGlass]}>
            <Text style={[styles.appearanceLabel, isGlass && styles.appearanceLabelGlass]}>Palette</Text>
            <View style={styles.optionRow}>
              {THEME_PALETTES.map((palette) => {
                const active = selection.palette === palette;
                return (
                  <Pressable
                    key={palette}
                    style={[
                      styles.optionChip,
                      isGlass && styles.optionChipGlass,
                      isMaterial && styles.optionChipMaterial,
                      active && styles.optionChipActive,
                      active && isGlass && styles.optionChipActiveGlass,
                      active && isMaterial && styles.optionChipActiveMaterial,
                    ]}
                    onPress={() => applyThemeChange('palette', palette)}
                  >
                    <Text
                      style={[
                        styles.optionChipText,
                        isGlass && styles.optionChipTextGlass,
                        active && styles.optionChipTextActive,
                        active && isGlass && styles.optionChipTextActiveGlass,
                      ]}
                    >
                      {themePaletteLabels[palette]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SectionCard>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, isGlass && styles.sectionTitleGlass]}>Subscription</Text>
        <SectionCard>
          <View style={styles.row}>
            <Text style={[styles.label, isGlass && styles.labelGlass]}>Entitlement</Text>
            {subscriptionLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={isMakeWayBetterTradesActive ? styles.statusActive : styles.statusInactive}>
                {isMakeWayBetterTradesActive ? 'Active' : 'Inactive'}
              </Text>
            )}
          </View>
          <View style={[styles.divider, isGlass && styles.dividerGlass]} />
          <View style={styles.row}>
            <Text style={[styles.label, isGlass && styles.labelGlass]}>Product</Text>
            <Text style={[styles.value, isGlass && styles.valueGlass]}>{activeEntitlement?.productIdentifier ?? 'N/A'}</Text>
          </View>
          <View style={[styles.divider, isGlass && styles.dividerGlass]} />
          <View style={styles.row}>
            <Text style={[styles.label, isGlass && styles.labelGlass]}>Expires</Text>
            <Text style={[styles.value, isGlass && styles.valueGlass]}>{formatDate(activeEntitlement?.expirationDate)}</Text>
          </View>
          <View style={[styles.divider, isGlass && styles.dividerGlass]} />
          <View style={styles.row}>
            <Text style={[styles.label, isGlass && styles.labelGlass]}>Customer</Text>
            <Text style={[styles.value, isGlass && styles.valueGlass]}>{customerInfo?.originalAppUserId ?? 'N/A'}</Text>
          </View>
        </SectionCard>

        <View style={styles.buttonRow}>
          <Pressable
            style={[
              styles.actionButton,
              isGlass && styles.actionButtonGlass,
              (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled,
            ]}
            onPress={showPaywall}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={[styles.actionText, isGlass && styles.actionTextGlass]}>Show Paywall</Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              isGlass && styles.actionButtonGlass,
              (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled,
            ]}
            onPress={openCustomerCenter}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={[styles.actionText, isGlass && styles.actionTextGlass]}>Manage</Text>
          </Pressable>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[
              styles.actionButton,
              isGlass && styles.actionButtonGlass,
              (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled,
            ]}
            onPress={() => handlePurchasePlan('monthly')}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={[styles.actionText, isGlass && styles.actionTextGlass]}>Monthly</Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              isGlass && styles.actionButtonGlass,
              (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled,
            ]}
            onPress={() => handlePurchasePlan('yearly')}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={[styles.actionText, isGlass && styles.actionTextGlass]}>Yearly</Text>
          </Pressable>

          <Pressable
            style={[
              styles.actionButton,
              isGlass && styles.actionButtonGlass,
              (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled,
            ]}
            onPress={() => handlePurchasePlan('lifetime')}
            disabled={subscriptionBusy || subscriptionLoading}
          >
            <Text style={[styles.actionText, isGlass && styles.actionTextGlass]}>Lifetime</Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.actionButton,
            isGlass && styles.actionButtonGlass,
            (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled,
          ]}
          onPress={restore}
          disabled={subscriptionBusy || subscriptionLoading}
        >
          <Text style={[styles.actionText, isGlass && styles.actionTextGlass]}>Restore Purchases</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable
          style={[
            styles.actionButton,
            isGlass && styles.actionButtonGlass,
            (subscriptionBusy || subscriptionLoading) && styles.buttonDisabled,
          ]}
          onPress={handleImportPress}
          disabled={subscriptionBusy || subscriptionLoading}
        >
          <Text style={[styles.actionText, isGlass && styles.actionTextGlass]}>Import Trades CSV</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable
          style={[styles.logoutButton, isGlass && styles.logoutButtonGlass]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </View>

      <Text style={[styles.version, isGlass && styles.versionGlass]}>Trade Journal v1.0.0</Text>
    </ScrollView>
  );

  if (isGlass) {
    return (
      <View style={styles.glassRoot}>
        <IosGlassBackground accentColor={colors.primary}>
          {scrollContent}
        </IosGlassBackground>
      </View>
    );
  }

  return scrollContent;
}

const createStyles = ({ colors, selection }: AppTheme) => {
  const isGlass = selection.style === 'ios_glass';
  const isMaterial = selection.style === 'android_material';

  return StyleSheet.create({
    glassRoot: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ─── Base (Classic / Modern / High Contrast) ────────────────────────────

    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    containerGlass: {
      backgroundColor: 'transparent',
    },
    content: {
      padding: spacing.lg,
      gap: spacing.xl,
      paddingBottom: spacing['4xl'],
      flexGrow: 1,
    },
    contentGlass: {
      paddingTop: spacing.lg,
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
    sectionTitleGlass: {
      color: colors.textTertiary,
      letterSpacing: 1,
      fontSize: 11,
    },
    card: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
    },
    cardMaterial: {
      // Material You (M3) tonal surface
      backgroundColor: isMaterial
        ? (colors.surface)
        : colors.background,
      borderRadius: 16,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.12,
      shadowRadius: 3,
      elevation: 2,
    },
    appearanceGroup: {
      padding: spacing.lg,
      gap: spacing.sm,
    },
    appearanceGroupGlass: {
      padding: spacing.lg,
    },
    appearanceLabel: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      fontWeight: fontWeight.medium,
    },
    appearanceLabelGlass: {
      color: colors.textSecondary,
      fontWeight: fontWeight.semibold,
    },
    appearanceDivider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: spacing.lg,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },

    // ─── Chips ───────────────────────────────────────────────────────────────

    optionChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    optionChipGlass: {
      // Chips on glass: frosted mini-panels using theme surface + border
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 0.5,
      borderRadius: 999,
    },
    optionChipMaterial: {
      // M3 outlined chip
      backgroundColor: 'transparent',
      borderColor: colors.border,
      borderRadius: 8,
    },
    optionChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionChipActiveGlass: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionChipActiveMaterial: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    optionChipText: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      fontWeight: fontWeight.medium,
    },
    optionChipTextGlass: {
      color: colors.textSecondary,
      fontWeight: fontWeight.medium,
    },
    optionChipTextActive: {
      color: colors.textInverse,
      fontWeight: fontWeight.semibold,
    },
    optionChipTextActiveGlass: {
      color: colors.textInverse,
      fontWeight: fontWeight.semibold,
    },

    // ─── Rows ────────────────────────────────────────────────────────────────

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
    labelGlass: {
      color: colors.text,
      fontWeight: fontWeight.medium,
    },
    value: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    valueGlass: {
      color: colors.textSecondary,
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
    dividerGlass: {
      backgroundColor: colors.border,
    },

    // ─── Buttons ─────────────────────────────────────────────────────────────

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
    logoutButtonGlass: {
      backgroundColor: colors.dangerLight,
      borderWidth: 0.5,
      borderColor: colors.danger,
      borderRadius: 20,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.background,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.lg,
      alignItems: 'center',
    },
    actionButtonGlass: {
      backgroundColor: colors.surface,
      borderWidth: 0.5,
      borderColor: colors.border,
      borderRadius: 20,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    actionText: {
      color: colors.primary,
      fontSize: fontSize.md,
      fontWeight: fontWeight.semibold,
    },
    actionTextGlass: {
      color: colors.text,
      fontWeight: fontWeight.medium,
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
    versionGlass: {
      color: colors.textTertiary,
    },
  });
};
