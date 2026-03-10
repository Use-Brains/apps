import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { ImportConflict, ImportResolution } from '@/features/import/types';
import { colors, fontSize, spacing, borderRadius, fontWeight } from '@/lib/theme';

interface ConflictReviewTableProps {
  conflicts: ImportConflict[];
  resolutions: Record<number, ImportResolution>;
  onChangeResolution: (rowIndex: number, resolution: ImportResolution) => void;
}

export function ConflictReviewTable({
  conflicts,
  resolutions,
  onChangeResolution,
}: ConflictReviewTableProps) {
  if (conflicts.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Duplicate Review</Text>
      {conflicts.map((conflict) => {
        const active = resolutions[conflict.importRowIndex] ?? 'skip';

        return (
          <View key={`${conflict.importRowIndex}-${conflict.existingTradeId}`} style={styles.card}>
            <Text style={styles.rowTitle}>Row {conflict.importRowIndex + 1}</Text>
            <Text style={styles.meta}>Existing trade: {conflict.existingTradeId}</Text>
            <View style={styles.diffList}>
              {conflict.diff.length === 0 ? (
                <Text style={styles.diffItem}>No field differences detected.</Text>
              ) : (
                conflict.diff.map((diff) => (
                  <Text key={`${diff.field}-${diff.existingValue}`} style={styles.diffItem}>
                    {diff.field}: {diff.existingValue} to {diff.incomingValue}
                  </Text>
                ))
              )}
            </View>
            <View style={styles.actions}>
              {(['import', 'skip', 'replace'] as ImportResolution[]).map((resolution) => (
                <Pressable
                  key={resolution}
                  style={[styles.actionButton, active === resolution && styles.actionButtonActive]}
                  onPress={() => onChangeResolution(conflict.importRowIndex, resolution)}
                >
                  <Text
                    style={[styles.actionText, active === resolution && styles.actionTextActive]}
                  >
                    {resolution}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  diffList: {
    gap: 2,
  },
  diffItem: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  actionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  actionText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  actionTextActive: {
    color: colors.textInverse,
  },
});
