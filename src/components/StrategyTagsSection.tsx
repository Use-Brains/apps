import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { StrategyPickerSheet } from './StrategyPickerSheet';
import { spacing, fontSize, borderRadius, useThemedStyles, type AppTheme } from '@/lib/theme';
import type { Strategy } from '@/types/strategies';

interface Props {
  selectedStrategies: Strategy[];
  onStrategiesChange: (strategies: Strategy[]) => void;
  strategiesLoading?: boolean;
  strategiesError?: boolean;
  onRetry?: () => void;
}

export function StrategyTagsSection({
  selectedStrategies,
  onStrategiesChange,
  strategiesLoading,
  strategiesError,
  onRetry,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [pickerVisible, setPickerVisible] = useState(false);

  const handleRemove = (id: string) => {
    onStrategiesChange(selectedStrategies.filter((s) => s.id !== id));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Strategy Tags</Text>

      {strategiesLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading strategies...</Text>
        </View>
      )}

      {strategiesError && (
        <Pressable style={styles.errorRow} onPress={onRetry}>
          <Text style={styles.errorText}>
            Could not load existing strategies — tap to retry
          </Text>
        </Pressable>
      )}

      {!strategiesLoading && !strategiesError && (
        <>
          {/* Chips */}
          <View style={styles.chipRow}>
            {selectedStrategies.map((s) => (
              <View key={s.id} style={styles.chip}>
                <Text style={styles.chipText}>
                  {s.emoji ? `${s.emoji} ` : ''}{s.title}
                </Text>
                <Pressable onPress={() => handleRemove(s.id)} hitSlop={8}>
                  <Text style={styles.chipRemove}>{'\u00D7'}</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              style={styles.addButton}
              onPress={() => setPickerVisible(true)}
              testID="strategy-tags-input"
            >
              <Text style={styles.addButtonText}>+ Select strategies</Text>
            </Pressable>
          </View>
        </>
      )}

      <StrategyPickerSheet
        visible={pickerVisible}
        selectedStrategies={selectedStrategies}
        onDone={(updated) => {
          onStrategiesChange(updated);
          setPickerVisible(false);
        }}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.primary + '20',
      borderRadius: borderRadius.full ?? 999,
      borderWidth: 1,
      borderColor: colors.primary + '40',
    },
    chipText: {
      color: colors.primary,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    chipRemove: {
      color: colors.primary,
      fontSize: fontSize.md,
      fontWeight: '700',
      marginLeft: 2,
    },
    addButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full ?? 999,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    addButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    errorRow: {
      paddingVertical: spacing.sm,
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSize.sm,
    },
  });
