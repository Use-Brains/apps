import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useNetwork } from '@/lib/network';
import { getOfflineFeatureMessage } from '@/lib/offline/ui';
import { BottomSheet } from '@/components/BottomSheet';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import { marketplaceKeys } from '@/types/query-keys';
import type { AppTheme } from '@/lib/theme';
import type { MarketplaceCategory, MarketplacePurchaseAvailability } from '@/types/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type RawListing = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  purchase_count: number;
  average_rating: number;
  rating_count: number;
  card_count: number;
  seller_name: string;
  category_name: string;
};

type MarketplaceResponse = {
  listings: RawListing[];
  nextCursor?: string | null;
  purchaseAvailability?: MarketplacePurchaseAvailability;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { label: 'Most Popular', value: 'popular' },
  { label: 'Newest', value: 'newest' },
  { label: 'Highest Rated', value: 'rating' },
  { label: 'Price: Low to High', value: 'price_low' },
  { label: 'Price: High to Low', value: 'price_high' },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

// ── Sub-components ────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  const styles = useThemedStyles(createStyles);
  if (count < 3) {
    return (
      <View style={styles.newBadge}>
        <Text style={styles.newBadgeText}>New</Text>
      </View>
    );
  }
  const full = Math.round(rating);
  return (
    <Text style={styles.stars}>
      {'★'.repeat(full)}
      {'☆'.repeat(5 - full)}
      {'  '}
      <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
      <Text style={styles.ratingCount}> ({count})</Text>
    </Text>
  );
}

// ── Filter Sheet Content ──────────────────────────────────────────────────────

type FilterSheetProps = {
  categories: MarketplaceCategory[];
  pendingSort: SortValue;
  setPendingSort: (s: SortValue) => void;
  pendingCategory: string | null;
  setPendingCategory: (c: string | null) => void;
  onApply: () => void;
  onClear: () => void;
  activeFilterCount: number;
};

