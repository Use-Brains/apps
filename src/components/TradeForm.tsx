import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tradeFormSchema, type TradeFormData } from '@/types/trades';
import { useDistinctTags } from '@/hooks/use-trades';
import { useImages } from '@/hooks/use-images';
import {
  getAssetSuggestions,
  resolveAssetSelection,
  type AssetOption,
} from '@/features/assets/catalog';
import {
  fetchCurrentPrices,
  fetchCurrentPriceForAsset,
  formatDisplayPrice,
  roundPrefillPrice,
} from '@/features/assets/quotes';
import { TagInput } from './TagInput';
import { ImagePickerButton } from './ImagePickerButton';
import { StrategyTagsSection } from './StrategyTagsSection';
import { fontSize, spacing, borderRadius, fontWeight, useTheme, useThemedStyles, type AppTheme } from '@/lib/theme';
import type { Strategy } from '@/types/strategies';

const ASSET_CLASSES = ['crypto', 'stocks', 'options', 'futures', 'forex'] as const;
const SYMBOL_PLACEHOLDERS: Record<(typeof ASSET_CLASSES)[number], string> = {
  crypto: 'BTC/USD, ETH/USD, etc.',
  stocks: 'AAPL, NVDA, etc.',
  options: 'SPY, QQQ, etc.',
  futures: 'ES, NQ, etc.',
  forex: 'EUR/USD, GBP/USD, etc.',
};

interface TradeFormProps {
  defaultValues?: Partial<TradeFormData>;
  onSubmit: (data: TradeFormData, imagePaths: string[], strategyIds: string[]) => Promise<void>;
  submitLabel?: string;
  resetOnSuccess?: boolean;
  mode?: 'create' | 'edit';
  initialStrategies?: Strategy[];
  strategiesLoading?: boolean;
  strategiesError?: boolean;
  onStrategiesRetry?: () => void;
}

