import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuth } from '@/lib/auth';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

function isCancelledError(error: unknown) {
  if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return true;
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') return true;
  if (error instanceof Error && /cancel/i.test(error.message)) return true;
  return false;
}

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { login, loginWithGoogle, loginWithApple, requestMagicLink, lockedSessionAvailable, unlockStoredSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const googleConfig = useMemo(() => ({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  }), []);

  useEffect(() => {
    GoogleSignin.configure(googleConfig);
  }, [googleConfig]);

  const routeAfterAuth = (isNewUser?: boolean, displayName?: string | null) => {
    if (isNewUser && !displayName) {
      router.replace('/welcome');
      return;
    }
    router.replace('/(tabs)/home');
  };

  const handlePasswordLogin = async () => {
    setSubmitting(true);
    try {
      const session = await login(email, password);
      routeAfterAuth(session.isNewUser, session.user.displayName);
    } catch (error) {
      Alert.alert('Login failed', error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMagicLink = async () => {
    setSubmitting(true);
    try {
      await requestMagicLink(email);
      router.push({ pathname: '/(auth)/verify-code', params: { email } });
    } catch (error) {
      Alert.alert('Magic link failed', error instanceof Error ? error.message : 'Unable to send code');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success' || !response.data.idToken) return;
      const session = await loginWithGoogle(response.data.idToken);
      routeAfterAuth(session.isNewUser, session.user.displayName);
    } catch (error) {
      if (!isCancelledError(error)) {
        Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Unable to continue with Google');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleApple = async () => {
    setSubmitting(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple did not return an identity token');
      }

      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') || null;
      const session = await loginWithApple(credential.identityToken, fullName);
      routeAfterAuth(session.isNewUser, session.user.displayName);
    } catch (error) {
      if (!isCancelledError(error)) {
        Alert.alert('Apple sign-in failed', error instanceof Error ? error.message : 'Unable to continue with Apple');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBiometricUnlock = async () => {
    setSubmitting(true);
    try {
      const unlocked = await unlockStoredSession();
      if (unlocked) {
        router.replace('/(tabs)/home');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = email.trim().length > 0 && !submitting;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Notecards</Text>
      <Text style={styles.subtitle}>Sign in to continue</Text>

      {lockedSessionAvailable && (
        <Pressable style={styles.secondaryButton} onPress={handleBiometricUnlock} disabled={submitting}>
          <Text style={styles.secondaryButtonText}>Unlock with Face ID or Touch ID</Text>
        </Pressable>
      )}

      <Pressable style={styles.primaryButton} onPress={handleGoogle} disabled={submitting}>
        <Text style={styles.primaryButtonText}>Continue with Google</Text>
      </Pressable>

      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={12}
        style={styles.appleButton}
        onPress={handleApple}
      />

      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />
      </View>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email address"
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
      />

      <Pressable style={[styles.primaryButton, !canSubmit && styles.disabledButton]} onPress={handleMagicLink} disabled={!canSubmit}>
        <Text style={styles.primaryButtonText}>Continue with Email</Text>
      </Pressable>

      {showPassword && (
        <>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor={styles.placeholder.color}
            style={styles.input}
          />
          <Pressable style={[styles.secondaryButton, !canSubmit && styles.disabledButton]} onPress={handlePasswordLogin} disabled={!canSubmit || password.length < 8}>
            <Text style={styles.secondaryButtonText}>Use Password</Text>
          </Pressable>
        </>
      )}

      <Pressable onPress={() => setShowPassword((value) => !value)}>
        <Text style={styles.linkText}>{showPassword ? 'Hide password login' : 'Use password instead'}</Text>
      </Pressable>

      <Link href="/(auth)/register" style={styles.linkText}>Create an account</Link>
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
    primaryButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
    },
    secondaryButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
    },
    disabledButton: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.surface,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    appleButton: {
      width: '100%',
      height: 50,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    divider: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      color: colors.textSecondary,
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
    linkText: {
      color: colors.primary,
      textAlign: 'center',
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    placeholder,
  });
};
