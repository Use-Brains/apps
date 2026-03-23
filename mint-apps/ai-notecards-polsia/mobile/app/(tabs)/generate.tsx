import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useNetwork } from '@/lib/network';
import { getOfflineFeatureMessage } from '@/lib/offline/ui';
import { fontSize, spacing, borderRadius, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { buildGrantedAiGenerationConsent, hasGrantedAiGenerationConsent } from '@/lib/ai-consent';

const MAX_INPUT_LENGTH = 50000;
const MAX_PHOTOS = 5;

type Photo = { uri: string; mimeType?: string };
type PreviewCard = { front: string; back: string };

export default function GenerateScreen() {
  const styles = useThemedStyles(createStyles);
  const { isOnline } = useNetwork();
  const { user, refreshUser } = useAuth();

  const [input, setInput] = useState('');
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewCards, setPreviewCards] = useState<PreviewCard[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canGenerate = (input.trim().length > 0 || photos.length > 0) && !loading;

  const ensureAiConsent = async () => {
    if (hasGrantedAiGenerationConsent(user?.preferences)) return true;

    const approved = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'AI Notecard Generation',
        'When you use AI generation, content you choose to submit, such as text, photos, audio, or video, may be sent to third-party AI providers so AI Notecards can create notecards for you.\n\nOnly submit content you have the right to use. Do not submit sensitive personal information unless you are comfortable sharing it for this purpose.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Agree and Continue',
            onPress: () => resolve(true),
          },
        ]
      );
    });

    if (!approved) return false;

    await api.updatePreferences(buildGrantedAiGenerationConsent());
    await refreshUser();
    return true;
  };

  const pickFromLibrary = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} photos allowed.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      const picked = result.assets.map((a) => ({ uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' }));
      setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Maximum ${MAX_PHOTOS} photos allowed.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhotos((prev) => [...prev, { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' }]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const hasConsent = await ensureAiConsent();
      if (!hasConsent || controller.signal.aborted) return;
      let data;
      if (photos.length > 0) {
        data = await api.generatePreviewWithPhotos(input.trim(), title.trim() || undefined, photos);
      } else {
        data = await api.generatePreview(input.trim(), title.trim() || undefined);
      }
      if (controller.signal.aborted) return;
      setPreviewCards(data.cards);
    } catch (err) {
      if (controller.signal.aborted) return;
      Alert.alert('Generation Failed', err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!previewCards || previewCards.length === 0 || saving) return;
    setSaving(true);
    try {
      const deckTitle =
        title.trim() ||
        (photos.length > 0 ? 'Photo flashcards' : input ? input.slice(0, 60).trim() + (input.length > 60 ? '...' : '') : 'My Flashcards');
      const data = await api.saveDeck(deckTitle, input || null, previewCards);
      const deckId = String(data.deck.id);
      setPreviewCards(null);
      setInput('');
      setTitle('');
      setPhotos([]);
      router.navigate(`/decks/${deckId}`);
    } catch (err) {
      Alert.alert('Save Failed', err instanceof ApiError ? err.message : 'Could not save deck.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditCard = (index: number, field: 'front' | 'back', value: string) => {
    setPreviewCards((prev) => prev?.map((card, i) => (i === index ? { ...card, [field]: value } : card)) ?? null);
  };

  const handleDeleteCard = (index: number) => {
    setPreviewCards((prev) => prev?.filter((_, i) => i !== index) ?? null);
  };

  if (!isOnline) {
    return (
      <View style={styles.offlineContainer}>
        <Text style={styles.offlineText}>{getOfflineFeatureMessage('generate')}</Text>
      </View>
    );
  }

  // ── Preview mode ──────────────────────────────────────────────────────────
  if (previewCards !== null) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => setPreviewCards(null)} style={styles.backButton} hitSlop={8}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.previewHeaderRight}>
            <TouchableOpacity
              onPress={handleGenerate}
              disabled={loading}
              style={[styles.regenButton, loading && styles.buttonDisabled]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={styles.regenButtonText.color} />
              ) : (
                <Text style={styles.regenButtonText}>Regenerate</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={previewCards.length === 0 || saving}
              style={[styles.saveButton, (previewCards.length === 0 || saving) && styles.buttonDisabled]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Deck</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.previewList}>
          <Text style={styles.previewTitle}>Preview Cards</Text>
          <Text style={styles.previewSubtitle}>
            {previewCards.length} card{previewCards.length !== 1 ? 's' : ''} — edit or remove before saving
          </Text>

          {previewCards.length === 0 && (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyPreviewText}>All cards removed.</Text>
              <TouchableOpacity onPress={handleGenerate} disabled={loading} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          )}

          {previewCards.map((card, i) => (
            <View key={i} style={styles.cardItem}>
              <View style={styles.cardFields}>
                <Text style={styles.cardFieldLabel}>FRONT</Text>
                <TextInput
                  style={styles.cardFieldInput}
                  value={card.front}
                  onChangeText={(v) => handleEditCard(i, 'front', v)}
                  multiline
                  placeholder="Front side"
                  placeholderTextColor={styles.placeholder.color}
                />
                <Text style={[styles.cardFieldLabel, styles.cardFieldLabelBack]}>BACK</Text>
                <TextInput
                  style={styles.cardFieldInput}
                  value={card.back}
                  onChangeText={(v) => handleEditCard(i, 'back', v)}
                  multiline
                  placeholder="Back side"
                  placeholderTextColor={styles.placeholder.color}
                />
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteCard(i)}
                style={styles.deleteButton}
                hitSlop={8}
                accessibilityLabel={`Delete card ${i + 1}`}
              >
                <Text style={styles.deleteButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ── Input mode ────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>Generate Flashcards</Text>
        <Text style={styles.pageSubtitle}>
          Paste your notes, type a topic, or snap photos of your notes — AI will create study cards.
        </Text>

        {/* Title */}
        <Text style={styles.label}>
          Deck title <Text style={styles.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          placeholder="e.g., Biology Chapter 5"
          placeholderTextColor={styles.placeholder.color}
          returnKeyType="next"
        />

        {/* Notes */}
        <Text style={[styles.label, styles.labelSpaced]}>
          Notes or topic <Text style={styles.optional}>(optional if using photos)</Text>
        </Text>
        <TextInput
          style={styles.textarea}
          value={input}
          onChangeText={(t) => setInput(t.slice(0, MAX_INPUT_LENGTH))}
          multiline
          placeholder="Paste your lecture notes here, or type a topic like 'Photosynthesis' or 'World War II causes'..."
          placeholderTextColor={styles.placeholder.color}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>
          {input.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()}
        </Text>

        {/* Photos */}
        <Text style={[styles.label, styles.labelSpaced]}>
          Photos <Text style={styles.optional}>(optional — snap notes, textbooks, or whiteboards)</Text>
        </Text>
        <View style={styles.photoActions}>
          <TouchableOpacity
            onPress={pickFromLibrary}
            disabled={photos.length >= MAX_PHOTOS}
            style={[styles.photoActionButton, photos.length >= MAX_PHOTOS && styles.buttonDisabled]}
          >
            <Text style={styles.photoActionIcon}>🖼️</Text>
            <Text style={styles.photoActionText}>Library</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={takePhoto}
            disabled={photos.length >= MAX_PHOTOS}
            style={[styles.photoActionButton, photos.length >= MAX_PHOTOS && styles.buttonDisabled]}
          >
            <Text style={styles.photoActionIcon}>📷</Text>
            <Text style={styles.photoActionText}>Camera</Text>
          </TouchableOpacity>
        </View>

        {photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
            {photos.map((photo, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                <TouchableOpacity
                  onPress={() => removePhoto(i)}
                  style={styles.photoRemove}
                  accessibilityLabel={`Remove photo ${i + 1}`}
                >
                  <Text style={styles.photoRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Text style={styles.photoCount}>{photos.length}/{MAX_PHOTOS}</Text>
          </ScrollView>
        )}

        {/* Generate button */}
        <TouchableOpacity
          onPress={handleGenerate}
          disabled={!canGenerate}
          style={[styles.generateButton, !canGenerate && styles.buttonDisabled]}
          activeOpacity={0.8}
        >
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={styles.spinner} />
              <Text style={styles.generateButtonText}>
                {photos.length > 0 ? 'Reading your photos...' : 'Generating cards...'}
              </Text>
            </>
          ) : (
            <Text style={styles.generateButtonText}>Generate Flashcards</Text>
          )}
        </TouchableOpacity>

        {loading && (
          <View style={styles.loadingCard}>
            <Text style={styles.loadingCardTitle}>
              {photos.length > 0 ? 'AI is reading your photos...' : 'AI is reading your content...'}
            </Text>
            <Text style={styles.loadingCardSubtitle}>
              {photos.length > 0 ? 'This usually takes 10–20 seconds' : 'This usually takes 5–10 seconds'}
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing['2xl'], paddingBottom: spacing['4xl'] },
    offlineContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
      backgroundColor: colors.background,
    },
    offlineText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
    pageTitle: { fontSize: fontSize['2xl'], fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    pageSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing['2xl'] },
    label: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text, marginBottom: spacing.xs },
    labelSpaced: { marginTop: spacing.lg },
    optional: { color: colors.textSecondary, fontWeight: '400' },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.text,
    },
    textarea: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.text,
      minHeight: 160,
    },
    charCount: { fontSize: fontSize.xs, color: colors.textTertiary, textAlign: 'right', marginTop: spacing.xs },
    photoActions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    photoActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    photoActionIcon: { fontSize: fontSize.lg },
    photoActionText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    photoScroll: { marginBottom: spacing.md },
    photoThumb: { position: 'relative', marginRight: spacing.sm },
    photoImage: { width: 80, height: 80, borderRadius: borderRadius.md, backgroundColor: colors.border },
    photoRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.text,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoRemoveText: { color: colors.background, fontSize: 10, fontWeight: '700' },
    photoCount: {
      alignSelf: 'center',
      fontSize: fontSize.xs,
      color: colors.textTertiary,
      marginLeft: spacing.xs,
    },
    generateButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      marginTop: spacing['2xl'],
    },
    generateButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
    spinner: { marginRight: spacing.sm },
    buttonDisabled: { opacity: 0.5 },
    loadingCard: {
      marginTop: spacing['2xl'],
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing['2xl'],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadingCardTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary, marginBottom: spacing.xs },
    loadingCardSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary },
    // Preview mode
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    backButton: { padding: spacing.xs },
    backButtonText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '500' },
    previewHeaderRight: { flexDirection: 'row', gap: spacing.sm },
    regenButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    regenButtonText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
    saveButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.primary,
    },
    saveButtonText: { fontSize: fontSize.sm, fontWeight: '600', color: '#fff' },
    previewList: { padding: spacing['2xl'], paddingBottom: spacing['4xl'] },
    previewTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    previewSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing['2xl'] },
    emptyPreview: { alignItems: 'center', paddingVertical: spacing['4xl'], gap: spacing.lg },
    emptyPreviewText: { fontSize: fontSize.md, color: colors.textSecondary },
    cardItem: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
      padding: spacing.lg,
    },
    cardFields: { flex: 1 },
    cardFieldLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.8, marginBottom: spacing.xs },
    cardFieldLabelBack: { marginTop: spacing.md },
    cardFieldInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.sm,
      color: colors.text,
      minHeight: 48,
    },
    deleteButton: { marginLeft: spacing.md, alignSelf: 'flex-start', padding: spacing.xs },
    deleteButtonText: { fontSize: fontSize.md, color: colors.textTertiary },
    placeholder: { color: colors.textTertiary },
  });
