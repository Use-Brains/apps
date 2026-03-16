import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { getDownloadedDecks, removeDownloadedDeck } from '@/lib/offline/repository';
import type { OfflineDeck } from '@/lib/offline/types';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

function estimateBytes(deck: OfflineDeck) {
  return deck.cards.reduce((total, card) => total + card.front.length + card.back.length, 0);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function ManageDownloads() {
  const styles = useThemedStyles(createStyles);
  const [decks, setDecks] = useState<OfflineDeck[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const refresh = async () => {
    setDecks(await getDownloadedDecks(null));
    setLastRefreshedAt(new Date().toISOString());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const totalBytes = useMemo(
    () => decks.reduce((sum, deck) => sum + estimateBytes(deck), 0),
    [decks],
  );

  const handleRemoveAll = () => {
    Alert.alert(
      'Remove all downloads?',
      'This will delete every offline deck from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              for (const deck of decks) {
                await removeDownloadedDeck(null, deck.id);
              }
              await refresh();
            })();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Manage Downloads</Text>
          <Text style={styles.subtitle}>
            {decks.length} deck{decks.length === 1 ? '' : 's'} • {formatBytes(totalBytes)}
          </Text>
          {lastRefreshedAt ? (
            <Text style={styles.caption}>Last refreshed {new Date(lastRefreshedAt).toLocaleTimeString()}</Text>
          ) : null}
        </View>
        {decks.length > 0 ? (
          <Pressable onPress={handleRemoveAll}>
            <Text style={styles.link}>Remove All</Text>
          </Pressable>
        ) : null}
      </View>

      {decks.length === 0 ? (
        <Text style={styles.empty}>No offline decks yet.</Text>
      ) : (
        decks.map((deck) => (
          <View key={deck.id} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.rowTitle}>{deck.title}</Text>
              <Text style={styles.rowSubtitle}>
                {deck.cardCount} cards • {formatBytes(estimateBytes(deck))}
              </Text>
            </View>
            <Pressable
              style={styles.button}
              onPress={() => {
                void (async () => {
                  await removeDownloadedDeck(null, deck.id);
                  await refresh();
                })();
              }}
            >
              <Text style={styles.buttonText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    title: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    caption: {
      marginTop: spacing.xs,
      color: colors.textTertiary,
      fontSize: fontSize.xs,
    },
    link: {
      color: colors.primary,
      fontWeight: '600',
    },
    empty: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    copy: {
      flex: 1,
      gap: spacing.xs,
    },
    rowTitle: {
      color: colors.text,
      fontWeight: '600',
      fontSize: fontSize.sm,
    },
    rowSubtitle: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
    },
    button: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    buttonText: {
      color: colors.text,
      fontWeight: '600',
      fontSize: fontSize.sm,
    },
  });
