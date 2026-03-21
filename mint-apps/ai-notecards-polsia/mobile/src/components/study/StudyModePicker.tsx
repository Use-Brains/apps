import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, fontSize, spacing, useTheme, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import type { StudyMode } from '@/types/api';
import { STUDY_MODE_MIN_CARDS } from '@/lib/study/modes';

type ModeConfig = {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const MODE_CONFIG: Record<StudyMode, ModeConfig> = {
  flip: {
    label: 'Flip Cards',
    description: 'Tap to reveal the answer',
    icon: 'copy-outline',
  },
  multiple_choice: {
    label: 'Multiple Choice',
    description: 'Pick from 4 options',
    icon: 'list-outline',
  },
  type_answer: {
    label: 'Type Answer',
    description: 'Type what you know',
    icon: 'pencil-outline',
  },
  match: {
    label: 'Match',
    description: 'Pair terms with definitions',
    icon: 'git-merge-outline',
  },
};

const MODES: StudyMode[] = ['flip', 'multiple_choice', 'type_answer', 'match'];

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
  const { theme: { colors } } = useTheme();

  return (
    <View style={styles.grid}>
      {MODES.map((mode) => {
        const config = MODE_CONFIG[mode];
        const disabled = availableCardCount < STUDY_MODE_MIN_CARDS[mode];
        const selected = selectedMode === mode;

        return (
          <Pressable
            key={mode}
            style={[styles.tile, selected && styles.tileSelected, disabled && styles.tileDisabled]}
            onPress={() => onSelect(mode)}
            disabled={disabled}
          >
            <Ionicons
              name={config.icon}
              size={26}
              color={selected ? colors.studyText : 'rgba(255,255,255,0.5)'}
              style={styles.icon}
            />
            <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]}>
              {config.label}
            </Text>
            <Text style={[styles.tileDesc, selected && styles.tileDescSelected]} numberOfLines={2}>
              {config.description}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    tile: {
      width: '47%',
      borderRadius: borderRadius.xl,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.15)',
      backgroundColor: 'rgba(255,255,255,0.07)',
      padding: spacing.lg,
      gap: spacing.xs,
    },
    tileSelected: {
      borderColor: colors.studyText,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    tileDisabled: {
      opacity: 0.3,
    },
    icon: {
      marginBottom: spacing.xs,
    },
    tileLabel: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.studyText,
    },
    tileLabelSelected: {
      color: colors.studyText,
    },
    tileDesc: {
      fontSize: fontSize.xs,
      color: colors.studyText,
      opacity: 0.6,
      lineHeight: 16,
    },
    tileDescSelected: {
      opacity: 0.85,
    },
  });
