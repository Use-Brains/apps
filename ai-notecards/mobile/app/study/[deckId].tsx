import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getDownloadedDeck } from '@/lib/offline/repository';
import { StudySessionCard } from '@/components/study/StudySessionCard';
import { StudyModePicker } from '@/components/study/StudyModePicker';
import { createLocalStudySession, queueCompletedSession, type LocalStudySession } from '@/lib/study/session';
import { shareStudyResult } from '@/lib/share';
import { haptics } from '@/lib/haptics';
import type { OfflineDeck } from '@/lib/offline/types';
import type { StudyMode } from '@/types/api';
import { borderRadius, fontSize, spacing, useTheme, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function StudySessionScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { theme: { colors } } = useTheme();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

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
    return () => { cancelled = true; };
  }, [deckId]);

  const sessionCards = useMemo(() => {
    if (!deck || !session) return [];
    const cardMap = new Map(deck.cards.map((card) => [card.id, card]));
    return session.cardIds
      .map((cardId) => cardMap.get(cardId))
      .filter((card): card is OfflineDeck['cards'][number] => !!card);
  }, [deck, session]);

  const currentCard = sessionCards[currentIndex] ?? null;
  const progress = session ? (currentIndex / session.totalCards) : 0;

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
    await haptics.answer(wasCorrect);
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
    setCurrentIndex((v) => v + 1);
    setShowAnswer(false);
  };

  const handleShareResult = async () => {
    if (!deck || !completed) return;
    try {
      await shareStudyResult({ deckTitle: deck.title, correct: completed.correct, total: completed.total });
    } catch (error) {
      Alert.alert('Unable to share', error instanceof Error ? error.message : 'Please try again');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <LinearGradient colors={[colors.studyBackground, '#0d3d30']} style={styles.fill}>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator color={colors.studyText} />
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── No offline deck ───────────────────────────────────────────────────────
  if (!deck) {
    return (
      <LinearGradient colors={[colors.studyBackground, '#0d3d30']} style={styles.fill}>
        <SafeAreaView style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.studyText} style={{ opacity: 0.5, marginBottom: spacing.lg }} />
          <Text style={styles.headingText}>Download required</Text>
          <Text style={styles.mutedText}>Download this deck before studying offline.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.replace(`/decks/${deckId}`)}>
            <Text style={styles.primaryButtonText}>Open Deck</Text>
          </Pressable>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Completed ─────────────────────────────────────────────────────────────
  if (completed) {
    const pct = Math.round((completed.correct / completed.total) * 100);
    const emoji = pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '📚';
    const message = pct >= 80 ? 'Great work!' : pct >= 60 ? 'Good effort!' : 'Keep practicing!';

    return (
      <LinearGradient colors={[colors.studyBackground, '#0d3d30']} style={styles.fill}>
        <SafeAreaView style={styles.fill}>
          <Pressable style={styles.backButton} onPress={() => router.dismissTo('/(tabs)/home')}>
            <Ionicons name="chevron-back" size={20} color={colors.studyText} />
          </Pressable>
          <View style={styles.centered}>
            <Text style={styles.completedEmoji}>{emoji}</Text>
            <Text style={styles.completedScore}>{pct}%</Text>
            <Text style={styles.completedMessage}>{message}</Text>
            <Text style={styles.completedDetail}>
              {completed.correct} of {completed.total} correct
            </Text>
            <View style={styles.completedActions}>
              <Pressable style={styles.primaryButton} onPress={handleStart}>
                <Text style={styles.primaryButtonText}>Study Again</Text>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => void handleShareResult()}>
                <Text style={styles.ghostButtonText}>Share Result</Text>
              </Pressable>
              <Pressable onPress={() => router.dismissTo('/(tabs)/home')}>
                <Text style={styles.linkText}>Go Home</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────
  if (session && currentCard) {
    return (
      <LinearGradient colors={[colors.studyBackground, '#0d3d30']} style={styles.fill}>
        <SafeAreaView style={styles.fill}>
          <View style={styles.sessionTopBar}>
            <Pressable onPress={() => { setSession(null); setShowAnswer(false); }} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.studyText} />
            </Pressable>
            <Text style={styles.progressLabel}>
              {currentIndex + 1} / {session.totalCards}
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as `${number}%` }]} />
          </View>

          <View style={[styles.sessionBody, isLandscape && styles.sessionBodyLandscape]}>
            {/* Card centred in the available space */}
            <View style={isLandscape ? styles.cardSide : styles.cardFull}>
              <StudySessionCard
                card={currentCard}
                showAnswer={showAnswer}
                onReveal={() => setShowAnswer(true)}
              />
            </View>

            {/* Answer buttons pinned to bottom; placeholder keeps card centred when hidden */}
            <View style={[styles.answerButtons, isLandscape && styles.answerButtonsLandscape]}>
              {showAnswer ? (
                <>
                  <Pressable style={styles.needsWorkButton} onPress={() => void handleAnswer(false)}>
                    <Ionicons name="close" size={20} color="#e57373" />
                    <Text style={styles.needsWorkText}>Needs Work</Text>
                  </Pressable>
                  <Pressable style={styles.gotItButton} onPress={() => void handleAnswer(true)}>
                    <Ionicons name="checkmark" size={20} color={colors.studyBackground} />
                    <Text style={styles.gotItText}>Got It</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.answerButtonsPlaceholder} />
              )}
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Mode selection ────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={[colors.studyBackground, '#0d3d30']} style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={colors.studyText} />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.modeContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.deckHeader}>
            <View style={styles.deckIconWrap}>
              <Ionicons name="book-outline" size={28} color={colors.studyText} />
            </View>
            <Text style={styles.deckTitle}>{deck.title}</Text>
            <View style={styles.cardCountPill}>
              <Text style={styles.cardCountText}>{deck.cards.length} cards</Text>
            </View>
          </View>

          <View style={styles.modeSection}>
            <Text style={styles.modeSectionLabel}>Choose a study mode</Text>
            <StudyModePicker
              availableCardCount={deck.cards.length}
              selectedMode={selectedMode}
              onSelect={setSelectedMode}
            />
          </View>

          <Pressable style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Start Session</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.studyBackground} />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
      gap: spacing.lg,
    },
    backButton: {
      marginTop: spacing.md,
      marginLeft: spacing.lg,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headingText: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.studyText,
      textAlign: 'center',
    },
    mutedText: {
      fontSize: fontSize.md,
      color: colors.studyText,
      opacity: 0.6,
      textAlign: 'center',
    },
    // Mode selection
    modeContainer: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing['2xl'],
      paddingBottom: spacing['4xl'],
      gap: spacing['2xl'],
    },
    deckHeader: {
      alignItems: 'center',
      gap: spacing.md,
    },
    deckIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deckTitle: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.studyText,
      textAlign: 'center',
    },
    cardCountPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.12)',
    },
    cardCountText: {
      fontSize: fontSize.sm,
      color: colors.studyText,
      opacity: 0.75,
      fontWeight: '500',
    },
    modeSection: { gap: spacing.lg },
    modeSectionLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.studyText,
      opacity: 0.6,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    startButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.studyText,
      borderRadius: borderRadius.xl,
      paddingVertical: spacing.lg,
    },
    startButtonText: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.studyBackground,
    },
    // Active session
    sessionTopBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    progressLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.studyText,
      opacity: 0.7,
      textAlign: 'right',
    },
    progressTrack: {
      height: 3,
      backgroundColor: 'rgba(255,255,255,0.15)',
      marginHorizontal: spacing.lg,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.studyText,
      borderRadius: 2,
    },
    sessionBody: {
      flex: 1,
      justifyContent: 'space-between',
      padding: spacing['2xl'],
      gap: spacing.lg,
    },
    sessionBodyLandscape: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    cardFull: { flex: 1, justifyContent: 'center' },
    cardSide: { flex: 3 },
    answerButtons: {
      flexDirection: 'row',
      gap: spacing.md,
      minHeight: 56,
    },
    answerButtonsPlaceholder: {
      flex: 1,
      minHeight: 56,
    },
    answerButtonsLandscape: {
      flex: 2,
      flexDirection: 'column',
    },
    needsWorkButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.xl,
      borderWidth: 1.5,
      borderColor: 'rgba(229,115,115,0.4)',
      backgroundColor: 'rgba(229,115,115,0.1)',
    },
    needsWorkText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: '#e57373',
    },
    gotItButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.studyText,
    },
    gotItText: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.studyBackground,
    },
    // Completion
    completedEmoji: { fontSize: 52 },
    completedScore: {
      fontSize: 72,
      fontWeight: '800',
      color: colors.studyText,
      letterSpacing: -2,
    },
    completedMessage: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.studyText,
    },
    completedDetail: {
      fontSize: fontSize.md,
      color: colors.studyText,
      opacity: 0.6,
    },
    completedActions: {
      width: '100%',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    // Shared buttons
    primaryButton: {
      width: '100%',
      borderRadius: borderRadius.xl,
      backgroundColor: colors.studyText,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    primaryButtonText: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: colors.studyBackground,
    },
    ghostButton: {
      width: '100%',
      borderRadius: borderRadius.xl,
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.25)',
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    ghostButtonText: {
      fontSize: fontSize.md,
      fontWeight: '600',
      color: colors.studyText,
      opacity: 0.8,
    },
    linkText: {
      fontSize: fontSize.sm,
      color: colors.studyText,
      opacity: 0.5,
      textAlign: 'center',
    },
  });
