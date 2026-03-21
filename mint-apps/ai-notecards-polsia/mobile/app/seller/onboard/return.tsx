import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function SellerOnboardReturnScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [message, setMessage] = useState('Refreshing your seller account...');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await api.refreshOnboarding();
        if (cancelled) return;
        setMessage('Seller setup updated. Taking you back to your account...');
        setTimeout(() => {
          if (!cancelled) {
            router.replace('/seller');
          }
        }, 600);
      } catch {
        if (cancelled) return;
        setMessage('We could not refresh seller setup right now. You can try again from the seller dashboard.');
        setTimeout(() => {
          if (!cancelled) {
            router.replace('/seller');
          }
        }, 1200);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator />
      <Text style={styles.title}>Finishing seller setup</Text>
      <Text style={styles.subtitle}>{message}</Text>
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
      gap: spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
    },
  });
