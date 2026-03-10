import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/lib/theme';

export default function JournalLayout() {
  const router = useRouter();
  const {
    theme: { colors },
  } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Journal',
          headerRight: () => (
            <Pressable onPress={() => router.push('/(tabs)/journal/import')}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Import CSV</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="import" options={{ title: 'Import CSV' }} />
      <Stack.Screen name="[id]" options={{ title: 'Trade Detail' }} />
    </Stack>
  );
}
