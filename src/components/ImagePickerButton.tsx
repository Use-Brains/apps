import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, fontSize, spacing, borderRadius } from '@/lib/theme';
import type { PickedImage } from '@/hooks/use-images';

interface ImagePickerButtonProps {
  images: PickedImage[];
  onPick: () => void;
  onRemove: (index: number) => void;
  maxImages?: number;
}

export function ImagePickerButton({
  images,
  onPick,
  onRemove,
  maxImages = 5,
}: ImagePickerButtonProps) {
  return (
    <View>
      <View style={styles.grid}>
        {images.map((image, index) => (
          <View key={image.uri} style={styles.imageContainer}>
            <Image source={{ uri: image.uri }} style={styles.thumbnail} />
            {image.uploading && (
              <View style={styles.uploadingOverlay}>
                <Text style={styles.uploadingText}>...</Text>
              </View>
            )}
            {image.error && (
              <View style={styles.errorOverlay}>
                <Text style={styles.errorText}>!</Text>
              </View>
            )}
            <Pressable style={styles.removeButton} onPress={() => onRemove(index)}>
              <Text style={styles.removeText}>×</Text>
            </Pressable>
          </View>
        ))}
        {images.length < maxImages && (
          <Pressable style={styles.addButton} onPress={onPick}>
            <Text style={styles.addIcon}>+</Text>
            <Text style={styles.addText}>Photo</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const THUMB_SIZE = 80;

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
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(220,38,38,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.lg,
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },
  addButton: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIcon: {
    fontSize: fontSize.xl,
    color: colors.textTertiary,
    fontWeight: '300',
  },
  addText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },
});
