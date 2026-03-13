import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useStrategyStats } from '@/hooks/use-strategies';
import { spacing, fontSize, useThemedStyles, type AppTheme } from '@/lib/theme';

interface Props {
  strategyId: string;
}

export function StrategyStatsPanel({ strategyId }: Props) {
  const { data: stats, isLoading, isError } = useStrategyStats(strategyId);
  const styles = useThemedStyles(createStyles);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (isError || !stats) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Could not load stats</Text>
      </View>
    );
  }

  if (stats.totalClosedTrades === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No trades linked yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Performance</Text>
      <View style={styles.grid}>
        <StatTile label="Trades" value={stats.totalClosedTrades.toString()} styles={styles} />
        <StatTile
          label="Win Rate"
          value={stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : '\u2014'}
          styles={styles}
        />
        <StatTile
          label="Avg R:R"
          value={stats.avgRealizedRR != null ? stats.avgRealizedRR.toFixed(2) : '\u2014'}
          styles={styles}
        />
        <StatTile
          label="Total P&L"
          value={`$${stats.totalPnl.toFixed(2)}`}
          styles={styles}
        />
        <StatTile
          label="Best Trade"
          value={stats.bestTradePnl != null ? `$${stats.bestTradePnl.toFixed(2)}` : '\u2014'}
          styles={styles}
        />
        <StatTile
          label="Worst Trade"
          value={stats.worstTradePnl != null ? `$${stats.worstTradePnl.toFixed(2)}` : '\u2014'}
          styles={styles}
        />
      </View>
    </View>
  );
}

function StatTile({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    heading: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    tile: {
      width: '30%',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    tileValue: {
      color: colors.text,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    tileLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      textAlign: 'center',
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSize.sm,
      textAlign: 'center',
    },
  });
