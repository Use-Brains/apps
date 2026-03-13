import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';

const MAX_IMAGES = 5;
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

export interface PickedImage {
  uri: string;
  uploading?: boolean;
  storagePath?: string;
  error?: string;
}

export function useImages(bucketName: string = 'trade-images', maxImages: number = MAX_IMAGES) {
  const [images, setImages] = useState<PickedImage[]>([]);

  const pickImages = useCallback(async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limit reached', `Maximum ${maxImages} images.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: maxImages - images.length,
      quality: 1,
    });

    if (!result.canceled) {
      const newImages: PickedImage[] = result.assets.map((asset) => ({
        uri: asset.uri,
      }));
      setImages((prev) => [...prev, ...newImages].slice(0, maxImages));
    }
  }, [images.length]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadImages = useCallback(
    async (tradeId: string): Promise<string[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const storagePaths: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (image.storagePath) {
          storagePaths.push(image.storagePath);
          continue;
        }

        try {
          setImages((prev) =>
            prev.map((img, idx) => (idx === i ? { ...img, uploading: true } : img))
          );

          // Compress
          const compressed = await manipulateAsync(
            image.uri,
            [{ resize: { width: MAX_WIDTH } }],
            { compress: JPEG_QUALITY, format: SaveFormat.JPEG }
          );

          // Read as base64
          const file = new File(compressed.uri);
          const base64 = await file.base64();

          // Upload
          const path = `${user.id}/${tradeId}/${Date.now()}_${i}.jpg`;
          const { error } = await supabase.storage
            .from(bucketName)
            .upload(path, decode(base64), {
              contentType: 'image/jpeg',
            });

          if (error) throw error;

          storagePaths.push(path);
          setImages((prev) =>
            prev.map((img, idx) =>
              idx === i ? { ...img, uploading: false, storagePath: path } : img
            )
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed';
          setImages((prev) =>
            prev.map((img, idx) =>
              idx === i ? { ...img, uploading: false, error: message } : img
            )
          );
        }
      }

      return storagePaths;
    },
    [images]
  );

  const reset = useCallback(() => {
    setImages([]);
  }, []);

  return {
    images,
    pickImages,
    removeImage,
    uploadImages,
    reset,
    setImages,
  };
}

export function getImageUrl(storagePath: string, bucketName: string = 'trade-images'): string {
  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
  return data.publicUrl;
}

export function getSignedImageUrl(storagePath: string, bucketName: string = 'trade-images'): Promise<string> {
  return supabase.storage
    .from(bucketName)
    .createSignedUrl(storagePath, 3600) // 1 hour
    .then(({ data, error }) => {
      if (error) throw error;
      return data.signedUrl;
    });
}
