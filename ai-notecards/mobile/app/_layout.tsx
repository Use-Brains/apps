import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister } from '@/lib/query-client';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider, useTheme, useThemedStyles } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, loading, segments]);

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
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
          <AuthProvider>
            <AuthGate>
              <Slot />
            </AuthGate>
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
