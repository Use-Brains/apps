import { useRef, useCallback } from 'react';

/**
 * Ref-based guard to prevent double-click / concurrent async operations.
 * Returns { busy: ref, run: (fn) => Promise }.
 * If busy, subsequent calls are silently dropped.
 */
export function useAsyncGuard() {
  const busyRef = useRef(false);
  const run = useCallback(async (fn) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      return await fn();
    } finally {
      busyRef.current = false;
    }
  }, []);
  return { busy: busyRef, run };
}
