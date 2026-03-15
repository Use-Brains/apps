import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import * as Sentry from '@sentry/react';
import { api } from './api.js';
import { analytics } from './analytics.js';

const AuthContext = createContext(null);

function identifyUser(user) {
  Sentry.setUser({ id: user.id });
  analytics.identify(user.id, {
    plan: user.plan,
    signup_date: user.created_at,
    is_seller: !!user.seller_terms_accepted_at,
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authInProgress = useRef(false);

  useEffect(() => {
    api.me()
      .then((data) => {
        if (data.user) {
          setUser({ ...data.user, deck_count: data.deck_count });
          identifyUser(data.user);
          // Sync server consent preference to localStorage
          if (data.user.preferences?.analytics_opt_out === false) {
            localStorage.setItem('analytics_consent', 'granted');
          } else if (data.user.preferences?.analytics_opt_out === true) {
            localStorage.setItem('analytics_consent', 'declined');
          }
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    if (data.user) identifyUser(data.user);
    return data;
  };

  const signup = async (email, password) => {
    const data = await api.signup(email, password);
    setUser(data.user);
    if (data.user) identifyUser(data.user);
    return data;
  };

  const loginWithGoogle = useCallback(async (idToken) => {
    if (authInProgress.current) return;
    authInProgress.current = true;
    try {
      const data = await api.authGoogle(idToken);
      setUser(data.user);
      if (data.user) identifyUser(data.user);
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
      if (data.user) identifyUser(data.user);
      return data;
    } finally {
      authInProgress.current = false;
    }
  }, []);

  const logout = async () => {
    await api.logout();
    setUser(null);
    Sentry.setUser(null);
    analytics.reset();
  };

  // Deduplicated refreshUser — concurrent calls share one /me request
  const refreshPromise = useRef(null);
  const lastRefreshRef = useRef(0);

  const refreshUser = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current;
    const promise = api.me()
      .then((data) => {
        setUser(data.user ? { ...data.user, deck_count: data.deck_count } : null);
        return data;
      })
      .finally(() => {
        refreshPromise.current = null;
        lastRefreshRef.current = Date.now();
      });
    refreshPromise.current = promise;
    return promise;
  }, []);

  // Throttled visibilitychange refetch (5s minimum between refreshes)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefreshRef.current < 5000) return;
      refreshUser().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshUser]);

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
