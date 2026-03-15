import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authInProgress = useRef(false);

  useEffect(() => {
    api.me()
      .then((data) => {
        setUser(data.user);
        if (data.user) Sentry.setUser({ id: data.user.id });
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    if (data.user) Sentry.setUser({ id: data.user.id });
    return data;
  };

  const signup = async (email, password) => {
    const data = await api.signup(email, password);
    setUser(data.user);
    if (data.user) Sentry.setUser({ id: data.user.id });
    return data;
  };

  const loginWithGoogle = useCallback(async (idToken) => {
    if (authInProgress.current) return;
    authInProgress.current = true;
    try {
      const data = await api.authGoogle(idToken);
      setUser(data.user);
      if (data.user) Sentry.setUser({ id: data.user.id });
      return data;
    } finally {
      authInProgress.current = false;
    }
  }, []);

  const requestMagicLink = useCallback(async (email) => {
    return api.magicLinkRequest(email);
  }, []);

  const verifyMagicLink = useCallback(async (email, code) => {
    if (authInProgress.current) return;
    authInProgress.current = true;
    try {
      const data = await api.magicLinkVerify(email, code);
      setUser(data.user);
      if (data.user) Sentry.setUser({ id: data.user.id });
      return data;
    } finally {
      authInProgress.current = false;
    }
  }, []);

  const logout = async () => {
    await api.logout();
    setUser(null);
    Sentry.setUser(null);
  };

  const refreshUser = async () => {
    const data = await api.me();
    setUser(data.user);
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login, signup, logout, refreshUser,
      loginWithGoogle, requestMagicLink, verifyMagicLink,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
