import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function ProfileScreen() {
  const styles = useThemedStyles(createStyles);
  const { biometricEnabled, enableBiometricLock, disableBiometricLock, logout } = useAuth();

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
