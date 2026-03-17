import { Tabs } from 'expo-router';
import { useTheme } from '@/lib/theme';
import { FloatingTabBar } from '@/components/FloatingTabBar';

export default function TabsLayout() {
  const {
    theme: { colors },
  } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        tabBarHideOnKeyboard: true,
        headerStyle: {
          backgroundColor: colors.background,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarButtonTestID: 'tab-home-button',
        }}
      />
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarButtonTestID: 'tab-generate-button',
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          headerShown: false,
          tabBarButtonTestID: 'tab-marketplace-button',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarButtonTestID: 'tab-settings-button',
        }}
      />
    </Tabs>
  );
}
