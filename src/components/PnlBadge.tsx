import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import { formatCurrency, formatPercent } from '@/utils/format';

interface PnlBadgeProps {
  pnl: number | null;
  pnlPercent?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

export function PnlBadge({ pnl, pnlPercent, size = 'md' }: PnlBadgeProps) {
  if (pnl == null) {
    return (
      <View style={[styles.badge, styles.neutral, sizeStyles[size]]}>
        <Text style={[styles.text, styles.neutralText, textSizeStyles[size]]}>Open</Text>
      </View>
    );
  }

  const isProfit = pnl > 0;
  const isLoss = pnl < 0;

  return (
    <View
      style={[
        styles.badge,
        isProfit ? styles.profit : isLoss ? styles.loss : styles.neutral,
        sizeStyles[size],
      ]}
    >
      <Text
        style={[
          styles.text,
          isProfit ? styles.profitText : isLoss ? styles.lossText : styles.neutralText,
          textSizeStyles[size],
        ]}
      >
        {formatCurrency(pnl)}
        {pnlPercent != null ? ` (${formatPercent(pnlPercent)})` : ''}
      </Text>
    </View>
  );
}

const sizeStyles = StyleSheet.create({
  sm: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  md: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  lg: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});

const textSizeStyles = StyleSheet.create({
  sm: { fontSize: fontSize.xs },
  md: { fontSize: fontSize.sm },
  lg: { fontSize: fontSize.md },
});

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  profit: { backgroundColor: colors.successLight },
  loss: { backgroundColor: colors.dangerLight },
  neutral: { backgroundColor: colors.borderLight },
  text: { fontWeight: '600' },
  profitText: { color: colors.profit },
  lossText: { color: colors.loss },
  neutralText: { color: colors.textSecondary },
});
