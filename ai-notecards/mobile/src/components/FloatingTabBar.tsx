import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring, interpolate, useSharedValue, withTiming, Extrapolation } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@/lib/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { label: string; active: IoniconsName; inactive: IoniconsName }> = {
  home: { label: 'Home', active: 'home', inactive: 'home-outline' },
  generate: { label: 'Generate', active: 'sparkles', inactive: 'sparkles-outline' },
  marketplace: { label: 'Market', active: 'storefront', inactive: 'storefront-outline' },
  settings: { label: 'Settings', active: 'settings', inactive: 'settings-outline' }
};

function TabItem({ route, isFocused, onPress }: { route: { key: string; name: string }; isFocused: boolean; onPress: () => void }) {
  const {
    theme: { colors }
  } = useTheme();
  const config = TAB_CONFIG[route.name] ?? { label: route.name, active: 'ellipse', inactive: 'ellipse-outline' };
  const progress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(isFocused ? 1 : 0, { damping: 20, stiffness: 200 });
  }, [isFocused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: withTiming(progress.value, { duration: 180 }),
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP)
      }
    ]
  }));

  const iconScale = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(progress.value, [0, 1], [1, 1.08], Extrapolation.CLAMP)
      }
    ]
  }));

  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={4}>
      <View style={styles.tabInner}>
        <Animated.View style={[styles.pill, { backgroundColor: colors.primaryLight }, pillStyle]} />
        <Animated.View style={iconScale}>
          <Ionicons name={isFocused ? config.active : config.inactive} size={24} color={isFocused ? colors.primary : colors.textTertiary} />
        </Animated.View>
        <Text style={[styles.label, { color: isFocused ? colors.primary : colors.textTertiary }, isFocused && styles.labelActive]}>{config.label}</Text>
      </View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
    selection
  } = useTheme();
  const isLight = selection.mode !== 'dark';

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
      <View
        style={[
          styles.shadowContainer,
          {
            shadowColor: colors.shadow
          }
        ]}
      >
        <BlurView intensity={isLight ? 70 : 50} tint={isLight ? 'light' : 'dark'} style={styles.blur}>
          <View
            style={[
              styles.inner,
              {
                backgroundColor: isLight ? 'rgba(250,247,242,0.55)' : 'rgba(15,14,12,0.55)',
                borderColor: isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.10)'
              }
            ]}
          >
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return <TabItem key={route.key} route={route} isFocused={isFocused} onPress={onPress} />;
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: 'transparent'
  },
  shadowContainer: {
    borderRadius: 32,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 10
  },
  blur: {
    borderRadius: 32,
    overflow: 'hidden'
  },
  inner: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 32,
    borderWidth: 1
  },
  tab: {
    flex: 1,
    alignItems: 'center'
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    minWidth: 60
  },
  pill: {
    position: 'absolute',
    top: -6,
    left: -14,
    right: -14,
    bottom: -6,
    borderRadius: 20
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.2
  },
  labelActive: {
    fontWeight: '600'
  }
});
