import { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useTrades, useTradeStats, useDistinctTags } from '@/hooks/use-trades';
import { TradeCard } from '@/components/TradeCard';
import { JournalStats } from '@/components/JournalStats';
import { FilterBar } from '@/components/FilterBar';
import { EmptyState } from '@/components/EmptyState';
import { colors, spacing } from '@/lib/theme';
import type { Trade } from '@/types/trades';

export default function JournalScreen() {
  const router = useRouter();
  const [filters, setFilters] = useState<{
    search?: string;
    side?: 'long' | 'short';
    tag?: string;
  }>({});

  const { data: trades, isLoading, refetch } = useTrades(filters);
  const { data: stats } = useTradeStats(filters);
  const { data: tagData } = useDistinctTags();

  const allTags = [
    ...(tagData?.setupTags ?? []),
    ...(tagData?.mistakeTags ?? []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

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
        {stats && (
          <JournalStats
            totalPnl={stats.totalPnl}
            winRate={stats.winRate}
            tradeCount={stats.tradeCount}
          />
        )}
        <Pressable
          testID="journal-import-csv-button"
          style={styles.importButton}
          onPress={() => router.push('/(tabs)/journal/import')}
        >
          <Text style={styles.importButtonText}>Import CSV</Text>
        </Pressable>
        <FilterBar
          onSearchChange={(search) => setFilters((f) => ({ ...f, search: search || undefined }))}
          onSideFilter={(side) => setFilters((f) => ({ ...f, side }))}
          onTagFilter={(tag) => setFilters((f) => ({ ...f, tag }))}
          activeSide={filters.side}
          activeTag={filters.tag}
          availableTags={allTags}
        />
      </View>
    ),
    [stats, filters.side, filters.tag, allTags]
  );

  return (
    <View style={styles.container}>
      <FlashList
        testID="journal-trades-list"
        data={trades ?? []}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !isLoading ? (
            trades && filters.search ? (
              <EmptyState
                title="No trades found"
                message="Try adjusting your search or filters."
              />
            ) : (
              <EmptyState
                title="No trades yet"
                message="Tap the Add tab to log your first trade."
              />
            )
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  importButton: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  importButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: spacing['4xl'],
  },
});
