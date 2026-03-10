import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTrade, useUpdateTrade, useDeleteTrade } from '@/hooks/use-trades';
import { TradeForm } from '@/components/TradeForm';
import { PnlBadge } from '@/components/PnlBadge';
import { TradeImages } from '@/components/TradeImages';
import { formatDateTime, formatCurrency } from '@/utils/format';
import { colors, fontSize, spacing, borderRadius, fontWeight } from '@/lib/theme';
import type { TradeFormData } from '@/types/trades';
import { mapTradeFormToUpdate } from '@/utils/trade-payloads';

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const { data: trade, isLoading } = useTrade(id!);
  const updateTrade = useUpdateTrade();
  const deleteTrade = useDeleteTrade();

  const handleDelete = () => {
    Alert.alert('Delete Trade', 'Delete this trade? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTrade.mutateAsync(id!);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete trade.');
          }
        },
      },
    ]);
  };

  const handleUpdate = async (data: TradeFormData, _imagePaths: string[]) => {
    await updateTrade.mutateAsync({
      id: id!,
      ...mapTradeFormToUpdate(data),
    });
    setEditing(false);
  };

  if (isLoading || !trade) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (editing) {
    return (
      <View style={styles.flex}>
        <TradeForm
          mode="edit"
          defaultValues={{
            symbol: trade.symbol,
            asset_class: trade.asset_class,
            side: trade.side,
            status: trade.status,
            entry_price: trade.entry_price,
            exit_price: trade.exit_price,
            size: trade.size,
            fees: trade.fees,
            entry_date: trade.entry_date,
            exit_date: trade.exit_date,
            confidence: trade.confidence,
            thesis: trade.thesis,
            notes: trade.notes,
            setup_tags: trade.setup_tags,
            mistake_tags: trade.mistake_tags,
          }}
          onSubmit={handleUpdate}
          submitLabel="Update Trade"
        />
        <Pressable style={styles.cancelButton} onPress={() => setEditing(false)}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const images = trade.trade_images ?? [];

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{trade.symbol}</Text>
          <Text style={[styles.side, trade.side === 'long' ? styles.long : styles.short]}>
            {trade.side.toUpperCase()}
          </Text>
          <Text style={styles.assetClass}>{trade.asset_class}</Text>
        </View>
        <PnlBadge pnl={trade.pnl} pnlPercent={trade.pnl_percent} size="lg" />
      </View>

      {/* Details */}
      <View style={styles.detailsCard}>
        <DetailRow label="Entry Price" value={formatCurrency(trade.entry_price, 8)} />
        {trade.exit_price != null && (
          <DetailRow label="Exit Price" value={formatCurrency(trade.exit_price, 8)} />
        )}
        <DetailRow label="Size" value={trade.size.toString()} />
        <DetailRow label="Fees" value={formatCurrency(trade.fees)} />
        <DetailRow label="Entry Date" value={formatDateTime(trade.entry_date)} />
        {trade.exit_date && (
          <DetailRow label="Exit Date" value={formatDateTime(trade.exit_date)} />
        )}
        <DetailRow label="Status" value={trade.status} />
        {trade.confidence != null && (
          <DetailRow label="Confidence" value={`${trade.confidence}/5`} />
        )}
      </View>

      {/* Tags */}
      {(trade.setup_tags.length > 0 || trade.mistake_tags.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsRow}>
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
        </View>
      )}

      {/* Thesis & Notes */}
      {trade.thesis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thesis</Text>
          <Text style={styles.bodyText}>{trade.thesis}</Text>
        </View>
      )}
      {trade.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.bodyText}>{trade.notes}</Text>
        </View>
      )}

      {/* Images */}
      {images.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Screenshots</Text>
          <TradeImages images={images} />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          testID="trade-edit-button"
          style={styles.editButton}
          onPress={() => setEditing(true)}
        >
          <Text style={styles.editButtonText}>Edit Trade</Text>
        </Pressable>
        <Pressable testID="trade-delete-button" style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  header: {
    gap: spacing.sm,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  symbol: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  side: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  long: { color: colors.profit, backgroundColor: colors.successLight },
  short: { color: colors.loss, backgroundColor: colors.dangerLight },
  assetClass: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  detailsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bodyText: {
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 24,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  setupTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  setupTagText: { fontSize: fontSize.sm, color: colors.primary },
  mistakeTag: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  mistakeTagText: { fontSize: fontSize.sm, color: colors.warning },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  editButtonText: {
    color: colors.textInverse,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  deleteButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  cancelButton: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
});
