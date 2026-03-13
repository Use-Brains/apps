import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { spacing, fontSize, borderRadius, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';

interface Props {
  title: string;
  description: string;
  onDescriptionChange: (text: string) => void;
  onSave: () => void;
  onFullDetails: () => void;
  onCancel: () => void;
  isSaving: boolean;
  placeholderTextColor: string;
}

export function StrategyPlaceholderInline({
  title,
  description,
  onDescriptionChange,
  onSave,
  onFullDetails,
  onCancel,
  isSaving,
  placeholderTextColor,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { theme: { colors } } = useTheme();

  return (
    <View style={styles.inlineCreate}>
      <Text style={styles.inlineTitle}>New: {title}</Text>
      <TextInput
        style={styles.inlineDesc}
        value={description}
        onChangeText={onDescriptionChange}
        placeholder="Brief description (optional)"
        placeholderTextColor={placeholderTextColor}
        maxLength={200}
        multiline
      />
      <View style={styles.inlineActions}>
        <Pressable
          style={styles.inlineButton}
          onPress={onSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.textInverse} />
          ) : (
            <Text style={styles.inlineButtonText}>Save Placeholder</Text>
          )}
        </Pressable>
        <Pressable style={styles.inlineLinkButton} onPress={onFullDetails}>
          <Text style={styles.inlineLinkText}>Full details {'\u2192'}</Text>
        </Pressable>
        <Pressable onPress={onCancel}>
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    inlineCreate: {
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    inlineTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    inlineDesc: {
      padding: spacing.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      fontSize: fontSize.sm,
      minHeight: 60,
      textAlignVertical: 'top',
      marginBottom: spacing.md,
    },
    inlineActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    inlineButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
    },
    inlineButtonText: {
      color: colors.textInverse,
      fontWeight: '600',
      fontSize: fontSize.sm,
    },
    inlineLinkButton: {
      paddingVertical: spacing.sm,
    },
    inlineLinkText: {
      color: colors.primary,
      fontSize: fontSize.sm,
    },
    notNowText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
  });
