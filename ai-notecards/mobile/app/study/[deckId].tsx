import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { fontSize, spacing, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

export default function StudySessionScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Study Session</Text>
      <Text style={styles.subtitle}>Studying deck: {deckId}</Text>
    </View>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['3xl'],
      backgroundColor: colors.studyBackground,
    },
    title: {
      fontSize: fontSize['2xl'],
      fontWeight: '700',
      color: colors.studyText,
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.studyText,
      opacity: 0.7,
    },
  });
