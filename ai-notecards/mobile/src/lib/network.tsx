import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { refreshOfflineDeckSnapshots } from './offline/downloads';
import { syncPendingSessions } from './offline/sync';
import { useAuth } from './auth';

type NetworkContextValue = {
  isOnline: boolean;
  isSyncing: boolean;
  refreshOfflineState: () => Promise<void>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refreshOfflineState = useCallback(async () => {
    if (!isAuthenticated || inFlightRef.current) {
      return inFlightRef.current ?? Promise.resolve();
    }

    const task = (async () => {
      setIsSyncing(true);
      try {
        await syncPendingSessions();
      } catch {
        // Best-effort sync; retry on next trigger.
      }

      try {
        await refreshOfflineDeckSnapshots();
      } catch {
        // Best-effort refresh; surface state through UI instead of throwing here.
      } finally {
        setIsSyncing(false);
      }
    })().finally(() => {
      inFlightRef.current = null;
    });

    inFlightRef.current = task;
    return task;
  }, [isAuthenticated]);

  useEffect(() => {
    let mounted = true;

    void NetInfo.fetch().then((state) => {
      if (!mounted) return;
      setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const nextOnline = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(nextOnline);
      if (nextOnline) {
        void refreshOfflineState();
      }
    });

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void NetInfo.fetch().then((state) => {
          const nextOnline = !!state.isConnected && state.isInternetReachable !== false;
          setIsOnline(nextOnline);
          if (nextOnline) {
            void refreshOfflineState();
          }
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribeNetInfo();
      subscription.remove();
    };
  }, [refreshOfflineState]);

  const value = useMemo(() => ({
    isOnline,
    isSyncing,
    refreshOfflineState,
  }), [isOnline, isSyncing, refreshOfflineState]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}
