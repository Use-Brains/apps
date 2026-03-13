import { useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, FlatList } from 'react-native';
import { spacing, fontSize, borderRadius, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';
import type { Strategy } from '@/types/strategies';

interface Props {
  visible: boolean;
  favorites: Strategy[];
  onConfirm: (reordered: { id: string; favorite_order: number }[]) => void;
  onCancel: () => void;
}

export function FavoriteOrderModal({ visible, favorites, onConfirm, onCancel }: Props) {
  const styles = useThemedStyles(createStyles);
  const { theme } = useTheme();
  const { colors } = theme;
  const [items, setItems] = useState<Strategy[]>(favorites);

  // Reset when modal opens with new favorites
  if (visible && items.length !== favorites.length) {
    setItems(favorites);
  }

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setItems(next);
  };

  const moveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const next = [...items];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setItems(next);
  };

  const handleConfirm = () => {
    onConfirm(items.map((s, i) => ({ id: s.id, favorite_order: i + 1 })));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Reorder Favorites</Text>
            <Pressable onPress={handleConfirm}>
              <Text style={styles.confirmText}>Confirm</Text>
            </Pressable>
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  {item.emoji ? (
                    <Text style={styles.emoji}>{item.emoji}</Text>
                  ) : null}
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                </View>
                <View style={styles.arrows}>
                  <Pressable
                    style={[styles.arrowButton, index === 0 && styles.arrowDisabled]}
                    onPress={() => moveUp(index)}
                    disabled={index === 0}
                  >
                    <Text style={styles.arrowText}>{'\u25B2'}</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.arrowButton,
                      index >= items.length - 1 && styles.arrowDisabled,
                    ]}
                    onPress={() => moveDown(index)}
                    disabled={index >= items.length - 1}
                  >
                    <Text style={styles.arrowText}>{'\u25BC'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: spacing['3xl'],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
    },
    confirmText: {
      color: colors.primary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    rank: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      width: 20,
      textAlign: 'center',
    },
    emoji: {
      fontSize: 20,
    },
    rowTitle: {
      color: colors.text,
      fontSize: fontSize.md,
      flex: 1,
    },
    arrows: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    arrowButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 8,
    },
    arrowDisabled: {
      opacity: 0.3,
    },
    arrowText: {
      color: colors.text,
      fontSize: fontSize.sm,
    },
  });
