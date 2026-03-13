import { StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius, type AppTheme } from '@/lib/theme';

export const createStrategyFormStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing['4xl'],
    },
    field: {
      marginBottom: spacing.md,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      color: colors.text,
      fontSize: fontSize.md,
    },
    inputError: {
      borderColor: colors.danger,
    },
    multiline: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
    rowFields: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipText: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    chipTextSelected: {
      color: colors.textInverse,
    },
    footer: {
      padding: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    footerRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
    },
    cancelButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    saveButtonFlex: {
      flex: 1,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.textInverse,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  });
