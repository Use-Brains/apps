import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TradeForm } from '@/components/TradeForm';
import { useCreateTrade } from '@/hooks/use-trades';
import { supabase } from '@/lib/supabase';
import type { TradeFormData } from '@/types/trades';

export default function AddTradeScreen() {
  const router = useRouter();
  const createTrade = useCreateTrade();

  const handleSubmit = async (data: TradeFormData, imagePaths: string[]) => {
    const trade = await createTrade.mutateAsync({
      symbol: data.symbol,
      asset_class: data.asset_class,
      side: data.side,
      status: data.status,
      entry_price: data.entry_price,
      exit_price: data.exit_price ?? null,
      size: data.size,
      fees: data.fees,
      entry_date: data.entry_date,
      exit_date: data.exit_date ?? null,
      confidence: data.confidence ?? null,
      thesis: data.thesis ?? null,
      notes: data.notes ?? null,
      setup_tags: data.setup_tags,
      mistake_tags: data.mistake_tags,
    });

    // Link images to trade
    if (imagePaths.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const imageInserts = imagePaths.map((path, index) => ({
          trade_id: trade.id,
          user_id: user.id,
          storage_path: path,
          sort_order: index,
        }));
        await supabase.from('trade_images').insert(imageInserts);
      }
    }

    router.push('/(tabs)/journal');
  };

  return <TradeForm onSubmit={handleSubmit} submitLabel="Save Trade" />;
}
