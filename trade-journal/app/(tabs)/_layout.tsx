import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { fontSize, useTheme } from '@/lib/theme';

function GlassTabBarBackground() {
  const { selection, theme: { colors } } = useTheme();
  const isLight = selection.mode === 'light';

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Base gradient matching IosGlassBackground tokens */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <BlurView
        intensity={40}
        tint={isLight ? 'light' : 'dark'}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Top border line — glass edge */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 0.5,
          backgroundColor: colors.tabBarEdge,
        }}
      />
    </View>
  );
}

export default function TabsLayout() {
  const {
    theme: { colors },
    selection,
  } = useTheme();

  const isGlass = selection.style === 'ios_glass';
  const isMaterial = selection.style === 'android_material';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: isGlass ? '500' : '400',
        },
        tabBarStyle: isGlass
          ? {
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
            }
          : isMaterial
            ? {
                backgroundColor: colors.surface,
                borderTopColor: 'transparent',
                elevation: 8,
                shadowColor: colors.shadow,
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
              }
            : {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
        tabBarBackground: isGlass ? () => <GlassTabBarBackground /> : undefined,
        headerStyle: {
          backgroundColor: isGlass ? 'transparent' : colors.background,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '600',
        },
        headerTransparent: isGlass,
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
        name="strategies"
        options={{
          title: 'Strategies',
          headerShown: false,
          tabBarLabel: 'Strategies',
          tabBarButtonTestID: 'tab-strategies-button',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarButtonTestID: 'tab-settings-button',
          headerShown: isGlass ? false : true,
        }}
      />
    </Tabs>
  );
}
