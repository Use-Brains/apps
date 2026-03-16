import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import type { AuthSessionResponse, User } from '@/types/api';
import { api, clearSessionTokens, hasStoredRefreshToken, refreshSession, setSessionTokens } from './api';
import { storage } from './mmkv';
import { clearPersistedQueryCache } from './query-client';
import { initializeSubscriptionIdentity, resetSubscriptionIdentity } from './subscriptions';
import { getDeviceTimezone, shouldSyncTimezone } from './timezone';

const USER_CACHE_KEY = 'cached-user';
const BIOMETRIC_ENABLED_KEY = 'biometric-enabled';
const BIOMETRIC_PROMPT_SEEN_KEY = 'biometric-prompt-seen';

type AuthState = {
  user: User | null;
  loading: boolean;
  biometricEnabled: boolean;
  lockedSessionAvailable: boolean;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthSessionResponse>;
  signup: (email: string, password: string) => Promise<AuthSessionResponse>;
  loginWithGoogle: (idToken: string) => Promise<AuthSessionResponse>;
  loginWithApple: (identityToken: string, fullName?: string | null) => Promise<AuthSessionResponse>;
  requestMagicLink: (email: string) => Promise<{ ok: boolean }>;
  verifyMagicLink: (email: string, code: string) => Promise<AuthSessionResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  unlockStoredSession: () => Promise<boolean>;
  enableBiometricLock: () => Promise<boolean>;
  disableBiometricLock: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readCachedUser(): User | null {
  const cachedUserJson = storage.getString(USER_CACHE_KEY);
  return cachedUserJson ? JSON.parse(cachedUserJson) as User : null;
}

function readBoolean(key: string): boolean {
  return storage.getString(key) === 'true';
}

function writeBoolean(key: string, value: boolean) {
  storage.set(key, value ? 'true' : 'false');
}

async function canUseBiometrics() {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);

  return hasHardware && isEnrolled;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    biometricEnabled: readBoolean(BIOMETRIC_ENABLED_KEY),
    lockedSessionAvailable: false,
  });

  const persistUser = useCallback((user: User | null) => {
    if (user) {
      storage.set(USER_CACHE_KEY, JSON.stringify(user));
    } else {
      storage.remove(USER_CACHE_KEY);
    }
  }, []);

  const disableBiometricLock = useCallback(() => {
    writeBoolean(BIOMETRIC_ENABLED_KEY, false);
    setState((current) => ({
      ...current,
      biometricEnabled: false,
      lockedSessionAvailable: false,
    }));
  }, []);

  const enableBiometricLock = useCallback(async () => {
    const available = await canUseBiometrics();
    if (!available) {
      Alert.alert('Biometrics unavailable', 'Face ID or Touch ID is not available on this device.');
      return false;
    }

    writeBoolean(BIOMETRIC_ENABLED_KEY, true);
    writeBoolean(BIOMETRIC_PROMPT_SEEN_KEY, true);
    setState((current) => ({
      ...current,
      biometricEnabled: true,
    }));
    return true;
  }, []);

  const maybePromptForBiometrics = useCallback(async () => {
    if (readBoolean(BIOMETRIC_PROMPT_SEEN_KEY) || readBoolean(BIOMETRIC_ENABLED_KEY)) {
      return;
    }

    if (!(await canUseBiometrics())) {
      return;
    }

    Alert.alert(
      'Protect this session?',
      'Use Face ID or Touch ID before reopening AI Notecards on this device.',
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => writeBoolean(BIOMETRIC_PROMPT_SEEN_KEY, true),
        },
        {
          text: 'Enable',
          onPress: () => {
            void enableBiometricLock();
          },
        },
      ]
    );
  }, [enableBiometricLock]);

  const applySession = useCallback(async (session: AuthSessionResponse) => {
    await setSessionTokens(session.accessToken, session.refreshToken);
    persistUser(session.user);
    setState((current) => ({
      ...current,
      user: session.user,
      loading: false,
      lockedSessionAvailable: false,
    }));
    void maybePromptForBiometrics();
    return session;
  }, [maybePromptForBiometrics, persistUser]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.me();
      if (data.user) {
        persistUser(data.user);
        setState((current) => ({
          ...current,
          user: data.user,
          loading: false,
          lockedSessionAvailable: false,
        }));
        return;
      }

      if (await hasStoredRefreshToken()) {
        const refreshed = await refreshSession();
        if (refreshed?.user) {
          persistUser(refreshed.user);
          setState((current) => ({
            ...current,
            user: refreshed.user,
            loading: false,
            lockedSessionAvailable: false,
          }));
          return;
        }
      }

      persistUser(null);
      setState((current) => ({
        ...current,
        user: null,
        loading: false,
        lockedSessionAvailable: false,
      }));
    } catch {
      const fallbackUser = readCachedUser();
      setState((current) => ({
        ...current,
        user: fallbackUser,
        loading: false,
      }));
    }
  }, [persistUser]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const biometricEnabled = readBoolean(BIOMETRIC_ENABLED_KEY);
      const storedRefreshToken = await hasStoredRefreshToken();

      if (cancelled) return;

      if (biometricEnabled && storedRefreshToken) {
        setState({
          user: null,
          loading: false,
          biometricEnabled: true,
          lockedSessionAvailable: true,
        });
        return;
      }

      const cachedUser = readCachedUser();
      setState((current) => ({
        ...current,
        user: cachedUser,
        loading: true,
        biometricEnabled,
        lockedSessionAvailable: false,
      }));

      await refreshUser();
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void (async () => {
          if (readBoolean(BIOMETRIC_ENABLED_KEY) && await hasStoredRefreshToken()) {
            setState((current) => ({
              ...current,
              user: null,
              loading: false,
              biometricEnabled: true,
              lockedSessionAvailable: true,
            }));
            return;
          }

          await refreshUser();
        })();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshUser]);

  useEffect(() => {
    if (state.user?.id) {
      void initializeSubscriptionIdentity(state.user.id);
      return;
    }

    void resetSubscriptionIdentity();
  }, [state.user?.id]);

  useEffect(() => {
    const user = state.user;
    if (!user?.id) return;

    const currentTimezone = typeof user.preferences?.timezone === 'string'
      ? user.preferences.timezone
      : null;
    const deviceTimezone = getDeviceTimezone();

    if (!shouldSyncTimezone(currentTimezone, deviceTimezone)) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await api.updatePreferences({ timezone: deviceTimezone });
        if (cancelled) return;

        const nextUser = {
          ...user,
          preferences: {
            ...(user.preferences || {}),
            timezone: deviceTimezone,
          },
        };

        persistUser(nextUser);
        setState((current) => {
          if (current.user?.id !== user.id) return current;
          return {
            ...current,
            user: nextUser,
          };
        });
      } catch {
        // Best-effort sync; try again on a future refresh.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [persistUser, state.user]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await api.login(email, password);
    return applySession(session);
  }, [applySession]);

  const signup = useCallback(async (email: string, password: string) => {
    const session = await api.signup(email, password);
    return applySession(session);
  }, [applySession]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const session = await api.authGoogle(idToken);
    return applySession(session);
  }, [applySession]);

  const loginWithApple = useCallback(async (identityToken: string, fullName?: string | null) => {
    const session = await api.authApple(identityToken, fullName);
    return applySession(session);
  }, [applySession]);

  const requestMagicLink = useCallback((email: string) => api.magicLinkRequest(email), []);

  const verifyMagicLink = useCallback(async (email: string, code: string) => {
    const session = await api.magicLinkVerify(email, code);
    return applySession(session);
  }, [applySession]);

  const unlockStoredSession = useCallback(async () => {
    if (!(await hasStoredRefreshToken())) {
      setState((current) => ({
        ...current,
        lockedSessionAvailable: false,
      }));
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock AI Notecards',
      cancelLabel: 'Not now',
      disableDeviceFallback: true,
    });

    if (!result.success) {
      return false;
    }

    setState((current) => ({
      ...current,
      loading: true,
    }));

    await refreshUser();
    return true;
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      const { unregisterCurrentDevice } = await import('./notifications');
      await unregisterCurrentDevice();
      await api.logout();
    } finally {
      await resetSubscriptionIdentity();
      await clearSessionTokens();
      await clearPersistedQueryCache();
      persistUser(null);
      setState((current) => ({
        ...current,
        user: null,
        loading: false,
        lockedSessionAvailable: false,
      }));
    }
  }, [persistUser]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    isAuthenticated: !!state.user,
    login,
    signup,
    loginWithGoogle,
    loginWithApple,
    requestMagicLink,
    verifyMagicLink,
    logout,
    refreshUser,
    unlockStoredSession,
    enableBiometricLock,
    disableBiometricLock,
  }), [state, login, signup, loginWithGoogle, loginWithApple, requestMagicLink, verifyMagicLink, logout, refreshUser, unlockStoredSession, enableBiometricLock, disableBiometricLock]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
