import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

export function initializeSentry() {
  if (initialized) {
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    initialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'development',
    release: `${Constants.expoConfig?.slug ?? 'ai-notecards-mobile'}@${Constants.expoConfig?.version ?? '0.1.0'}`,
    enableAutoPerformanceTracing: true,
    enableNativeCrashHandling: true,
    enableWatchdogTerminationTracking: true,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });

  initialized = true;
}

export function captureException(error: unknown) {
  if (!initialized || !process.env.EXPO_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.captureException(error);
}
