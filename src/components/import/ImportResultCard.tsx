import { View, Text, StyleSheet } from 'react-native';
import type { ImportExecutionReport } from '@/features/import/types';
import { fontSize, spacing, borderRadius, fontWeight, useThemedStyles, type AppTheme } from '@/lib/theme';

interface ImportResultCardProps {
  report: ImportExecutionReport;
}

export function ImportResultCard({ report }: ImportResultCardProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Import Results</Text>
      <Text style={styles.row}>Imported: {report.imported}</Text>
      <Text style={styles.row}>Replaced: {report.replaced}</Text>
      <Text style={styles.row}>Skipped (invalid): {report.skippedInvalid}</Text>
      <Text style={styles.row}>Skipped (duplicates): {report.skippedDuplicate}</Text>
      <Text style={styles.row}>Failed writes: {report.failed.length}</Text>
      {report.failed.slice(0, 20).map((failure) => (
        <Text key={`${failure.rowIndex}-${failure.action}`} style={styles.failure}>
          Row {failure.rowIndex + 1} ({failure.action}): {failure.reason}
        </Text>
      ))}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  row: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  failure: {
    fontSize: fontSize.xs,
    color: colors.danger,
  },
});
