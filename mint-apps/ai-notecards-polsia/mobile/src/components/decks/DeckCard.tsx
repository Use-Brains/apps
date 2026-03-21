import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

type Props = {
  title: string;
  onOpen: () => void;
  onStudy: () => void;
  onOpenActions: () => void;
  studyLabel?: string;
};

export function DeckCard({ title, onOpen, onStudy, onOpenActions, studyLabel = 'Study' }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Pressable style={styles.iconButton} onPress={onOpenActions} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={20} color={styles.icon.color} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onOpen}>
          <Text style={styles.secondaryButtonText}>Open</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onStudy}>
          <Text style={styles.primaryButtonText}>{studyLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    cardTitle: {
      flex: 1,
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    icon: {
      color: colors.textSecondary,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    primaryButton: {
      flex: 1,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: '700',
    },
    secondaryButton: {
      flex: 1,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: '600',
    },
  });
