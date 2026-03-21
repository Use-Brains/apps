import { StyleSheet, Text, View } from 'react-native';
import { getOfflineBannerState } from '@/lib/offline/ui';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { useNetwork } from '@/lib/network';

export function OfflineBanner() {
  const styles = useThemedStyles(createStyles);
  const { isOnline, isSyncing } = useNetwork();
  const state = getOfflineBannerState({ isOnline, isSyncing });

  if (!state.visible) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{state.message}</Text>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    banner: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.warning,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    text: {
      color: colors.surface,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textAlign: 'center',
    },
  });
