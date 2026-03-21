import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function RegisterScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    setSubmitting(true);
    try {
      const session = await signup(email, password);
      if (session.isNewUser && !session.user.displayName) {
        router.replace('/welcome');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (error) {
      Alert.alert('Signup failed', error instanceof Error ? error.message : 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Password signup for legacy accounts</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
      />

      <Pressable style={[styles.button, (submitting || password.length < 8 || !email) && styles.disabledButton]} onPress={handleRegister} disabled={submitting || password.length < 8 || !email}>
        <Text style={styles.buttonText}>Create Account</Text>
      </Pressable>

      <Link href="/(auth)/login" style={styles.linkText}>Back to sign in</Link>
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
