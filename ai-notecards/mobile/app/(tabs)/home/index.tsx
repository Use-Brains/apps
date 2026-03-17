import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeckActionsSheet, type DeckActionRow } from '@/components/decks/DeckActionsSheet';
import { DeckCard } from '@/components/decks/DeckCard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getDeckActionState } from '@/lib/decks/deck-actions';
import { createOfflineDeckSnapshot } from '@/lib/offline/snapshot';
import { getDownloadedDecks, removeDownloadedDeck, saveDeckSnapshot } from '@/lib/offline/repository';
import type { OfflineDeck } from '@/lib/offline/types';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { Deck } from '@/types/api';
import { deckKeys } from '@/types/query-keys';
import type { AppTheme } from '@/lib/theme';

export default function DashboardScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [downloadedDecks, setDownloadedDecks] = useState<OfflineDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [downloadingDeckId, setDownloadingDeckId] = useState<string | null>(null);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: deckKeys.lists(),
    queryFn: () => api.getDecks(),
  });

  const refreshDownloadedDecks = useCallback(async () => {
    setDownloadedDecks(await getDownloadedDecks(null));
  }, []);

  const refreshDeckList = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: deckKeys.lists() });
    await refetch();
  }, [queryClient, refetch]);

  useEffect(() => {
    void refreshDownloadedDecks();
  }, [refreshDownloadedDecks]);

  const allDecks = useMemo(() => data?.decks ?? [], [data?.decks]);
  const activeDecks = useMemo(
    () => allDecks.filter((deck) => !deck.archivedAt),
    [allDecks],
  );
  const archivedDecks = useMemo(
    () => allDecks.filter((deck) => !!deck.archivedAt),
    [allDecks],
  );
  const downloadedIds = useMemo(
    () => new Set(downloadedDecks.map((deck) => deck.id)),
    [downloadedDecks],
  );
  const selectedDeck = useMemo(
    () => allDecks.find((deck) => deck.id === selectedDeckId) ?? null,
    [allDecks, selectedDeckId],
  );

  const persistDeckOffline = useCallback(async (deckId: string) => {
    const detail = await api.getDeck(deckId);
    await saveDeckSnapshot(null, createOfflineDeckSnapshot(detail.deck));
    await refreshDownloadedDecks();
  }, [refreshDownloadedDecks]);

  const handleDownload = useCallback(async (deckId: string) => {
    try {
      setDownloadingDeckId(deckId);
      await persistDeckOffline(deckId);
    } catch (error) {
      Alert.alert('Unable to download', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setDownloadingDeckId(null);
    }
  }, [persistDeckOffline]);

  const handleRemoveDownload = useCallback((deckId: string) => {
    Alert.alert(
      'Remove download?',
      'This removes the download from this device only. The deck stays in your account.',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            void (async () => {
              await removeDownloadedDeck(null, deckId);
              await refreshDownloadedDecks();
              setSelectedDeckId(null);
            })();
          },
        },
      ],
    );
  }, [refreshDownloadedDecks]);

  const handleStudy = useCallback(async (deckId: string) => {
    if (!downloadedIds.has(deckId)) {
      try {
        await persistDeckOffline(deckId);
      } catch {
        return;
      }
    }

    router.push(`/study/${deckId}`);
  }, [downloadedIds, persistDeckOffline, router]);

  const handleSell = useCallback((deck: Deck) => {
    setSelectedDeckId(null);

    if (deck.origin === 'purchased') {
      Alert.alert('Unable to sell', 'Purchased decks cannot be sold or relisted from your library.', [
        { text: 'Go Back', style: 'cancel' },
      ]);
      return;
    }

    if (!user || user.plan !== 'pro' || !user.sellerTermsAccepted || !user.stripeConnectOnboarded) {
      Alert.alert(
        'Complete seller onboarding',
        'You need to complete seller onboarding before you can sell a deck.',
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Start Onboarding',
            onPress: () => router.push('/seller'),
          },
        ],
      );
      return;
    }

    router.push(`/sell/${deck.id}`);
  }, [router, user]);

  const handleDeleteOrArchive = useCallback((deck: Deck) => {
    const actionState = getDeckActionState({
      deck,
      user,
      isDownloaded: downloadedIds.has(deck.id),
      isDownloading: downloadingDeckId === deck.id,
    });

    if (actionState.deleteLabel === 'Delete') {
      Alert.alert(
        'Delete deck?',
        'This will delete the deck from your account and cannot be undone.',
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await api.deleteDeck(deck.id);
                  if (downloadedIds.has(deck.id)) {
                    await removeDownloadedDeck(null, deck.id);
                    await refreshDownloadedDecks();
                  }
                  await refreshDeckList();
                  setSelectedDeckId(null);
                } catch (error) {
                  Alert.alert('Unable to delete', error instanceof Error ? error.message : 'Please try again.');
                }
              })();
            },
          },
        ],
      );
      return;
    }

    if (actionState.deleteLabel === 'Archive') {
      Alert.alert(
        'Archive deck?',
        'This purchased deck will be moved to Archived at the bottom of Home.',
        [
          { text: 'Go Back', style: 'cancel' },
          {
            text: 'Archive',
            onPress: () => {
              void (async () => {
                try {
                  await api.archiveDeck(deck.id);
                  if (downloadedIds.has(deck.id)) {
                    await removeDownloadedDeck(null, deck.id);
                    await refreshDownloadedDecks();
                  }
                  await refreshDeckList();
                  setSelectedDeckId(null);
                } catch (error) {
                  Alert.alert('Unable to archive', error instanceof Error ? error.message : 'Please try again.');
                }
              })();
            },
          },
        ],
      );
      return;
    }

    void (async () => {
      try {
        await api.unarchiveDeck(deck.id);
        await refreshDeckList();
        setSelectedDeckId(null);
      } catch (error) {
        Alert.alert('Unable to restore', error instanceof Error ? error.message : 'Please try again.');
      }
    })();
  }, [downloadedIds, downloadingDeckId, refreshDeckList, refreshDownloadedDecks, user]);

  const actionRows = useMemo<DeckActionRow[]>(() => {
    if (!selectedDeck) return [];

    const actionState = getDeckActionState({
      deck: selectedDeck,
      user,
      isDownloaded: downloadedIds.has(selectedDeck.id),
      isDownloading: downloadingDeckId === selectedDeck.id,
    });

    const rows: DeckActionRow[] = [];

    if (downloadingDeckId === selectedDeck.id) {
      rows.push({
        key: 'download',
        label: 'Download',
        loading: true,
        disabled: true,
      });
    } else if (actionState.isDownloadedIndicatorVisible) {
      rows.push({
        key: 'downloaded',
        label: 'Downloaded',
        icon: 'checkmark-circle-outline',
        disabled: true,
      });
    } else {
      rows.push({
        key: 'download',
        label: 'Download',
        icon: 'cloud-download-outline',
        onPress: () => {
          void handleDownload(selectedDeck.id);
        },
      });
    }

    if (actionState.canRemoveDownload) {
      rows.push({
        key: 'remove-download',
        label: 'Remove Download',
        icon: 'cloud-offline-outline',
        onPress: () => handleRemoveDownload(selectedDeck.id),
      });
    }

    rows.push({
      key: 'sell',
      label: 'Sell',
      icon: 'pricetag-outline',
      muted: !actionState.canSell,
      onPress: () => handleSell(selectedDeck),
    });

    rows.push({
      key: 'delete-or-archive',
      label: actionState.deleteLabel,
      icon:
        actionState.deleteLabel === 'Restore'
          ? 'arrow-up-circle-outline'
          : actionState.deleteLabel === 'Delete'
            ? 'trash-outline'
            : 'archive-outline',
      destructive: actionState.isDeleteDestructive,
      onPress: () => handleDeleteOrArchive(selectedDeck),
    });

    return rows;
  }, [downloadedIds, downloadingDeckId, handleDeleteOrArchive, handleDownload, handleRemoveDownload, handleSell, selectedDeck, user]);

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Decks</Text>
            <Pressable onPress={() => void refetch()}>
              <Text style={styles.linkText}>Refresh</Text>
            </Pressable>
          </View>
          {isLoading ? (
            <Text style={styles.emptyText}>Loading decks...</Text>
          ) : isError ? (
            <Text style={styles.emptyText}>Unable to load decks right now.</Text>
          ) : activeDecks.length === 0 ? (
            <Text style={styles.emptyText}>No active decks yet.</Text>
          ) : (
            activeDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                title={deck.title}
                onOpen={() => router.push(`/decks/${deck.id}`)}
                onStudy={() => void handleStudy(deck.id)}
                onOpenActions={() => setSelectedDeckId(deck.id)}
              />
            ))
          )}
        </View>

        {archivedDecks.length > 0 ? (
          <View style={styles.section}>
            <Pressable style={styles.archivedHeader} onPress={() => setArchivedExpanded((current) => !current)}>
              <Text style={styles.sectionTitle}>Archived</Text>
              <View style={styles.archivedHeaderRight}>
                <Text style={styles.archivedCount}>{archivedDecks.length}</Text>
                <Ionicons
                  name={archivedExpanded ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={styles.archivedIcon.color}
                />
              </View>
            </Pressable>

            {archivedExpanded ? (
              archivedDecks.map((deck) => (
                <DeckCard
                  key={deck.id}
                  title={deck.title}
                  onOpen={() => router.push(`/decks/${deck.id}`)}
                  onStudy={() => void handleStudy(deck.id)}
                  onOpenActions={() => setSelectedDeckId(deck.id)}
                />
              ))
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <DeckActionsSheet
        visible={!!selectedDeck}
        title={selectedDeck?.title ?? 'Deck Actions'}
        rows={actionRows}
        onClose={() => setSelectedDeckId(null)}
      />
    </>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      padding: spacing['3xl'],
      gap: spacing.xl,
      backgroundColor: colors.background,
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
    linkText: {
      color: colors.primary,
      fontWeight: '600',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
    },
    archivedHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    archivedHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    archivedCount: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    archivedIcon: {
      color: colors.textSecondary,
    },
  });