function FilterSheetContent({
  categories,
  pendingSort,
  setPendingSort,
  pendingCategory,
  setPendingCategory,
  onApply,
  onClear,
  activeFilterCount,
}: FilterSheetProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.sheetContent}>
      <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
        {/* Sort section */}
        <Text style={styles.sectionLabel}>SORT BY</Text>
        {SORT_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={styles.radioRow}
            onPress={() => setPendingSort(opt.value)}
          >
            <View style={[styles.radioOuter, pendingSort === opt.value && styles.radioOuterActive]}>
              {pendingSort === opt.value && <View style={styles.radioInner} />}
            </View>
            <Text style={[styles.radioLabel, pendingSort === opt.value && styles.radioLabelActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}

        {/* Category section */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>CATEGORY</Text>
        <Pressable style={styles.radioRow} onPress={() => setPendingCategory(null)}>
          <View style={[styles.radioOuter, pendingCategory === null && styles.radioOuterActive]}>
            {pendingCategory === null && <View style={styles.radioInner} />}
          </View>
          <Text style={[styles.radioLabel, pendingCategory === null && styles.radioLabelActive]}>
            All categories
          </Text>
        </Pressable>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            style={styles.radioRow}
            onPress={() => setPendingCategory(pendingCategory === cat.slug ? null : cat.slug)}
          >
            <View style={[styles.radioOuter, pendingCategory === cat.slug && styles.radioOuterActive]}>
              {pendingCategory === cat.slug && <View style={styles.radioInner} />}
            </View>
            <Text style={[styles.radioLabel, pendingCategory === cat.slug && styles.radioLabelActive]}>
              {cat.name}
            </Text>
            {cat.listingCount > 0 && (
              <Text style={styles.catCount}>{cat.listingCount}</Text>
            )}
          </Pressable>
        ))}

        {/* Spacer so last row isn't behind the button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Apply / Clear row — pinned above scroll */}
      <View style={styles.sheetFooter}>
        {activeFilterCount > 0 ? (
          <Pressable onPress={onClear} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Clear all</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={onApply} style={styles.applyButton}>
          <Text style={styles.applyButtonText}>
            Apply{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MarketplaceScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { isOnline } = useNetwork();

  // Applied filters (drive the query)
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [sort, setSort] = useState<SortValue>('popular');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Pending filters (inside the sheet, not yet applied)
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pendingSort, setPendingSort] = useState<SortValue>('popular');
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  // Pagination
  const [allListings, setAllListings] = useState<RawListing[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Categories ──────────────────────────────────────────────────────────────
  const { data: catData } = useQuery({
    queryKey: marketplaceKeys.categories(),
    queryFn: () => api.getCategories() as Promise<{ categories: MarketplaceCategory[] }>,
    enabled: isOnline,
    staleTime: 60 * 60 * 1000,
  });
  const categories = catData?.categories ?? [];

  // ── Listings query ──────────────────────────────────────────────────────────
  const params: Record<string, string> = { sort };
  if (activeCategory) params.category = activeCategory;
  if (activeSearch.trim()) params.q = activeSearch.trim();

  const { isLoading, isError, refetch, data } = useQuery({
    queryKey: marketplaceKeys.list(params),
    queryFn: () => api.getMarketplace(params) as Promise<MarketplaceResponse>,
    enabled: isOnline,
  });

  // Sync listings when query data arrives
  useEffect(() => {
    if (data) {
      setAllListings(data.listings ?? []);
      setNextCursor(data.nextCursor ?? null);
    }
  }, [data]);

  // Reset accumulated list on filter change
  useEffect(() => {
    setAllListings([]);
    setNextCursor(null);
  }, [sort, activeCategory, activeSearch]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setActiveSearch(text), 400);
  };

  const openSheet = () => {
    // Seed pending state from current applied filters
    setPendingSort(sort);
    setPendingCategory(activeCategory);
    setSheetVisible(true);
  };

  const handleApply = () => {
    setSort(pendingSort);
    setActiveCategory(pendingCategory);
    setSheetVisible(false);
  };

  const handleClear = () => {
    setPendingSort('popular');
    setPendingCategory(null);
  };

  const handleRemoveCategoryChip = () => setActiveCategory(null);
  const handleRemoveSortChip = () => setSort('popular');

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const moreParams: Record<string, string> = { ...params, cursor: nextCursor };
      const more = (await api.getMarketplace(moreParams)) as MarketplaceResponse;
      setAllListings((prev) => [...prev, ...(more.listings ?? [])]);
      setNextCursor(more.nextCursor ?? null);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const purchaseAvailability = data?.purchaseAvailability ?? null;
  const iosPurchasesEnabled = purchaseAvailability?.ios_native.enabled !== false;
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Sort';
  const categoryLabel = categories.find((c) => c.slug === activeCategory)?.name ?? null;
  const activeFilterCount = (sort !== 'popular' ? 1 : 0) + (activeCategory ? 1 : 0);
  const listingCountLabel = isLoading
    ? ''
    : `${allListings.length}${nextCursor ? '+' : ''} deck${allListings.length !== 1 ? 's' : ''}`;

  // Pending filter count (for the sheet Apply button)
  const pendingFilterCount = (pendingSort !== 'popular' ? 1 : 0) + (pendingCategory ? 1 : 0);

  if (!isOnline) {
    return (
      <View style={styles.offlineContainer}>
        <Text style={styles.offlineText}>{getOfflineFeatureMessage('marketplace')}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        data={allListings}
        keyExtractor={(item) => item.id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Search + filter row */}
            <View style={styles.searchRow}>
              <View style={styles.searchInputWrap}>
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={styles.searchIcon.color}
                  style={styles.searchIconPos}
                />
                <TextInput
                  style={styles.searchInput}
                  value={searchInput}
                  onChangeText={handleSearchChange}
                  placeholder="Search decks..."
                  placeholderTextColor={styles.placeholder.color}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>
              <Pressable onPress={openSheet} style={styles.filterButton} hitSlop={6}>
                <Ionicons name="options-outline" size={20} color={styles.filterIcon.color} />
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Active filter chips — only shown when something non-default is active */}
            {(activeCategory || sort !== 'popular') && (
              <View style={styles.activeChips}>
                {sort !== 'popular' && (
                  <Pressable style={styles.activeChip} onPress={handleRemoveSortChip}>
                    <Text style={styles.activeChipText}>{sortLabel}</Text>
                    <Text style={styles.activeChipX}> ×</Text>
                  </Pressable>
                )}
                {categoryLabel && (
                  <Pressable style={styles.activeChip} onPress={handleRemoveCategoryChip}>
                    <Text style={styles.activeChipText}>{categoryLabel}</Text>
                    <Text style={styles.activeChipX}> ×</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Listing count + iOS purchase banner */}
            {listingCountLabel ? (
              <Text style={styles.listingCount}>{listingCountLabel}</Text>
            ) : null}

            {!iosPurchasesEnabled && (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {purchaseAvailability?.ios_native.message ||
                    'Marketplace purchases are temporarily disabled in the iOS app.'}
                </Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={styles.activityColor.color} />
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>Couldn't load listings</Text>
              <Pressable onPress={() => void refetch()} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>
                {activeSearch ? 'No decks found' : 'No decks in this category yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeSearch
                  ? 'Try different keywords or change your filters.'
                  : 'Be the first to publish!'}
              </Text>
              {activeCategory ? (
                <Pressable onPress={handleRemoveCategoryChip}>
                  <Text style={styles.linkText}>Browse all categories</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          nextCursor ? (
            <View style={styles.loadMoreContainer}>
              {loadingMore ? (
                <ActivityIndicator size="small" color={styles.activityColor.color} />
              ) : (
                <Pressable onPress={handleLoadMore} style={styles.loadMoreButton}>
                  <Text style={styles.loadMoreText}>Load more</Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/(tabs)/marketplace/${item.id}`)}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.cardPrice}>${(item.price_cents / 100).toFixed(2)}</Text>
            </View>
            {item.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMetaText}>
                {item.card_count} cards · {item.category_name}
              </Text>
              <StarRating rating={item.average_rating} count={item.rating_count} />
            </View>
            <View style={styles.cardBottom}>
              {item.seller_name ? (
                <Text style={styles.sellerText}>by {item.seller_name}</Text>
              ) : null}
              {item.purchase_count > 0 ? (
                <Text style={styles.cardMetaText}>{item.purchase_count} sold</Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {/* Filter bottom sheet */}
      <BottomSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="Filter & Sort">
        <FilterSheetContent
          categories={categories}
          pendingSort={pendingSort}
          setPendingSort={setPendingSort}
          pendingCategory={pendingCategory}
          setPendingCategory={setPendingCategory}
          onApply={handleApply}
          onClear={handleClear}
          activeFilterCount={pendingFilterCount}
        />
      </BottomSheet>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingBottom: spacing['4xl'] },
    offlineContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
      backgroundColor: colors.background,
    },
    offlineText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },

    // Header
    header: { padding: spacing['2xl'], gap: spacing.md },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    searchInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
    },
    searchIconPos: { marginLeft: spacing.md },
    searchInput: {
      flex: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.text,
    },
    filterButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadge: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

    // Active chips
    activeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    activeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    activeChipText: { fontSize: fontSize.sm, color: '#fff', fontWeight: '500' },
    activeChipX: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

    listingCount: { fontSize: fontSize.sm, color: colors.textTertiary },
    banner: {
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerText: { color: colors.textSecondary, fontSize: fontSize.sm },

    // Empty / loading states
    centered: {
      paddingTop: spacing['4xl'],
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing['2xl'],
    },
    emptyTitle: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, textAlign: 'center' },
    emptySubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
    linkText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
    retryButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    retryText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
    loadMoreContainer: { padding: spacing['2xl'], alignItems: 'center' },
    loadMoreButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    loadMoreText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '500' },

    // Listing card
    card: {
      marginHorizontal: spacing['2xl'],
      marginBottom: spacing.md,
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    cardTitle: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.text },
    cardPrice: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
    cardDescription: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
    cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardMetaText: { fontSize: fontSize.xs, color: colors.textTertiary },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sellerText: { fontSize: fontSize.xs, color: colors.textSecondary },
    stars: { fontSize: fontSize.xs, color: colors.warning },
    ratingValue: { color: colors.text, fontWeight: '600' },
    ratingCount: { color: colors.textTertiary },
    newBadge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    newBadgeText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '500' },

    // Filter sheet
    sheetContent: { flex: 0, maxHeight: 540 },
    sheetScroll: { paddingHorizontal: spacing['2xl'] },
    sectionLabel: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      letterSpacing: 0.8,
      color: colors.textTertiary,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    sectionLabelSpaced: { marginTop: spacing.xl },
    radioRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    radioOuterActive: { borderColor: colors.primary },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    radioLabel: { flex: 1, fontSize: fontSize.md, color: colors.textSecondary },
    radioLabelActive: { color: colors.text, fontWeight: '600' },
    catCount: { fontSize: fontSize.xs, color: colors.textTertiary, marginLeft: spacing.sm },
    sheetFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    clearButton: { padding: spacing.sm },
    clearButtonText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
    applyButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.primary,
    },
    applyButtonText: { fontSize: fontSize.sm, fontWeight: '700', color: '#fff' },

    // Icon color helpers
    searchIcon: { color: colors.textTertiary },
    filterIcon: { color: colors.text },
    activityColor: { color: colors.primary },
    placeholder: { color: colors.textTertiary },
  });