export function TradeForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Save Trade',
  resetOnSuccess = false,
  mode = 'create',
  initialStrategies,
  strategiesLoading,
  strategiesError,
  onStrategiesRetry,
}: TradeFormProps) {
  const { theme, selection } = useTheme();
  const { colors } = theme;
  const isGlass = selection.style === 'ios_glass';
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const isEditMode = mode === 'edit';
  const enablePriceAutomation = mode === 'create';
  const [submitting, setSubmitting] = useState(false);
  const [selectedStrategies, setSelectedStrategies] = useState<Strategy[]>(
    initialStrategies ?? []
  );
  const strategiesWereTouched = useRef(false);
  const [isSymbolFocused, setIsSymbolFocused] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const [autoPriceSyncEnabled, setAutoPriceSyncEnabled] = useState(enablePriceAutomation);
  const [latestAssetPrice, setLatestAssetPrice] = useState<number | null>(null);
  const [suggestionPrices, setSuggestionPrices] = useState<Record<string, number | null>>({});
  const suppressNextSymbolBlurRef = useRef(false);
  const suggestionPriceRequestRef = useRef(0);
  const { data: tagData } = useDistinctTags();
  const { images, pickImages, removeImage, uploadImages, reset: resetImages } = useImages();

  // Sync initialStrategies when they load in edit mode (don't mark as touched)
  useEffect(() => {
    if (initialStrategies && initialStrategies.length > 0) {
      setSelectedStrategies(initialStrategies);
    }
  }, [initialStrategies]);

  const handleStrategiesChange = (strategies: Strategy[]) => {
    setSelectedStrategies(strategies);
    strategiesWereTouched.current = true;
  };

  const {
    control,
    handleSubmit,
    getValues,
    reset,
    setValue,
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
  const symbol = watch('symbol');
  const assetClass = watch('asset_class');

  const symbolSuggestions = useMemo(() => {
    if (!enablePriceAutomation) {
      return [];
    }

    return (
      getAssetSuggestions(symbol ?? '', {
        preferredAssetClass: assetClass,
        limit: 8,
      })
    );
  }, [assetClass, enablePriceAutomation, symbol]);

  const shouldShowSymbolSuggestions =
    enablePriceAutomation && isSymbolFocused && (symbol ?? '').trim().length > 0;
  const symbolPlaceholder =
    SYMBOL_PLACEHOLDERS[assetClass] ?? 'BTC/USD, ETH/USD, etc.';
  const isAutoPricePreview = autoPriceSyncEnabled && latestAssetPrice != null;

  const syncLivePriceToStatus = (price: number, tradeStatus: 'open' | 'closed') => {
    if (tradeStatus === 'closed') {
      // Auto-mode should map price to only the active status field.
      setValue('entry_price', undefined, { shouldDirty: true, shouldValidate: true });
      setValue('exit_price', price, { shouldDirty: true, shouldValidate: true });
      setPrefillMessage(`Live price prefilled in Exit Price: ${price}`);
      return;
    }

    // Auto-mode should map price to only the active status field.
    setValue('exit_price', undefined, { shouldDirty: true, shouldValidate: true });
    setValue('entry_price', price, { shouldDirty: true, shouldValidate: true });
    setPrefillMessage(`Live price prefilled in Entry Price: ${price}`);
  };

  const disableAutoPriceSync = () => {
    if (!enablePriceAutomation) return;
    if (!autoPriceSyncEnabled) return;
    setAutoPriceSyncEnabled(false);
    setPrefillLoading(false);
    setPrefillMessage(
      'Auto price sync disabled. Manual price mode is now active for this trade.'
    );
  };

  useEffect(() => {
    if (!enablePriceAutomation || !autoPriceSyncEnabled || latestAssetPrice == null) {
      return;
    }

    syncLivePriceToStatus(latestAssetPrice, status);
  }, [autoPriceSyncEnabled, enablePriceAutomation, latestAssetPrice, setValue, status]);

  useEffect(() => {
    if (!enablePriceAutomation || !shouldShowSymbolSuggestions || symbolSuggestions.length === 0) {
      setSuggestionPrices({});
      return;
    }

    const quoteSymbols = symbolSuggestions.map((asset) => asset.quoteSymbol);

    const requestId = suggestionPriceRequestRef.current + 1;
    suggestionPriceRequestRef.current = requestId;

    void (async () => {
      const fetchedPrices = await fetchCurrentPrices(quoteSymbols);
      if (suggestionPriceRequestRef.current !== requestId) {
        return;
      }

      setSuggestionPrices(fetchedPrices);
    })();
  }, [enablePriceAutomation, shouldShowSymbolSuggestions, symbolSuggestions]);

  const prefillPriceForSelectedAsset = async (asset: AssetOption) => {
    if (!enablePriceAutomation) {
      return;
    }

    if (!autoPriceSyncEnabled) {
      setPrefillMessage(
        'Auto price sync is disabled. Edit Entry/Exit Price manually.'
      );
      return;
    }

    setPrefillLoading(true);
    setPrefillMessage(null);

    try {
      const livePrice = await fetchCurrentPriceForAsset(asset);
      if (livePrice == null) {
        setPrefillMessage('Live price unavailable. Enter price manually.');
        return;
      }

      const roundedPrice = roundPrefillPrice(livePrice);
      setLatestAssetPrice(roundedPrice);
    } finally {
      setPrefillLoading(false);
    }
  };

  const handleAssetSelection = async (asset: AssetOption) => {
    setIsSymbolFocused(false);
    setValue('symbol', asset.symbol, { shouldDirty: true, shouldValidate: true });
    setValue('asset_class', asset.assetClass, { shouldDirty: true, shouldValidate: true });
    await prefillPriceForSelectedAsset(asset);
  };

  const handleSymbolBlur = (onBlur: () => void, value: string) => {
    onBlur();
    setIsSymbolFocused(false);

    if (suppressNextSymbolBlurRef.current) {
      suppressNextSymbolBlurRef.current = false;
      return;
    }

    const resolvedAsset = resolveAssetSelection(value, {
      preferredAssetClass: getValues('asset_class'),
    });

    if (resolvedAsset) {
      void handleAssetSelection(resolvedAsset);
    }
  };

  const handleFormSubmit = handleSubmit(async (data) => {
    // Block save in edit mode if strategies are loading/errored
    if (isEditMode && (strategiesLoading || strategiesError)) return;

    // No-strategy nudge
    if (selectedStrategies.length === 0) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'No Strategy Tagged',
          'Save without linking a strategy?',
          [
            { text: 'Add Strategy', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Save Anyway', style: 'default', onPress: () => resolve(true) },
          ]
        );
      });
      if (!proceed) return;
    }

    setSubmitting(true);
    try {
      const strategyIds = selectedStrategies.map((s) => s.id);
      // Upload images first (will be linked to trade after creation)
      const imagePaths = images.length > 0 ? await uploadImages('pending') : [];
      await onSubmit(data, imagePaths, strategyIds);

      if (resetOnSuccess) {
        reset();
        setSelectedStrategies([]);
        strategiesWereTouched.current = false;
        setIsSymbolFocused(false);
        setPrefillLoading(false);
        setPrefillMessage(null);
        setAutoPriceSyncEnabled(enablePriceAutomation);
        setLatestAssetPrice(null);
        setSuggestionPrices({});
        suppressNextSymbolBlurRef.current = false;
        suggestionPriceRequestRef.current += 1;
      }

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
      style={[styles.flex, isGlass && { backgroundColor: 'transparent' }]}
    >
      <ScrollView
        style={[styles.flex, isGlass && { backgroundColor: 'transparent' }]}
        contentContainerStyle={[styles.content, { paddingTop: spacing.lg + insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        {!isEditMode && (
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
        )}

        {/* Symbol */}
        <View style={styles.field}>
          <Text style={styles.label}>Symbol *</Text>
          {isEditMode ? (
            <View style={[styles.input, styles.inputReadOnly]} testID="trade-symbol-readonly">
              <Text style={styles.inputReadOnlyText}>{symbol ?? ''}</Text>
            </View>
          ) : (
            <>
              <Controller
                control={control}
                name="symbol"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    testID="trade-symbol-input"
                    style={[styles.input, errors.symbol && styles.inputError]}
                    value={value}
                    onChangeText={(text) => {
                      setIsSymbolFocused(true);
                      setPrefillMessage(null);
                      onChange(text);
                    }}
                    onFocus={() => setIsSymbolFocused(true)}
                    onBlur={() => handleSymbolBlur(onBlur, value ?? '')}
                    placeholder={symbolPlaceholder}
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="characters"
                  />
                )}
              />
              {errors.symbol && <Text style={styles.error}>{errors.symbol.message}</Text>}
              {shouldShowSymbolSuggestions && symbolSuggestions.length > 0 && (
                <View style={styles.suggestionList}>
                  {symbolSuggestions.map((asset) => (
                    <Pressable
                      key={`${asset.assetClass}:${asset.symbol}`}
                      style={styles.suggestionItem}
                      onPress={() => {
                        suppressNextSymbolBlurRef.current = true;
                        void handleAssetSelection(asset);
                      }}
                    >
                      <Text style={styles.suggestionSymbol}>{asset.symbol}</Text>
                      <Text style={styles.suggestionMeta}>
                        {asset.displayName} ({asset.assetClass}) -{' '}
                        {formatDisplayPrice(suggestionPrices[asset.quoteSymbol])}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
          {!isEditMode && prefillLoading && (
            <Text style={styles.helperText}>Fetching live price...</Text>
          )}
          {!isEditMode && prefillMessage && <Text style={styles.helperText}>{prefillMessage}</Text>}
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
                  style={[
                    styles.input,
                    isAutoPricePreview && styles.inputTemporary,
                    errors.entry_price && styles.inputError,
                  ]}
                  value={value?.toString() ?? ''}
                  onChangeText={onChange}
                  onFocus={disableAutoPriceSync}
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
                    style={[
                      styles.input,
                      isAutoPricePreview && styles.inputTemporary,
                      errors.exit_price && styles.inputError,
                    ]}
                    value={value?.toString() ?? ''}
                    onChangeText={onChange}
                    onFocus={disableAutoPriceSync}
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

        {/* Strategy Tags */}
        <StrategyTagsSection
          selectedStrategies={selectedStrategies}
          onStrategiesChange={handleStrategiesChange}
          strategiesLoading={strategiesLoading}
          strategiesError={strategiesError}
          onRetry={onStrategiesRetry}
        />

        {/* Other Tags (formerly Setup Tags) */}
        <View style={styles.field}>
          <Text style={styles.label}>Other Tags</Text>
          <Controller
            control={control}
            name="setup_tags"
            render={({ field: { onChange, value } }) => (
              <TagInput
                tags={value ?? []}
                onChange={onChange}
                suggestions={tagData?.setupTags}
                placeholder="e.g. earnings, news catalyst..."
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

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
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
  inputTemporary: {
    color: colors.textSecondary,
    borderColor: colors.borderLight,
  },
  inputReadOnly: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  inputReadOnlyText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
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
  helperText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  suggestionList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionSymbol: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  suggestionMeta: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  toggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
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
    paddingVertical: spacing.xs,
    borderRadius: 999,
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
