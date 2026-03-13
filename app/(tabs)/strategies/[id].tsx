import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStrategy, useUpdateStrategy } from '@/hooks/use-strategies';
import { StrategyStatsPanel } from '@/components/StrategyStatsPanel';
import { StrategyFormFields } from '@/components/StrategyFormFields';
import { ThemedBackground } from '@/components/ThemedBackground';
import { createStrategyFormStyles } from '@/components/strategy-form-styles';
import { strategyFormSchema, type StrategyFormData } from '@/types/strategies';
import {
  fontSize,
  spacing,
  borderRadius,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from '@/lib/theme';
import { supabase } from '@/lib/supabase';

export default function StrategyDetailScreen() {
  const formStyles = useThemedStyles(createStrategyFormStyles);
  const localStyles = useThemedStyles(createLocalStyles);
  const { theme } = useTheme();
  const { colors } = theme;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: strategy, isLoading } = useStrategy(id ?? '');
  const updateStrategy = useUpdateStrategy();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [titleCheckPending, setTitleCheckPending] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleCheckTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const form = useForm<StrategyFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(strategyFormSchema) as any,
    defaultValues: {
      title: '',
      status: 'active',
      market_conditions: [],
      asset_classes: [],
      timeframes: [],
    },
  });

  useEffect(() => {
    if (!strategy) return;
    form.reset({
      title: strategy.title,
      emoji: strategy.emoji ?? undefined,
      color: strategy.color ?? undefined,
      status: strategy.status as 'active' | 'testing' | 'archived',
      active_from: strategy.active_from ?? undefined,
      active_to: strategy.active_to ?? undefined,
      description: strategy.description ?? undefined,
      entry_criteria: strategy.entry_criteria ?? undefined,
      exit_criteria: strategy.exit_criteria ?? undefined,
      expected_win_rate: strategy.expected_win_rate ?? undefined,
      risk_reward_ratio: strategy.risk_reward_ratio ?? undefined,
      market_conditions: (strategy.market_conditions ?? []) as any,
      asset_classes: (strategy.asset_classes ?? []) as any,
      timeframes: (strategy.timeframes ?? []) as any,
      notes: strategy.notes ?? undefined,
    });
  }, [strategy]);

  const checkTitleUniqueness = async (title: string) => {
    if (!title.trim() || !id) return;
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
        .neq('id', id)
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
    if (!id || titleCheckPending || titleError) return;
    setIsSubmitting(true);
    try {
      await updateStrategy.mutateAsync({
        id,
        title: data.title,
        emoji: data.emoji || null,
        color: data.color || null,
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
      Alert.alert('Saved', 'Strategy updated successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  });

  if (!isLoading && !strategy) {
    return (
      <ThemedBackground>
        <View style={localStyles.notFound}>
          <Text style={localStyles.notFoundText}>Strategy not found</Text>
          <Pressable style={localStyles.backButton} onPress={() => router.back()}>
            <Text style={localStyles.backButtonText}>Go back</Text>
          </Pressable>
        </View>
      </ThemedBackground>
    );
  }

  if (isLoading) {
    return (
      <ThemedBackground>
        <View style={localStyles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedBackground>
    );
  }

  return (
    <ThemedBackground>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={formStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <StrategyStatsPanel strategyId={id ?? ''} />

          <StrategyFormFields
            control={form.control}
            titleError={titleError}
            onTitleBlur={handleTitleBlur}
            statusOptions={['active', 'testing', 'archived']}
          />

          {strategy?.created_at && (
            <View style={formStyles.field}>
              <Text style={formStyles.label}>Created</Text>
              <Text style={localStyles.readOnlyText}>
                {new Date(strategy.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={formStyles.footer}>
          <Pressable
            style={[
              formStyles.saveButton,
              (isSubmitting || !form.formState.isDirty || titleCheckPending || !!titleError)
                && formStyles.saveButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || !form.formState.isDirty || titleCheckPending || !!titleError}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={formStyles.saveButtonText}>Save Changes</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedBackground>
  );
}

const createLocalStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notFound: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
    },
    notFoundText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      marginBottom: spacing.lg,
    },
    backButton: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
    },
    backButtonText: {
      color: colors.textInverse,
      fontWeight: '600',
    },
    readOnlyText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
    },
  });
