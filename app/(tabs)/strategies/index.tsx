import { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import {
  useStrategies,
  useArchiveStrategy,
  useFavoriteStrategy,
  useUnfavoriteStrategy,
  useReorderFavorites,
} from '@/hooks/use-strategies';
import { StrategyRow } from '@/components/StrategyRow';
import { EmptyState } from '@/components/EmptyState';
import { FavoriteOrderModal } from '@/components/FavoriteOrderModal';
import { ThemedBackground } from '@/components/ThemedBackground';
import { spacing, fontSize as themeFontSize, useThemedStyles, type AppTheme } from '@/lib/theme';
import type { Strategy, StrategyFilters } from '@/types/strategies';

type SectionHeader = { type: 'header'; label: string };
type StrategyListItem = { type: 'item' } & Strategy;
type ListItem = SectionHeader | StrategyListItem;

const SORT_OPTIONS: { label: string; value: StrategyFilters['sortBy'] }[] = [
  { label: 'Status', value: 'status' },
  { label: 'Win Rate', value: 'win_rate' },
  { label: 'Recent', value: 'most_recently_used' },
];

const FILTER_OPTIONS: { label: string; value: StrategyFilters['status'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Testing', value: 'testing' },
  { label: 'Archived', value: 'archived' },
];

export default function StrategiesListScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [sortBy, setSortBy] = useState<StrategyFilters['sortBy']>('status');
  const [statusFilter, setStatusFilter] = useState<StrategyFilters['status']>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [favoriteModalVisible, setFavoriteModalVisible] = useState(false);

  const filters: StrategyFilters = {
    sortBy,
    status: showArchived ? 'all' : statusFilter,
  };
  const { data: strategies, isLoading, refetch } = useStrategies(filters);
  const archiveStrategy = useArchiveStrategy();
  const favoriteStrategy = useFavoriteStrategy();
  const unfavoriteStrategy = useUnfavoriteStrategy();
  const reorderFavorites = useReorderFavorites();
  const favoritesPending = favoriteStrategy.isPending || unfavoriteStrategy.isPending;

  const data = useMemo<ListItem[]>(() => {
    if (!strategies) return [];

    const favorites = strategies.filter((s) => s.favorite_order != null && s.status !== 'archived');
    const active = strategies.filter((s) => s.favorite_order == null && s.status === 'active');
    const testing = strategies.filter((s) => s.favorite_order == null && s.status === 'testing');
    const archived = strategies.filter((s) => s.status === 'archived');

    const items: ListItem[] = [];
    if (favorites.length > 0) {
      items.push({ type: 'header', label: 'Favorites' });
      items.push(...favorites.map((s) => ({ type: 'item' as const, ...s })));
    }
    if (active.length > 0) {
      items.push({ type: 'header', label: 'Active' });
      items.push(...active.map((s) => ({ type: 'item' as const, ...s })));
    }
    if (testing.length > 0) {
      items.push({ type: 'header', label: 'Testing' });
      items.push(...testing.map((s) => ({ type: 'item' as const, ...s })));
    }
    if (showArchived && archived.length > 0) {
      items.push({ type: 'header', label: 'Archived' });
      items.push(...archived.map((s) => ({ type: 'item' as const, ...s })));
    }

    return items;
  }, [strategies, showArchived]);

  const archivedCount = useMemo(
    () => (strategies ?? []).filter((s) => s.status === 'archived').length,
    [strategies]
  );

  const handleArchive = useCallback(
    (id: string) => {
      Alert.alert('Archive Strategy', 'Move this strategy to archived?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => archiveStrategy.mutate(id),
        },
      ]);
    },
    [archiveStrategy]
  );

  const handleToggleFavorite = useCallback(
    (strategy: Strategy) => {
      if (strategy.favorite_order != null) {
        unfavoriteStrategy.mutate(strategy.id);
      } else {
        favoriteStrategy.mutate(strategy.id, {
          onSuccess: () => setFavoriteModalVisible(true),
        });
      }
    },
    [favoriteStrategy, unfavoriteStrategy]
  );

  const favorites = useMemo(
    () => (strategies ?? [])
      .filter((s) => s.favorite_order != null && s.status !== 'archived')
      .sort((a, b) => (a.favorite_order ?? 0) - (b.favorite_order ?? 0)),
    [strategies]
  );

  const handleReorderConfirm = useCallback(
    (reordered: { id: string; favorite_order: number }[]) => {
      reorderFavorites.mutate(reordered);
      setFavoriteModalVisible(false);
    },
    [reorderFavorites]
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return <Text style={styles.sectionHeader}>{item.label}</Text>;
      }
      return (
        <StrategyRow
          item={item}
          onPress={() => router.push(`/(tabs)/strategies/${item.id}`)}
          onArchive={() => handleArchive(item.id)}
          onToggleFavorite={() => handleToggleFavorite(item)}
          favoriteDisabled={favoritesPending}
        />
      );
    },
    [router, styles, handleArchive, handleToggleFavorite, favoritesPending]
  );

  const ListFooter = useCallback(() => {
    if (archivedCount === 0 || showArchived) return null;
    return (
      <Pressable style={styles.archivedToggle} onPress={() => setShowArchived(true)}>
        <Text style={styles.archivedToggleText}>Show archived ({archivedCount})</Text>
      </Pressable>
    );
  }, [archivedCount, showArchived, styles]);

  const ListHeader = useCallback(() => (
    <View style={styles.filterBar}>
      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        {FILTER_OPTIONS.map((opt) => {
          const isActive = (statusFilter ?? undefined) === opt.value
            || (!statusFilter && opt.value === 'all');
          return (
            <Pressable
              key={opt.value ?? 'all'}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => {
                setStatusFilter(opt.value === 'all' ? undefined : opt.value);
                if (opt.value === 'archived') setShowArchived(true);
              }}
            >
              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* Sort selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
        <Text style={styles.sortLabel}>Sort: </Text>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.filterChip, sortBy === opt.value && styles.filterChipActive]}
            onPress={() => setSortBy(opt.value)}
          >
            <Text style={[styles.filterChipText, sortBy === opt.value && styles.filterChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ), [statusFilter, sortBy, styles]);

  return (
    <ThemedBackground>
      <FlashList
        testID="strategies-list"
        data={data}
        renderItem={renderItem}
        getItemType={(item) => item.type}
        keyExtractor={(item) => (item.type === 'item' ? item.id : item.label)}

        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No strategies yet"
              message="Create your first strategy to start tracking your setups."
              actionLabel="Create your first strategy"
              onAction={() => router.push('/(tabs)/strategies/new')}
            />
          ) : null
        }
        ListFooterComponent={ListFooter}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => refetch()} />
        }
        contentContainerStyle={styles.listContent}
      />
      <FavoriteOrderModal
        visible={favoriteModalVisible}
        favorites={favorites}
        onConfirm={handleReorderConfirm}
        onCancel={() => setFavoriteModalVisible(false)}
      />
    </ThemedBackground>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: spacing['4xl'],
    },
    sectionHeader: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      color: colors.textSecondary,
      fontWeight: '600',
      fontSize: 13,
      backgroundColor: colors.background,
    },
    archivedToggle: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    archivedToggleText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    filterBar: {
      paddingVertical: spacing.sm,
      gap: spacing.xs,
    },
    chipScroll: {
      paddingHorizontal: spacing.lg,
    },
    filterChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginRight: spacing.sm,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipText: {
      color: colors.text,
      fontSize: themeFontSize.sm,
    },
    filterChipTextActive: {
      color: colors.textInverse,
      fontWeight: '600',
    },
    sortLabel: {
      color: colors.textSecondary,
      fontSize: themeFontSize.sm,
      alignSelf: 'center',
      marginRight: spacing.xs,
    },
  });
