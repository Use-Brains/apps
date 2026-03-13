import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function StrategiesLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Strategies' }} />
      <Stack.Screen
        name="new"
        options={{
          title: 'New Strategy',
          presentation: 'modal',
        }}
      />
      <Stack.Screen name="[id]" options={{ title: 'Strategy Detail' }} />
    </Stack>
  );
}
