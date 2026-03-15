import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@/types/api';
import { api, setToken, clearToken } from './api';
import { storage } from './mmkv';

const USER_CACHE_KEY = 'cached-user';

type AuthState = {
  user: User | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cachedUserJson = storage.getString(USER_CACHE_KEY);
  const cachedUser = cachedUserJson ? JSON.parse(cachedUserJson) as User : null;

  const [state, setState] = useState<AuthState>({
    user: cachedUser,
    loading: cachedUser === null, // spinner only on first install or after logout
  });

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.me() as { user: User };
      storage.set(USER_CACHE_KEY, JSON.stringify(data.user));
      setState({ user: data.user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.login(email, password) as { token: string; user: User };
    await setToken(data.token);
    storage.set(USER_CACHE_KEY, JSON.stringify(data.user));
    setState({ user: data.user, loading: false });
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const data = await api.signup(email, password) as { token: string; user: User };
    await setToken(data.token);
    storage.set(USER_CACHE_KEY, JSON.stringify(data.user));
    setState({ user: data.user, loading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      await clearToken();
      storage.remove(USER_CACHE_KEY);
      setState({ user: null, loading: false });
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    isAuthenticated: !!state.user,
    login,
    signup,
    logout,
    refreshUser,
  }), [state, login, signup, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
