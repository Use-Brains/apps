import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { createOfflineDeckSnapshot } from '@/lib/offline/snapshot';
import { getDownloadedDecks, removeDownloadedDeck, saveDeckSnapshot } from '@/lib/offline/repository';
import type { OfflineDeck } from '@/lib/offline/types';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import { deckKeys } from '@/types/query-keys';
import type { AppTheme } from '@/lib/theme';

export default function DashboardScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [downloadedDecks, setDownloadedDecks] = useState<OfflineDeck[]>([]);
  const [busyDeckId, setBusyDeckId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: deckKeys.lists(),
    queryFn: () => api.getDecks(),
  });

  const refreshDownloadedDecks = useCallback(async () => {
    setDownloadedDecks(await getDownloadedDecks(null));
  }, []);

  useEffect(() => {
    void refreshDownloadedDecks();
  }, [refreshDownloadedDecks]);

  const downloadedIds = useMemo(
    () => new Set(downloadedDecks.map((deck) => deck.id)),
    [downloadedDecks],
  );

  const handleDownload = async (deckId: string) => {
    try {
      setBusyDeckId(deckId);
      const detail = await api.getDeck(deckId);
      await saveDeckSnapshot(null, createOfflineDeckSnapshot(detail.deck));
      await refreshDownloadedDecks();
    } finally {
      setBusyDeckId(null);
    }
  };

  const handleRemove = async (deckId: string) => {
    try {
      setBusyDeckId(deckId);
      await removeDownloadedDeck(null, deckId);
      await refreshDownloadedDecks();
    } finally {
      setBusyDeckId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Decks</Text>
      <Text style={styles.subtitle}>Download decks for offline study, or open one to manage details.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Downloaded</Text>
        {downloadedDecks.length === 0 ? (
          <Text style={styles.emptyText}>No decks saved offline yet.</Text>
        ) : (
          downloadedDecks.map((deck) => (
            <View key={deck.id} style={styles.card}>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{deck.title}</Text>
                <Text style={styles.cardMeta}>{deck.cardCount} cards • available offline</Text>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.primaryButton} onPress={() => router.push(`/study/${deck.id}`)}>
                  <Text style={styles.primaryButtonText}>Study</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => void handleRemove(deck.id)} disabled={busyDeckId === deck.id}>
                  <Text style={styles.secondaryButtonText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Decks</Text>
          <Pressable onPress={() => void refetch()}>
            <Text style={styles.linkText}>Refresh</Text>
          </Pressable>
        </View>
        {isLoading ? (
          <ActivityIndicator />
        ) : isError ? (
          <Text style={styles.emptyText}>Unable to load decks right now.</Text>
        ) : (
          data?.decks.map((deck) => (
            <View key={deck.id} style={styles.card}>
              <View style={styles.copy}>
                <Text style={styles.cardTitle}>{deck.title}</Text>
                <Text style={styles.cardMeta}>
                  {deck.cardCount} cards • {downloadedIds.has(deck.id) ? 'downloaded' : 'online only'}
                </Text>
              </View>
              <View style={styles.actions}>
                <Pressable style={styles.secondaryButton} onPress={() => router.push(`/decks/${deck.id}`)}>
                  <Text style={styles.secondaryButtonText}>Open</Text>
                </Pressable>
                {downloadedIds.has(deck.id) ? (
                  <Pressable style={styles.primaryButton} onPress={() => router.push(`/study/${deck.id}`)}>
                    <Text style={styles.primaryButtonText}>Study</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.primaryButton} onPress={() => void handleDownload(deck.id)} disabled={busyDeckId === deck.id}>
                    <Text style={styles.primaryButtonText}>{busyDeckId === deck.id ? 'Saving...' : 'Download'}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
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
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
    section: {
      gap: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.text,
    },
    emptyText: {
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
    copy: {
      gap: spacing.xs,
    },
    cardTitle: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    cardMeta: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    primaryButton: {
      flex: 1,
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
      flex: 1,
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
    linkText: {
      color: colors.primary,
      fontWeight: '600',
    },
  });
