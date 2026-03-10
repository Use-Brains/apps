import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { tradeFormSchema, type TradeFormData } from '@/types/trades';
import { useDistinctTags } from '@/hooks/use-trades';
import { useImages } from '@/hooks/use-images';
import { TagInput } from './TagInput';
import { ImagePickerButton } from './ImagePickerButton';
import { colors, fontSize, spacing, borderRadius, fontWeight } from '@/lib/theme';

const ASSET_CLASSES = ['crypto', 'stocks', 'options', 'futures', 'forex'] as const;

interface TradeFormProps {
  defaultValues?: Partial<TradeFormData>;
  onSubmit: (data: TradeFormData, imagePaths: string[]) => Promise<void>;
  submitLabel?: string;
}

export function TradeForm({ defaultValues, onSubmit, submitLabel = 'Save Trade' }: TradeFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const { data: tagData } = useDistinctTags();
  const { images, pickImages, removeImage, uploadImages, reset: resetImages } = useImages();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TradeFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(tradeFormSchema) as any,
    defaultValues: {
      symbol: '',
      asset_class: 'crypto',
      side: 'long',
      status: 'closed',
      entry_price: undefined,
      exit_price: undefined,
      size: undefined,
      fees: 0,
      entry_date: new Date().toISOString(),
      exit_date: new Date().toISOString(),
      confidence: undefined,
      thesis: '',
      notes: '',
      setup_tags: [],
      mistake_tags: [],
      ...defaultValues,
    },
  });

  const status = watch('status');

  const handleFormSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      // Upload images first (will be linked to trade after creation)
      const imagePaths = images.length > 0 ? await uploadImages('pending') : [];
      await onSubmit(data, imagePaths);
      resetImages();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save trade';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Symbol */}
        <View style={styles.field}>
          <Text style={styles.label}>Symbol *</Text>
          <Controller
            control={control}
            name="symbol"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                testID="trade-symbol-input"
                style={[styles.input, errors.symbol && styles.inputError]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="BTC/USD, AAPL, etc."
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
              />
            )}
          />
          {errors.symbol && <Text style={styles.error}>{errors.symbol.message}</Text>}
        </View>

        {/* Side Toggle */}
        <View style={styles.field}>
          <Text style={styles.label}>Side *</Text>
          <Controller
            control={control}
            name="side"
            render={({ field: { onChange, value } }) => (
              <View style={styles.toggleRow}>
                <Pressable
                  testID="trade-side-long-button"
                  style={[styles.toggle, value === 'long' && styles.toggleActive]}
                  onPress={() => onChange('long')}
                >
                  <Text style={[styles.toggleText, value === 'long' && styles.toggleActiveText]}>
                    Long
                  </Text>
                </Pressable>
                <Pressable
                  testID="trade-side-short-button"
                  style={[styles.toggle, value === 'short' && styles.toggleActive]}
                  onPress={() => onChange('short')}
                >
                  <Text style={[styles.toggleText, value === 'short' && styles.toggleActiveText]}>
                    Short
                  </Text>
                </Pressable>
              </View>
            )}
          />
        </View>

        {/* Asset Class */}
        <View style={styles.field}>
          <Text style={styles.label}>Asset Class</Text>
          <Controller
            control={control}
            name="asset_class"
            render={({ field: { onChange, value } }) => (
              <View style={styles.toggleRow}>
                {ASSET_CLASSES.map((ac) => (
                  <Pressable
                    key={ac}
                    testID={`trade-asset-${ac}-chip`}
                    style={[styles.chip, value === ac && styles.chipActive]}
                    onPress={() => onChange(ac)}
                  >
                    <Text style={[styles.chipText, value === ac && styles.chipActiveText]}>
                      {ac}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>

        {/* Status Toggle */}
        <View style={styles.field}>
          <Text style={styles.label}>Status</Text>
          <Controller
            control={control}
            name="status"
            render={({ field: { onChange, value } }) => (
              <View style={styles.toggleRow}>
                <Pressable
                  testID="trade-status-closed-button"
                  style={[styles.toggle, value === 'closed' && styles.toggleActive]}
                  onPress={() => onChange('closed')}
                >
                  <Text style={[styles.toggleText, value === 'closed' && styles.toggleActiveText]}>
                    Closed
                  </Text>
                </Pressable>
                <Pressable
                  testID="trade-status-open-button"
                  style={[styles.toggle, value === 'open' && styles.toggleActive]}
                  onPress={() => onChange('open')}
                >
                  <Text style={[styles.toggleText, value === 'open' && styles.toggleActiveText]}>
                    Open
                  </Text>
                </Pressable>
              </View>
            )}
          />
        </View>

        {/* Prices Row */}
        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Entry Price *</Text>
            <Controller
              control={control}
              name="entry_price"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  testID="trade-entry-price-input"
                  style={[styles.input, errors.entry_price && styles.inputError]}
                  value={value?.toString() ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              )}
            />
            {errors.entry_price && <Text style={styles.error}>{errors.entry_price.message}</Text>}
          </View>

          {status === 'closed' && (
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Exit Price *</Text>
              <Controller
                control={control}
                name="exit_price"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    testID="trade-exit-price-input"
                    style={[styles.input, errors.exit_price && styles.inputError]}
                    value={value?.toString() ?? ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="decimal-pad"
                  />
                )}
              />
              {errors.exit_price && <Text style={styles.error}>{errors.exit_price.message}</Text>}
            </View>
          )}
        </View>

        {/* Size & Fees */}
        <View style={styles.row}>
          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Size *</Text>
            <Controller
              control={control}
              name="size"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  testID="trade-size-input"
                  style={[styles.input, errors.size && styles.inputError]}
                  value={value?.toString() ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Quantity"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              )}
            />
            {errors.size && <Text style={styles.error}>{errors.size.message}</Text>}
          </View>

          <View style={[styles.field, styles.flex]}>
            <Text style={styles.label}>Fees</Text>
            <Controller
              control={control}
              name="fees"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  testID="trade-fees-input"
                  style={styles.input}
                  value={value?.toString() ?? '0'}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="0.00"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </View>
        </View>

        {/* Confidence */}
        <View style={styles.field}>
          <Text style={styles.label}>Confidence (1-5)</Text>
          <Controller
            control={control}
            name="confidence"
            render={({ field: { onChange, value } }) => (
              <View style={styles.toggleRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    testID={`trade-confidence-${n}-button`}
                    style={[styles.confidenceButton, value === n && styles.confidenceActive]}
                    onPress={() => onChange(value === n ? null : n)}
                  >
                    <Text
                      style={[
                        styles.confidenceText,
                        value === n && styles.confidenceActiveText,
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />
        </View>

        {/* Setup Tags */}
        <View style={styles.field}>
          <Text style={styles.label}>Setup Tags</Text>
          <Controller
            control={control}
            name="setup_tags"
            render={({ field: { onChange, value } }) => (
              <TagInput
                tags={value ?? []}
                onChange={onChange}
                suggestions={tagData?.setupTags}
                placeholder="e.g. breakout, support bounce..."
              />
            )}
          />
        </View>

        {/* Mistake Tags */}
        <View style={styles.field}>
          <Text style={styles.label}>Mistake Tags</Text>
          <Controller
            control={control}
            name="mistake_tags"
            render={({ field: { onChange, value } }) => (
              <TagInput
                tags={value ?? []}
                onChange={onChange}
                suggestions={tagData?.mistakeTags}
                placeholder="e.g. fomo, oversized, no stop loss..."
              />
            )}
          />
        </View>

        {/* Thesis */}
        <View style={styles.field}>
          <Text style={styles.label}>Thesis</Text>
          <Controller
            control={control}
            name="thesis"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Why did you take this trade?"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            )}
          />
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Post-trade review notes..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            )}
          />
        </View>

        {/* Images */}
        <View style={styles.field}>
          <Text style={styles.label}>Chart Screenshots</Text>
          <ImagePickerButton
            images={images}
            onPick={pickImages}
            onRemove={removeImage}
          />
        </View>

        {/* Submit */}
        <Pressable
          testID="trade-submit-button"
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleFormSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.submitText}>{submitLabel}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['4xl'],
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
    backgroundColor: colors.background,
  },
  inputError: {
    borderColor: colors.danger,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: fontSize.xs,
    color: colors.danger,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  toggle: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  toggleActiveText: {
    color: colors.textInverse,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  chipActiveText: {
    color: colors.textInverse,
  },
  confidenceButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confidenceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  confidenceText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  confidenceActiveText: {
    color: colors.textInverse,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.textInverse,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
});
