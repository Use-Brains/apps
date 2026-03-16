import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useNetwork } from '@/lib/network';
import { getOfflineFeatureMessage } from '@/lib/offline/ui';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

type MarketplaceListResponse = {
  listings: Array<{
    id: string;
    title: string;
    description: string;
    price_cents: number;
    seller_name: string;
  }>;
};

export default function MarketplaceScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { isOnline } = useNetwork();
  const [listings, setListings] = useState<MarketplaceListResponse['listings']>([]);

  useEffect(() => {
    if (!isOnline) {
      setListings([]);
      return;
    }
    void (async () => {
      try {
        const data = await api.getMarketplace({});
        setListings((data as MarketplaceListResponse).listings ?? []);
      } catch {
        setListings([]);
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Marketplace</Text>
      <Text style={styles.subtitle}>
        {isOnline ? 'Browse and purchase flashcard decks' : getOfflineFeatureMessage('marketplace')}
      </Text>
      <View style={styles.list}>
        {!isOnline ? (
          <Text style={styles.cardSubtitle}>Reconnect to browse listings and purchase decks.</Text>
        ) : null}
        {listings.map((listing) => (
          <Pressable
            key={listing.id}
            style={[styles.card, !isOnline && styles.disabledCard]}
            onPress={() => router.push(`/(tabs)/marketplace/${listing.id}`)}
            disabled={!isOnline}
          >
            <Text style={styles.cardTitle}>{listing.title}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>{listing.description}</Text>
            <Text style={styles.cardMeta}>
              ${Number(listing.price_cents || 0) / 100} · {listing.seller_name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: spacing['3xl'],
      gap: spacing.lg,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
    list: {
      gap: spacing.md,
    },
    card: {
      padding: spacing.lg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    disabledCard: {
      opacity: 0.45,
    },
    cardTitle: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.text,
    },
    cardSubtitle: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    cardMeta: {
      fontSize: fontSize.sm,
      color: colors.primary,
      fontWeight: '500',
    },
  });
