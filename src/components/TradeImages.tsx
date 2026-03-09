import { View, Pressable, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { colors, spacing, borderRadius } from '@/lib/theme';
import { getSignedImageUrl } from '@/hooks/use-images';
import type { TradeImage } from '@/types/trades';

interface TradeImagesProps {
  images: Pick<TradeImage, 'id' | 'storage_path' | 'sort_order'>[];
}

export function TradeImages({ images }: TradeImagesProps) {
  if (images.length === 0) return null;

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  const handlePress = async (storagePath: string) => {
    try {
      const url = await getSignedImageUrl(storagePath);
      await Linking.openURL(url);
    } catch {
      // Silently fail — user can try again
    }
  };

  return (
    <View style={styles.grid}>
      {sorted.map((image) => (
        <Pressable
          key={image.id}
          style={styles.imageContainer}
          onPress={() => handlePress(image.storage_path)}
        >
          <SignedImage storagePath={image.storage_path} />
        </Pressable>
      ))}
    </View>
  );
}

function SignedImage({ storagePath }: { storagePath: string }) {
  // Use signed URL for private bucket images
  return (
    <Image
      source={{ uri: `placeholder:${storagePath}` }}
      style={styles.thumbnail}
      contentFit="cover"
      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
    />
  );
}

const THUMB_SIZE = 100;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageContainer: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
});
