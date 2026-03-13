import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { spacing, useThemedStyles, type AppTheme } from '@/lib/theme';
import type { Strategy } from '@/types/strategies';

interface Props {
  item: Strategy;
  onPress: () => void;
  onArchive: () => void;
  onToggleFavorite: () => void;
  favoriteDisabled: boolean;
}

export function StrategyRow({
  item,
  onPress,
  onArchive,
  onToggleFavorite,
  favoriteDisabled,
}: Props) {
  const styles = useThemedStyles(createStyles);

  const renderRightActions = () => (
    <Pressable style={styles.archiveAction} onPress={onArchive}>
      <Text style={styles.archiveActionText}>Archive</Text>
    </Pressable>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <Pressable style={styles.row} onPress={onPress}>
        <View style={styles.rowLeft}>
          {item.emoji ? (
            <Text style={styles.emoji}>{item.emoji}</Text>
          ) : (
            <View style={[styles.colorDot, { backgroundColor: item.color ?? '#888' }]} />
          )}
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.rowSubtitle}>{item.status}</Text>
          </View>
        </View>
        {item.status !== 'archived' && (
          <Pressable
            onPress={onToggleFavorite}
            disabled={favoriteDisabled}
            style={[styles.starButton, favoriteDisabled && { opacity: 0.4 }]}
            testID={`strategy-star-${item.title}`}
          >
            <Text style={styles.starText}>
              {item.favorite_order != null ? '\u2605' : '\u2606'}
            </Text>
          </Pressable>
        )}
      </Pressable>
    </Swipeable>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    emoji: {
      fontSize: 24,
    },
    colorDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    rowInfo: {
      flex: 1,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    rowSubtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    archiveAction: {
      backgroundColor: colors.destructive,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    archiveActionText: {
      color: colors.textInverse,
      fontWeight: '600',
    },
    starButton: {
      padding: spacing.sm,
    },
    starText: {
      fontSize: 22,
      color: colors.primary,
    },
  });
