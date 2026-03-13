import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius, fontWeight, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';

interface PreviewSummaryProps {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  conflicts: number;
  timeZone: string;
}

export function PreviewSummary({
  totalRows,
  validRows,
  invalidRows,
  conflicts,
  timeZone,
}: PreviewSummaryProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Preview</Text>
      <Text style={styles.row}>Timezone: {timeZone}</Text>
      <Text style={styles.row}>Total rows: {totalRows}</Text>
      <Text style={styles.row}>Valid rows: {validRows}</Text>
      <Text style={styles.row}>Invalid rows: {invalidRows}</Text>
      <Text style={styles.row}>Duplicate conflicts: {conflicts}</Text>
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
});
