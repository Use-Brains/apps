import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister, dehydrateOptions } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { NetworkProvider } from '@/lib/network';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider, useTheme, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';
    const inWelcome = segments[0] === 'welcome';
    const needsWelcome = isAuthenticated && !user?.displayName;

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
      return;
    }

    if (needsWelcome && !inWelcome) {
      router.replace('/welcome');
      return;
    }

    if (isAuthenticated && !needsWelcome && (inAuth || inWelcome)) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, loading, segments, router, user?.displayName]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister, dehydrateOptions }}>
          <AuthProvider>
            <NetworkProvider>
              <AuthGate>
                <>
                  <OfflineBanner />
                  <Slot />
                </>
              </AuthGate>
            </NetworkProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

const createStyles = ({ colors }: AppTheme) =>
  StyleSheet.create({
    loading: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
  });
