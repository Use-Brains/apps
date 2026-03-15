import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Notecards</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>
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
      fontSize: fontSize['3xl'],
      fontWeight: '700',
      color: colors.primary,
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
  });
