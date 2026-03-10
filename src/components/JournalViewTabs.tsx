import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '@/lib/theme';
import type { JournalViewMode } from '@/utils/journal-periods';

const VIEW_OPTIONS: Array<{ label: string; value: JournalViewMode }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
];

interface JournalViewTabsProps {
  value: JournalViewMode;
  onChange: (value: JournalViewMode) => void;
}

export function JournalViewTabs({ value, onChange }: JournalViewTabsProps) {
  return (
    <View style={styles.container} testID="journal-view-tabs">
      {VIEW_OPTIONS.map((option) => {
        const isActive = value === option.value;
        return (
          <Pressable
            key={option.value}
            testID={`journal-view-tab-${option.value}`}
            style={[styles.tab, isActive ? styles.tabActive : null]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.tabText, isActive ? styles.tabTextActive : null]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.background,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  tabTextActive: {
    color: colors.textInverse,
  },
});
