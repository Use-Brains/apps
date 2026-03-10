import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useTrades, useTradeStats } from '@/hooks/use-trades';
import { TradeCard } from '@/components/TradeCard';
import { JournalStats } from '@/components/JournalStats';
import { JournalViewTabs } from '@/components/JournalViewTabs';
import { JournalPeriodScroller } from '@/components/JournalPeriodScroller';
import { EmptyState } from '@/components/EmptyState';
import { spacing, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';
import type { Trade } from '@/types/trades';
import {
  buildJournalPeriodOptions,
  getJournalPeriodRange,
  type JournalPeriodOption,
  type JournalViewMode,
} from '@/utils/journal-periods';

export default function JournalScreen() {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [viewMode, setViewMode] = useState<JournalViewMode>('daily');
  const [anchors, setAnchors] = useState<Record<JournalViewMode, Date>>(() => {
    const now = new Date();
    return {
      daily: now,
      weekly: now,
      monthly: now,
      yearly: now,
    };
  });

  const selectedAnchor = anchors[viewMode];
  const selectedPeriod = useMemo(
    () => getJournalPeriodRange(viewMode, selectedAnchor),
    [viewMode, selectedAnchor]
  );
  const periodOptions = useMemo(
    () => buildJournalPeriodOptions(viewMode, selectedAnchor),
    [viewMode, selectedAnchor]
  );

  const periodFilters = useMemo(
    () => ({
      dateFrom: selectedPeriod.dateFrom,
      dateTo: selectedPeriod.dateTo,
    }),
    [selectedPeriod.dateFrom, selectedPeriod.dateTo]
  );

  const { data: trades, isLoading, refetch } = useTrades(periodFilters);
  const { data: stats } = useTradeStats(periodFilters);

  const tradesForList = useMemo<Trade[]>(
    () => (Array.isArray(trades) ? trades : []),
    [trades]
  );

  const sortedTrades = useMemo(
    () =>
      [...tradesForList].sort(
        (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
      ),
    [tradesForList]
  );

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handlePeriodSelect = useCallback(
    (option: JournalPeriodOption) => {
      setAnchors((previous) => ({
        ...previous,
        [viewMode]: new Date(option.anchorDate),
      }));
    },
    [viewMode]
  );

  const handleTodayPress = useCallback(() => {
    setAnchors((previous) => ({
      ...previous,
      [viewMode]: new Date(),
    }));
  }, [viewMode]);

  const renderItem = useCallback(
    ({ item }: { item: Trade }) => (
      <TradeCard
        trade={item}
        onPress={() => router.push(`/(tabs)/journal/${item.id}`)}
      />
    ),
    [router]
  );

  const ListHeader = useCallback(
    () => (
      <View style={styles.header}>
        <JournalViewTabs value={viewMode} onChange={setViewMode} />
        <JournalPeriodScroller
          title={selectedPeriod.rangeLabel}
          options={periodOptions}
          selectedKey={selectedPeriod.key}
          onSelect={handlePeriodSelect}
          onTodayPress={handleTodayPress}
        />
        {stats && (
          <JournalStats
            totalPnl={stats.totalPnl}
            winRate={stats.winRate}
            tradeCount={stats.tradeCount}
          />
        )}
        <Text style={styles.sectionTitle}>Trades</Text>
      </View>
    ),
    [viewMode, selectedPeriod, periodOptions, handlePeriodSelect, handleTodayPress, stats]
  );

  return (
    <View style={styles.container}>
      <FlashList
        testID="journal-trades-list"
        data={sortedTrades}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No trades in this period"
              message="Try another day, week, month, or year."
            />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: spacing['4xl'],
  },
});
