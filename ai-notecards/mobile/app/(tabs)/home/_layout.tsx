import { Stack } from 'expo-router';
import { useTheme } from '@/lib/theme';

export default function HomeLayout() {
  const {
    theme: { colors },
    selection,
  } = useTheme();
  const isGlass = selection.style === 'ios_glass';

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: isGlass ? 'transparent' : colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
        headerTransparent: isGlass,
        headerShadowVisible: false,
      }}
    />
  );
}
