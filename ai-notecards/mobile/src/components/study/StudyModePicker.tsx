import { Pressable, StyleSheet, Text, View } from 'react-native';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import type { StudyMode } from '@/types/api';
import { STUDY_MODE_LABELS, STUDY_MODE_MIN_CARDS } from '@/lib/study/modes';

export function StudyModePicker({
  availableCardCount,
  selectedMode,
  onSelect,
}: {
  availableCardCount: number;
  selectedMode: StudyMode;
  onSelect: (mode: StudyMode) => void;
}) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {(Object.keys(STUDY_MODE_LABELS) as StudyMode[]).map((mode) => {
        const disabled = availableCardCount < STUDY_MODE_MIN_CARDS[mode];

        return (
          <Pressable
            key={mode}
            style={[
              styles.chip,
              selectedMode === mode && styles.selectedChip,
              disabled && styles.disabledChip,
            ]}
            onPress={() => onSelect(mode)}
            disabled={disabled}
          >
            <Text
              style={[
                styles.chipText,
                selectedMode === mode && styles.selectedChipText,
              ]}
            >
              {STUDY_MODE_LABELS[mode]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    selectedChip: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    disabledChip: {
      opacity: 0.4,
    },
    chipText: {
      color: colors.text,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    selectedChipText: {
      color: colors.surface,
    },
  });
