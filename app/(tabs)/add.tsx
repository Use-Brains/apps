import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TradeForm } from '@/components/TradeForm';
import { useCreateTrade } from '@/hooks/use-trades';
import { supabase } from '@/lib/supabase';
import type { TradeFormData } from '@/types/trades';
import { buildTradeImageInserts, mapTradeFormToInsert } from '@/utils/trade-payloads';

export default function AddTradeScreen() {
  const router = useRouter();
  const createTrade = useCreateTrade();

  const handleSubmit = async (data: TradeFormData, imagePaths: string[]) => {
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

    router.push('/(tabs)/journal');
  };

  return <TradeForm onSubmit={handleSubmit} submitLabel="Save Trade" resetOnSuccess />;
}
