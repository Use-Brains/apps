import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function JournalLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Journal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Trade Detail' }} />
    </Stack>
  );
}
