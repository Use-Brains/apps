import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TradeForm } from '@/components/TradeForm';
import { ThemedBackground } from '@/components/ThemedBackground';
import { useCreateTrade } from '@/hooks/use-trades';
import { useSetStrategyOnTrade } from '@/hooks/use-strategies';
import { supabase } from '@/lib/supabase';
import type { TradeFormData } from '@/types/trades';
import { buildTradeImageInserts, mapTradeFormToInsert } from '@/utils/trade-payloads';

export default function AddTradeScreen() {
  const router = useRouter();
  const createTrade = useCreateTrade();
  const setStrategyOnTrade = useSetStrategyOnTrade();

  const handleSubmit = async (data: TradeFormData, imagePaths: string[], strategyIds: string[]) => {
    const trade = await createTrade.mutateAsync(mapTradeFormToInsert(data));

    // Link images to trade
    if (imagePaths.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const imageInserts = buildTradeImageInserts({
          tradeId: trade.id,
          userId: user.id,
          imagePaths,
        });
        await supabase.from('trade_images').insert(imageInserts);
      }
    }

    // Link strategies to trade
    if (strategyIds.length > 0) {
      try {
        await setStrategyOnTrade.mutateAsync({ tradeId: trade.id, strategyIds });
      } catch {
        // Trade saved but strategy linking failed — show retry
        Alert.alert(
          'Strategy Link Failed',
          'Trade saved, but strategy tags failed to link.',
          [
            {
              text: 'Retry',
              onPress: () =>
                setStrategyOnTrade.mutateAsync({ tradeId: trade.id, strategyIds }),
            },
          ]
        );
        return; // Don't navigate until resolved
      }
    }

    router.push('/(tabs)/journal');
  };

  return (
    <ThemedBackground>
      <TradeForm onSubmit={handleSubmit} submitLabel="Save Trade" resetOnSuccess />
    </ThemedBackground>
  );
}
