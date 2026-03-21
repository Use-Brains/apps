import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type DeckActionRow = {
  key: string;
  label: string;
  icon?: IoniconName;
  disabled?: boolean;
  muted?: boolean;
  destructive?: boolean;
  loading?: boolean;
  onPress?: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  rows: DeckActionRow[];
  onClose: () => void;
};

export function DeckActionsSheet({ visible, title, rows, onClose }: Props) {
  const styles = useThemedStyles(createStyles);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.content}>
        {rows.map((row) => {
          const textStyle = row.destructive
            ? styles.destructiveText
            : row.muted || row.disabled
              ? styles.mutedText
              : styles.rowText;

          return (
            <Pressable
              key={row.key}
              style={[styles.row, row.disabled && styles.disabledRow]}
              disabled={row.disabled || !row.onPress}
              onPress={row.onPress}
            >
              <View style={styles.leading}>
                {row.loading ? (
                  <ActivityIndicator size="small" color={styles.rowText.color} />
                ) : row.icon ? (
                  <Ionicons
                    name={row.icon}
                    size={20}
                    color={row.destructive ? styles.destructiveText.color : textStyle.color}
                  />
                ) : null}
                <Text style={textStyle}>{row.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    row: {
      borderRadius: borderRadius.lg,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    disabledRow: {
      opacity: 0.7,
    },
    leading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    rowText: {
      color: colors.text,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    mutedText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    destructiveText: {
      color: '#c53d35',
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  });
