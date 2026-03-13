import { View, Text, TextInput, Pressable } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { createStrategyFormStyles } from '@/components/strategy-form-styles';
import { NumericRow, ChipField } from '@/components/strategy-form-helpers';
import {
  type StrategyFormData,
  MARKET_CONDITIONS,
  ASSET_CLASSES,
  TIMEFRAMES,
} from '@/types/strategies';
import { useTheme, useThemedStyles } from '@/lib/theme';

type StatusOption = 'active' | 'testing' | 'archived';

interface Props {
  control: Control<StrategyFormData>;
  titleError: string | null;
  onTitleBlur: (title: string) => void;
  statusOptions?: StatusOption[];
  showPlaceholders?: boolean;
  titleTestID?: string;
}

export function StrategyFormFields({
  control,
  titleError,
  onTitleBlur,
  statusOptions = ['active', 'testing'],
  showPlaceholders = false,
  titleTestID,
}: Props) {
  const styles = useThemedStyles(createStrategyFormStyles);
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <>
      {/* Title */}
      <View style={styles.field}>
        <Text style={styles.label}>Title *</Text>
        <Controller
          control={control}
          name="title"
          render={({ field, fieldState }) => (
            <>
              <TextInput
                style={[styles.input, fieldState.error && styles.inputError]}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={() => {
                  field.onBlur();
                  onTitleBlur(field.value);
                }}
                placeholder={showPlaceholders ? 'e.g. Breakout Retest' : undefined}
                placeholderTextColor={colors.textTertiary}
                testID={titleTestID}
              />
              {fieldState.error && (
                <Text style={styles.errorText}>{fieldState.error.message}</Text>
              )}
              {titleError && <Text style={styles.errorText}>{titleError}</Text>}
            </>
          )}
        />
      </View>

      {/* Emoji + Color row */}
      <View style={styles.rowFields}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Emoji</Text>
          <Controller
            control={control}
            name="emoji"
            render={({ field }) => (
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.onChange}
                placeholder={showPlaceholders ? 'e.g. \uD83D\uDCC8' : undefined}
                placeholderTextColor={colors.textTertiary}
              />
            )}
          />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Color</Text>
          <Controller
            control={control}
            name="color"
            render={({ field, fieldState }) => (
              <>
                <TextInput
                  style={styles.input}
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder={showPlaceholders ? '#4A90D9' : undefined}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                />
                {fieldState.error && (
                  <Text style={styles.errorText}>{fieldState.error.message}</Text>
                )}
              </>
            )}
          />
        </View>
      </View>

      {/* Status */}
      <View style={styles.field}>
        <Text style={styles.label}>Status</Text>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <View style={styles.chipRow}>
              {statusOptions.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.chip, field.value === s && styles.chipSelected]}
                  onPress={() => field.onChange(s)}
                >
                  <Text
                    style={[styles.chipText, field.value === s && styles.chipTextSelected]}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        />
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={field.value}
              onChangeText={field.onChange}
              placeholder={showPlaceholders ? 'Describe this strategy...' : undefined}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          )}
        />
      </View>

      {/* Entry Criteria */}
      <View style={styles.field}>
        <Text style={styles.label}>Entry Criteria</Text>
        <Controller
          control={control}
          name="entry_criteria"
          render={({ field }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={field.value}
              onChangeText={field.onChange}
              placeholder={showPlaceholders ? 'When do you enter this setup?' : undefined}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          )}
        />
      </View>

      {/* Exit Criteria */}
      <View style={styles.field}>
        <Text style={styles.label}>Exit Criteria</Text>
        <Controller
          control={control}
          name="exit_criteria"
          render={({ field }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={field.value}
              onChangeText={field.onChange}
              placeholder={showPlaceholders ? 'When do you exit?' : undefined}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          )}
        />
      </View>

      <NumericRow control={control} colors={colors} styles={styles}
        showPlaceholders={showPlaceholders} />

      <ChipField control={control} name="market_conditions" label="Market Conditions"
        options={[...MARKET_CONDITIONS]} styles={styles} formatLabel={(v) => v.replace(/_/g, ' ')} />

      <ChipField control={control} name="asset_classes" label="Asset Classes"
        options={[...ASSET_CLASSES]} styles={styles} />

      <ChipField control={control} name="timeframes" label="Timeframes"
        options={[...TIMEFRAMES]} styles={styles} />

      {/* Notes */}
      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextInput
              style={[styles.input, styles.multiline]}
              value={field.value}
              onChangeText={field.onChange}
              placeholder={showPlaceholders ? 'Additional notes...' : undefined}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          )}
        />
      </View>
    </>
  );
}
