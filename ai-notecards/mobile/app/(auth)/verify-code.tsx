import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function VerifyCodeScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const { verifyMagicLink } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleVerify = async () => {
    setSubmitting(true);
    try {
      const session = await verifyMagicLink(email, code);
      if (session.isNewUser && !session.user.displayName) {
        router.replace('/welcome');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (error) {
      Alert.alert('Verification failed', error instanceof Error ? error.message : 'Unable to verify code');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {email || 'your email address'}.</Text>
      <TextInput
        value={code}
        onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        placeholder="123456"
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
        maxLength={6}
      />
      <Pressable style={[styles.button, (submitting || code.length !== 6) && styles.disabledButton]} onPress={handleVerify} disabled={submitting || code.length !== 6}>
        <Text style={styles.buttonText}>Verify Code</Text>
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.linkText}>Back</Text>
      </Pressable>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) => {
  const placeholder = { color: colors.textTertiary };
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing['3xl'],
      gap: spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: fontSize['3xl'],
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.text,
      backgroundColor: colors.surface,
      textAlign: 'center',
      letterSpacing: 8,
      fontSize: fontSize['2xl'],
      fontWeight: '600',
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonText: {
      color: colors.surface,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    disabledButton: {
      opacity: 0.6,
    },
    linkText: {
      color: colors.primary,
      textAlign: 'center',
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    placeholder,
  });
};
