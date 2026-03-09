import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius, fontWeight } from '@/lib/theme';
import { formatDate } from '@/utils/format';
import { PnlBadge } from './PnlBadge';
import type { Trade } from '@/types/trades';

interface TradeCardProps {
  trade: Trade;
  onPress: () => void;
}

export function TradeCard({ trade, onPress }: TradeCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{trade.symbol}</Text>
          <Text style={[styles.side, trade.side === 'long' ? styles.long : styles.short]}>
            {trade.side.toUpperCase()}
          </Text>
        </View>
        <PnlBadge pnl={trade.pnl} pnlPercent={trade.pnl_percent} size="sm" />
      </View>

      <View style={styles.meta}>
        <Text style={styles.date}>{formatDate(trade.entry_date)}</Text>
        <Text style={styles.assetClass}>{trade.asset_class}</Text>
      </View>

      {(trade.setup_tags.length > 0 || trade.mistake_tags.length > 0) && (
        <View style={styles.tags}>
          {trade.setup_tags.map((tag) => (
            <View key={`s-${tag}`} style={styles.setupTag}>
              <Text style={styles.setupTagText}>{tag}</Text>
            </View>
          ))}
          {trade.mistake_tags.map((tag) => (
            <View key={`m-${tag}`} style={styles.mistakeTag}>
              <Text style={styles.mistakeTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  symbol: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  side: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  long: {
    color: colors.profit,
    backgroundColor: colors.successLight,
  },
  short: {
    color: colors.loss,
    backgroundColor: colors.dangerLight,
  },
  meta: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  assetClass: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  setupTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  setupTagText: {
    fontSize: fontSize.xs,
    color: colors.primary,
  },
  mistakeTag: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  mistakeTagText: {
    fontSize: fontSize.xs,
    color: colors.warning,
  },
});
