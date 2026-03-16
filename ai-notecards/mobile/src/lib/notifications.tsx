import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Linking } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { api } from './api';
import {
  getNotificationPresentationBehavior,
  getRouteFromNotificationUrl,
} from './notification-helpers';
import { storage } from './mmkv';
import { getDeviceTimezone } from './timezone';
import { useAuth } from './auth';

const REGISTERED_PUSH_TOKEN_KEY = 'registered-push-token';

type NotificationContextValue = {
  pushStatus: 'idle' | 'unsupported' | 'denied' | 'granted' | 'error';
  syncPushRegistration: (options?: { requestPermissions?: boolean }) => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async (notification) =>
    getNotificationPresentationBehavior(notification.request.content.data),
});

function getProjectId() {
  const configuredProjectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  return typeof configuredProjectId === 'string' && configuredProjectId.trim().length > 0
    ? configuredProjectId
    : null;
}

function readStoredPushToken() {
  return storage.getString(REGISTERED_PUSH_TOKEN_KEY) ?? null;
}

function writeStoredPushToken(token: string | null) {
  if (token) {
    storage.set(REGISTERED_PUSH_TOKEN_KEY, token);
    return;
  }

  storage.remove(REGISTERED_PUSH_TOKEN_KEY);
}

async function registerPushTokenWithServer(token: string) {
  await api.registerNotificationDevice({
    token,
    timezone: getDeviceTimezone(),
    permissionStatus: 'granted',
  });
  writeStoredPushToken(token);
}

async function unregisterStoredPushToken() {
  const token = readStoredPushToken();
  if (!token) {
    return;
  }

  try {
    await api.unregisterNotificationDevice(token);
  } finally {
    writeStoredPushToken(null);
  }
}

async function syncPushToken(options: { requestPermissions?: boolean } = {}) {
  if (!Device.isDevice) {
    return { ok: false, status: 'unsupported' as const };
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted' && options.requestPermissions) {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return {
      ok: false,
      status: finalStatus === 'denied' ? 'denied' as const : 'idle' as const,
    };
  }

  const projectId = getProjectId();
  if (!projectId) {
    return { ok: false, status: 'error' as const };
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  await registerPushTokenWithServer(tokenResponse.data);

  return { ok: true, status: 'granted' as const };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [pushStatus, setPushStatus] = useState<NotificationContextValue['pushStatus']>('idle');

  const syncPushRegistration = useCallback(async (options: { requestPermissions?: boolean } = {}) => {
    if (!user?.id) {
      setPushStatus('idle');
      return false;
    }

    try {
      const result = await syncPushToken(options);
      setPushStatus(result.status);
      return result.ok;
    } catch {
      setPushStatus('error');
      return false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setPushStatus('idle');
      return;
    }

    void syncPushRegistration();
  }, [syncPushRegistration, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = getRouteFromNotificationUrl(response.notification.request.content.data);
      if (route) {
        router.push(route);
        return;
      }

      const fallbackUrl = response.notification.request.content.data?.url;
      if (typeof fallbackUrl === 'string') {
        void Linking.openURL(fallbackUrl);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncPushRegistration();
      }
    });

    return () => {
      responseSubscription.remove();
      appStateSubscription.remove();
    };
  }, [router, syncPushRegistration, user?.id]);

  const value = useMemo(() => ({
    pushStatus,
    syncPushRegistration,
  }), [pushStatus, syncPushRegistration]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

export async function unregisterCurrentDevice() {
  try {
    await unregisterStoredPushToken();
  } catch {
    writeStoredPushToken(null);
  }
}
