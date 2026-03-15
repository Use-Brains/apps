import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function WelcomeScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ display_name: displayName.trim() });
      await refreshUser();
      router.replace('/(tabs)/home');
    } catch (error) {
      Alert.alert('Unable to save name', error instanceof Error ? error.message : 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to AI Notecards</Text>
      <Text style={styles.subtitle}>What should we call you?</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
        maxLength={50}
      />
      <Pressable style={[styles.button, (saving || !displayName.trim()) && styles.disabledButton]} onPress={handleContinue} disabled={saving || !displayName.trim()}>
        <Text style={styles.buttonText}>Continue</Text>
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
    placeholder,
  });
};
