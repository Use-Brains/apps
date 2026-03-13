import { View, Text, TextInput, Pressable } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { createStrategyFormStyles } from '@/components/strategy-form-styles';
import type { StrategyFormData } from '@/types/strategies';

type FormStyles = ReturnType<typeof createStrategyFormStyles>;

export function NumericRow({ control, colors, styles, showPlaceholders }: {
  control: Control<StrategyFormData>;
  colors: { textTertiary: string };
  styles: FormStyles;
  showPlaceholders: boolean;
}) {
  return (
    <View style={styles.rowFields}>
      <View style={[styles.field, { flex: 1 }]}>
        <Text style={styles.label}>Expected Win Rate %</Text>
        <Controller control={control} name="expected_win_rate"
          render={({ field, fieldState }) => (
            <>
              <TextInput style={styles.input}
                value={field.value?.toString() ?? ''}
                onChangeText={field.onChange}
                placeholder={showPlaceholders ? 'e.g. 60' : undefined}
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad" />
              {fieldState.error && (
                <Text style={styles.errorText}>{fieldState.error.message}</Text>
              )}
            </>
          )} />
      </View>
      <View style={[styles.field, { flex: 1 }]}>
        <Text style={styles.label}>Risk:Reward Ratio</Text>
        <Controller control={control} name="risk_reward_ratio"
          render={({ field, fieldState }) => (
            <>
              <TextInput style={styles.input}
                value={field.value?.toString() ?? ''}
                onChangeText={field.onChange}
                placeholder={showPlaceholders ? 'e.g. 2.5' : undefined}
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad" />
              {fieldState.error && (
                <Text style={styles.errorText}>{fieldState.error.message}</Text>
              )}
            </>
          )} />
      </View>
    </View>
  );
}

type ArrayFieldName = 'market_conditions' | 'asset_classes' | 'timeframes';

export function ChipField({ control, name, label, options, styles, formatLabel }: {
  control: Control<StrategyFormData>;
  name: ArrayFieldName;
  label: string;
  options: string[];
  styles: FormStyles;
  formatLabel?: (v: string) => string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Controller control={control} name={name}
        render={({ field }) => (
          <View style={styles.chipRow}>
            {options.map((opt) => {
              const selected = field.value?.includes(opt as never);
              return (
                <Pressable key={opt}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => {
                    const next = selected
                      ? (field.value as string[]).filter((v) => v !== opt)
                      : [...(field.value ?? []), opt];
                    field.onChange(next);
                  }}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {formatLabel ? formatLabel(opt) : opt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )} />
    </View>
  );
}
