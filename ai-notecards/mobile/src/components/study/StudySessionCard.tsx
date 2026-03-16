import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import { haptics } from '@/lib/haptics';
import type { AppTheme } from '@/lib/theme';
import type { OfflineCard } from '@/lib/offline/types';

export function StudySessionCard({
  card,
  showAnswer,
  onReveal,
}: {
  card: OfflineCard;
  showAnswer: boolean;
  onReveal: () => void;
}) {
  const styles = useThemedStyles(createStyles);

  const handleReveal = () => {
    if (showAnswer) {
      return;
    }

    void haptics.reveal();
    onReveal();
  };

  return (
    <Pressable style={styles.card} onPress={handleReveal}>
      <Text style={styles.label}>Prompt</Text>
      <Text style={styles.front}>{card.front}</Text>
      {showAnswer ? (
        <>
          <Text style={styles.label}>Answer</Text>
          <Text style={styles.back}>{card.back}</Text>
        </>
      ) : (
        <Text style={styles.hint}>Tap to reveal the answer</Text>
      )}
    </Pressable>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.md,
    },
    label: {
      fontSize: fontSize.xs,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    front: {
      fontSize: fontSize.xl,
      color: colors.text,
      fontWeight: '700',
    },
    back: {
      fontSize: fontSize.lg,
      color: colors.text,
      lineHeight: 24,
    },
    hint: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
  });
