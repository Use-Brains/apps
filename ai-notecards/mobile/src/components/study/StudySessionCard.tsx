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
    if (showAnswer) return;
    void haptics.reveal();
    onReveal();
  };

  return (
    <Pressable style={styles.card} onPress={handleReveal}>
      <View style={styles.section}>
        <Text style={styles.label}>QUESTION</Text>
        <Text style={styles.front}>{card.front}</Text>
      </View>

      <View style={styles.divider} />

      {showAnswer ? (
        <View style={styles.section}>
          <Text style={[styles.label, styles.answerLabel]}>ANSWER</Text>
          <Text style={styles.back}>{card.back}</Text>
        </View>
      ) : (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>Tap to reveal</Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    card: {
      borderRadius: borderRadius.xl,
      backgroundColor: 'rgba(255,255,255,0.10)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      overflow: 'hidden',
      minHeight: 220,
    },
    section: {
      padding: spacing['2xl'],
      gap: spacing.md,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    label: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: 'rgba(255,255,255,0.45)',
    },
    answerLabel: {
      color: colors.studyText,
      opacity: 0.6,
    },
    front: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.studyText,
      lineHeight: 28,
    },
    back: {
      fontSize: fontSize.lg,
      color: colors.studyText,
      lineHeight: 26,
      opacity: 0.9,
    },
    hintRow: {
      padding: spacing['2xl'],
      alignItems: 'center',
    },
    hint: {
      fontSize: fontSize.sm,
      color: 'rgba(255,255,255,0.35)',
      fontStyle: 'italic',
    },
  });
