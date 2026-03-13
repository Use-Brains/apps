import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius, fontWeight, useThemedStyles, type AppTheme } from '@/lib/theme';
import { formatCurrency, formatPercent } from '@/utils/format';

interface JournalStatsProps {
  totalPnl: number;
  winRate: number;
  tradeCount: number;
}

export function JournalStats({ totalPnl, winRate, tradeCount }: JournalStatsProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.stat}>
        <Text style={styles.statLabel}>Total P&L</Text>
        <Text
          style={[
            styles.statValue,
            totalPnl > 0 ? styles.profit : totalPnl < 0 ? styles.loss : null,
          ]}
        >
          {formatCurrency(totalPnl)}
        </Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Text style={styles.statLabel}>Win Rate</Text>
        <Text style={styles.statValue}>{formatPercent(winRate, 1)}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.stat}>
        <Text style={styles.statLabel}>Trades</Text>
        <Text style={styles.statValue}>{tradeCount}</Text>
      </View>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  profit: { color: colors.profit },
  loss: { color: colors.loss },
  divider: {
    width: 1,
    backgroundColor: colors.borderLight,
  },
});
