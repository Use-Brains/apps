import { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCreateStrategy } from '@/hooks/use-strategies';
import { useImages } from '@/hooks/use-images';
import { ImagePickerButton } from '@/components/ImagePickerButton';
import { StrategyFormFields } from '@/components/StrategyFormFields';
import { ThemedBackground } from '@/components/ThemedBackground';
import { createStrategyFormStyles } from '@/components/strategy-form-styles';
import { strategyFormSchema, type StrategyFormData } from '@/types/strategies';
import { useTheme, useThemedStyles } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

const STRATEGY_MAX_IMAGES = 8;

export default function NewStrategyScreen() {
  const styles = useThemedStyles(createStrategyFormStyles);
  const { theme: { colors } } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ modal?: string; title?: string }>();
  const isModal = params.modal === 'true';

  const createStrategy = useCreateStrategy();
  const imageHook = useImages('strategy-images', STRATEGY_MAX_IMAGES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleCheckPending, setTitleCheckPending] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleCheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const form = useForm<StrategyFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(strategyFormSchema) as any,
    defaultValues: {
      title: params.title ?? '',
      status: 'active',
      market_conditions: [],
      asset_classes: [],
      timeframes: [],
    },
  });

  const checkTitleUniqueness = async (title: string) => {
    if (!title.trim()) return;
    setTitleCheckPending(true);
    setTitleError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('strategies')
        .select('id')
        .eq('user_id', user.id)
        .ilike('title', title.trim())
        .limit(1);
      if (data && data.length > 0) {
        setTitleError('A strategy with this name already exists');
      }
    } finally {
      setTitleCheckPending(false);
    }
  };

  const handleTitleBlur = (title: string) => {
    if (titleCheckTimer.current) clearTimeout(titleCheckTimer.current);
    titleCheckTimer.current = setTimeout(() => checkTitleUniqueness(title), 300);
  };

  const handleSubmit = form.handleSubmit(async (data) => {
    if (titleCheckPending || titleError) return;
    setIsSubmitting(true);
    try {
      const storagePaths = await imageHook.uploadImages('pending');
      const strategy = await createStrategy.mutateAsync({
        title: data.title,
        emoji: data.emoji || undefined,
        color: data.color || undefined,
        status: data.status,
        active_from: data.active_from || null,
        active_to: data.active_to || null,
        description: data.description || null,
        entry_criteria: data.entry_criteria || null,
        exit_criteria: data.exit_criteria || null,
        expected_win_rate: data.expected_win_rate ?? null,
        risk_reward_ratio: data.risk_reward_ratio ?? null,
        market_conditions: data.market_conditions,
        asset_classes: data.asset_classes,
        timeframes: data.timeframes,
        notes: data.notes || null,
      });

      if (storagePaths.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('strategy_images').insert(
            storagePaths.map((path, i) => ({
              strategy_id: strategy.id,
              user_id: user.id,
              storage_path: path,
              sort_order: i,
            }))
          );
        }
      }

      if (isModal) {
        router.back();
      } else {
        router.replace(`/(tabs)/strategies/${strategy.id}`);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to create strategy';
      Alert.alert('Error', message);
    } finally {
      setIsSubmitting(false);
    }
  });

  const handleBack = () => {
    const hasChanges = form.formState.isDirty || imageHook.images.length > 0;
    if (hasChanges) {
      Alert.alert('Discard changes?', 'All unsaved data will be lost.', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  return (
    <ThemedBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <StrategyFormFields
            control={form.control}
            titleError={titleError}
            onTitleBlur={handleTitleBlur}
            showPlaceholders
            titleTestID="strategy-title-input"
          />

          {/* Images */}
          <View style={styles.field}>
            <Text style={styles.label}>Photos (max {STRATEGY_MAX_IMAGES})</Text>
            <ImagePickerButton
              images={imageHook.images}
              onPick={imageHook.pickImages}
              onRemove={imageHook.removeImage}
            />
          </View>
        </ScrollView>

        {/* Sticky Footer: Cancel + Save */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Pressable
              style={styles.cancelButton}
              onPress={handleBack}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.saveButton,
                styles.saveButtonFlex,
                (isSubmitting || titleCheckPending || !!titleError) && styles.saveButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || titleCheckPending || !!titleError}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}
