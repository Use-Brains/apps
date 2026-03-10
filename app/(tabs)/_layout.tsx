import { Tabs } from 'expo-router';
import { colors, fontSize } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: fontSize.xs },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          headerShown: false,
          tabBarLabel: 'Journal',
          tabBarButtonTestID: 'tab-journal-button',
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: 'New Trade',
          tabBarLabel: 'Add',
          tabBarButtonTestID: 'tab-add-button',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarButtonTestID: 'tab-settings-button',
        }}
      />
    </Tabs>
  );
}
