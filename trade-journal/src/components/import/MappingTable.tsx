import { View, Text, TextInput, StyleSheet } from 'react-native';
import { CANONICAL_FIELDS } from '@/features/import/constants';
import type { CanonicalTradeField, ImportColumnBinding } from '@/features/import/types';
import { fontSize, spacing, borderRadius, fontWeight, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';

interface MappingTableProps {
  bindings: ImportColumnBinding[];
  onChange: (nextBindings: ImportColumnBinding[]) => void;
}

function asField(value: string): CanonicalTradeField | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const match = CANONICAL_FIELDS.find((field) => field === normalized);
  return match ?? null;
}

export function MappingTable({ bindings, onChange }: MappingTableProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const styles = useThemedStyles(createStyles);

  const updateBinding = (index: number, value: string) => {
    const nextField = asField(value);
    const next = bindings.map((binding, idx) => {
      if (idx !== index) {
        if (nextField && binding.targetField === nextField) {
          return {
            ...binding,
            targetField: null,
          };
        }
        return binding;
      }
      return {
        ...binding,
        targetField: nextField,
        isManual: true,
      };
    });

    onChange(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Column Mapping</Text>
      <Text style={styles.hint}>
        Assign each source column to a canonical trade field. Allowed fields: {CANONICAL_FIELDS.join(', ')}
      </Text>
      {bindings.map((binding, idx) => (
        <View key={binding.sourceColumn} style={styles.row}>
          <View style={styles.sourceColumn}>
            <Text style={styles.sourceText}>{binding.sourceColumn}</Text>
            <Text style={styles.confidence}>Confidence: {(binding.confidence * 100).toFixed(0)}%</Text>
          </View>
          <TextInput
            style={styles.input}
            value={binding.targetField ?? ''}
            onChangeText={(text) => updateBinding(idx, text)}
            placeholder="target field"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ))}
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
  container: {
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  sourceColumn: {
    flex: 1,
    gap: 2,
  },
  sourceText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  confidence: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: fontSize.sm,
  },
});
