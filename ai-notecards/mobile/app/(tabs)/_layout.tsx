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
        name="home"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarButtonTestID: 'tab-home-button',
        }}
      />
      <Tabs.Screen
        name="generate"
        options={{
          title: 'Generate',
          tabBarLabel: 'Generate',
          tabBarButtonTestID: 'tab-generate-button',
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Marketplace',
          headerShown: false,
          tabBarLabel: 'Market',
          tabBarButtonTestID: 'tab-marketplace-button',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarButtonTestID: 'tab-profile-button',
        }}
      />
    </Tabs>
  );
}
