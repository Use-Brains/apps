import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api, ApiError } from '@/lib/api';
import { useNetwork } from '@/lib/network';
import { getOfflineFeatureMessage } from '@/lib/offline/ui';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

type ListingResponse = {
  listing: {
    id: string;
    title: string;
    description: string;
    price_cents: number;
    seller_name: string;
  };
  totalCards: number;
};

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useThemedStyles(createStyles);
  const { isOnline } = useNetwork();
  const [listing, setListing] = useState<ListingResponse['listing'] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (!isOnline) {
      setListing(null);
      return;
    }
    void (async () => {
      try {
        const data = await api.getListing(id);
        setListing((data as ListingResponse).listing);
      } catch {
        setListing(null);
      }
    })();
  }, [id, isOnline]);

  const handlePurchase = async () => {
    if (!id) return;
    if (!isOnline) {
      Alert.alert('Offline', getOfflineFeatureMessage('marketplace'));
      return;
    }
    setBusy(true);
    try {
      const data = await api.createPurchase(id);
      await WebBrowser.openBrowserAsync(data.url);
    } catch (error) {
      if (error instanceof ApiError && error.data.code === 'IOS_MARKETPLACE_WEB_PURCHASES_DISABLED') {
        Alert.alert('Purchase unavailable', 'Marketplace purchases are temporarily disabled in the iOS app.');
      } else {
        Alert.alert('Unable to open checkout', error instanceof Error ? error.message : 'Please try again');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{listing?.title || 'Listing Detail'}</Text>
      <Text style={styles.subtitle}>
        {isOnline
          ? (listing?.description || `Listing ID: ${id}`)
          : getOfflineFeatureMessage('marketplace')}
      </Text>
      {listing ? (
        <>
          <Text style={styles.meta}>Seller: {listing.seller_name}</Text>
          <Text style={styles.price}>${(listing.price_cents / 100).toFixed(2)}</Text>
          <Pressable style={styles.button} onPress={() => void handlePurchase()} disabled={busy}>
            <Text style={styles.buttonText}>Buy in Browser</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
      backgroundColor: colors.background,
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    meta: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    price: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.primary,
      marginBottom: spacing.lg,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      borderRadius: 12,
    },
    buttonText: {
      color: colors.surface,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  });
