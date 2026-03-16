import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDownloadedDeck } from '@/lib/offline/repository';
import { StudySessionCard } from '@/components/study/StudySessionCard';
import { StudyModePicker } from '@/components/study/StudyModePicker';
import { createLocalStudySession, queueCompletedSession, type LocalStudySession } from '@/lib/study/session';
import type { OfflineDeck } from '@/lib/offline/types';
import type { StudyMode } from '@/types/api';
import { borderRadius, fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function StudySessionScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const [deck, setDeck] = useState<OfflineDeck | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<StudyMode>('flip');
  const [session, setSession] = useState<LocalStudySession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState<{ correct: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDeck = async () => {
      if (!deckId) return;
      const offlineDeck = await getDownloadedDeck(null, deckId);
      if (!cancelled) {
        setDeck(offlineDeck);
        setLoading(false);
      }
    };

    void loadDeck();

    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const sessionCards = useMemo(() => {
    if (!deck || !session) return [];
    const cardMap = new Map(deck.cards.map((card) => [card.id, card]));
    return session.cardIds
      .map((cardId) => cardMap.get(cardId))
      .filter((card): card is OfflineDeck['cards'][number] => !!card);
  }, [deck, session]);

  const currentCard = sessionCards[currentIndex] ?? null;

  const handleStart = () => {
    if (!deck) return;
    try {
      const nextSession = createLocalStudySession(deck, selectedMode);
      setSession(nextSession);
      setCurrentIndex(0);
      setCorrectCount(0);
      setShowAnswer(false);
      setCompleted(null);
    } catch (error) {
      Alert.alert('Unable to start', error instanceof Error ? error.message : 'Please try another mode');
    }
  };

  const handleAnswer = async (wasCorrect: boolean) => {
    if (!session) return;

    const nextCorrect = correctCount + (wasCorrect ? 1 : 0);
    const isLastCard = currentIndex >= sessionCards.length - 1;

    if (isLastCard) {
      await queueCompletedSession(session, { correct: nextCorrect });
      setCompleted({ correct: nextCorrect, total: session.totalCards });
      setSession(null);
      setCurrentIndex(0);
      setCorrectCount(0);
      setShowAnswer(false);
      return;
    }

    setCorrectCount(nextCorrect);
    setCurrentIndex((value) => value + 1);
    setShowAnswer(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!deck) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Offline download required</Text>
        <Text style={styles.subtitle}>Download this deck before starting a local study session.</Text>
        <Pressable style={styles.primaryButton} onPress={() => router.replace(`/decks/${deckId}`)}>
          <Text style={styles.primaryButtonText}>Open Deck</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Study Session</Text>
      <Text style={styles.subtitle}>{deck.title}</Text>

      {completed ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Queued for sync</Text>
          <Text style={styles.summaryText}>
            You got {completed.correct} of {completed.total} correct. This session is saved locally and will sync later.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleStart}>
            <Text style={styles.primaryButtonText}>Study Again</Text>
          </Pressable>
        </View>
      ) : session && currentCard ? (
        <View style={styles.sessionColumn}>
          <Text style={styles.progressText}>
            Card {currentIndex + 1} of {session.totalCards}
          </Text>
          <StudySessionCard card={currentCard} showAnswer={showAnswer} onReveal={() => setShowAnswer(true)} />
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={() => void handleAnswer(false)} disabled={!showAnswer}>
              <Text style={styles.secondaryButtonText}>Needs Work</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={() => void handleAnswer(true)} disabled={!showAnswer}>
              <Text style={styles.primaryButtonText}>Got It</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.sessionColumn}>
          <Text style={styles.sectionTitle}>Choose a study mode</Text>
          <StudyModePicker
            availableCardCount={deck.cards.length}
            selectedMode={selectedMode}
            onSelect={setSelectedMode}
          />
          <Text style={styles.helperText}>
            This first offline cut uses a simple local card-review loop across the supported study modes.
          </Text>
          <Pressable style={styles.primaryButton} onPress={handleStart}>
            <Text style={styles.primaryButtonText}>Start Offline Session</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      padding: spacing['3xl'],
      gap: spacing.xl,
      backgroundColor: colors.studyBackground,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
      backgroundColor: colors.studyBackground,
      gap: spacing.md,
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.studyText,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.studyText,
      opacity: 0.7,
    },
    sessionColumn: {
      gap: spacing.lg,
    },
    sectionTitle: {
      color: colors.studyText,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    helperText: {
      color: colors.studyText,
      opacity: 0.75,
    },
    progressText: {
      color: colors.studyText,
      opacity: 0.8,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    primaryButton: {
      flex: 1,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.studyBackground,
      fontWeight: '700',
    },
    secondaryButton: {
      flex: 1,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.studyText,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.studyText,
      fontWeight: '600',
    },
    summaryCard: {
      borderRadius: borderRadius.xl,
      backgroundColor: colors.surface,
      padding: spacing.xl,
      gap: spacing.md,
    },
    summaryTitle: {
      color: colors.studyBackground,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    summaryText: {
      color: colors.text,
      lineHeight: 22,
    },
  });
