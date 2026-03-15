import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, clearToken } from './api';

type User = {
  id: string;
  email: string;
  displayName: string | null;
  plan: string;
  avatarUrl: string | null;
  studyScore: number;
  currentStreak: number;
};

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
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  const refreshUser = useCallback(async () => {
    try {
      const data = await api.me() as { user: User };
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
    setState({ user: data.user, loading: false });
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    const data = await api.signup(email, password) as { token: string; user: User };
    await setToken(data.token);
    setState({ user: data.user, loading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      await clearToken();
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
