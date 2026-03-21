import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { getDownloadedDeck, removeDownloadedDeck, saveDeckSnapshot } from '@/lib/offline/repository';
import { createOfflineDeckSnapshot } from '@/lib/offline/snapshot';
import type { DeckWithCards } from '@/types/api';
import type { OfflineDeck } from '@/lib/offline/types';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const [deck, setDeck] = useState<DeckWithCards | null>(null);
  const [downloadedDeck, setDownloadedDeck] = useState<OfflineDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const [detail, localDeck] = await Promise.all([
          api.getDeck(id),
          getDownloadedDeck(null, id),
        ]);

        if (cancelled) return;

        setDeck(detail.deck);
        setDownloadedDeck(localDeck);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDownload = async () => {
    if (!deck) return;
    try {
      setBusy(true);
      await saveDeckSnapshot(null, createOfflineDeckSnapshot(deck));
      setDownloadedDeck(await getDownloadedDeck(null, deck.id));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!deck) return;
    try {
      setBusy(true);
      await removeDownloadedDeck(null, deck.id);
      setDownloadedDeck(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Deck not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Deck Detail</Text>
      <Text style={styles.subtitle}>{deck.title}</Text>

      <View style={styles.card}>
        <Text style={styles.meta}>{deck.cardCount} cards</Text>
        <Text style={styles.meta}>
          {downloadedDeck ? 'Saved offline' : 'Online only'}
        </Text>
        <View style={styles.actions}>
          {downloadedDeck ? (
            <>
              <Pressable style={styles.primaryButton} onPress={() => router.push(`/study/${deck.id}`)}>
                <Text style={styles.primaryButtonText}>Study Offline</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void handleRemove()} disabled={busy}>
                <Text style={styles.secondaryButtonText}>{busy ? 'Removing...' : 'Remove Download'}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.primaryButton} onPress={() => void handleDownload()} disabled={busy}>
              <Text style={styles.primaryButtonText}>{busy ? 'Saving...' : 'Download for Offline'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cards</Text>
        {deck.cards.map((card, index) => (
          <View key={card.id} style={styles.cardRow}>
            <Text style={styles.cardIndex}>{index + 1}.</Text>
            <View style={styles.cardCopy}>
              <Text style={styles.cardFront}>{card.front}</Text>
              <Text style={styles.cardBack}>{card.back}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      padding: spacing['3xl'],
      gap: spacing.xl,
      backgroundColor: colors.background,
    },
    centered: {
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
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
    card: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      gap: spacing.md,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    actions: {
      gap: spacing.sm,
    },
    primaryButton: {
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.surface,
      fontWeight: '700',
    },
    secondaryButton: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: '600',
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    cardRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    cardIndex: {
      color: colors.textTertiary,
      width: 24,
    },
    cardCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    cardFront: {
      color: colors.text,
      fontWeight: '600',
    },
    cardBack: {
      color: colors.textSecondary,
    },
  });
