import { View, Text, StyleSheet } from 'react-native';
import { useNetwork } from '@/lib/network';
import { getOfflineFeatureMessage } from '@/lib/offline/ui';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function GenerateScreen() {
  const styles = useThemedStyles(createStyles);
  const { isOnline } = useNetwork();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generate Flashcards</Text>
      <Text style={styles.subtitle}>
        {isOnline
          ? 'Paste notes or type a topic to create study cards'
          : getOfflineFeatureMessage('generate')}
      </Text>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
      backgroundColor: colors.background,
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
