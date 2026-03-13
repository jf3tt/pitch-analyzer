/**
 * useWakeLock — prevents the screen from dimming/locking while active.
 *
 * Uses the Screen Wake Lock API (supported in Chrome, Edge, Safari 16.4+).
 * Automatically re-acquires the lock when the page becomes visible again
 * (e.g. after switching tabs and coming back).
 */

import { useEffect, useRef } from 'react';

export function useWakeLock(active: boolean): void {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) {
      // Release lock when no longer needed
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
      return;
    }

    // Check API support
    if (!('wakeLock' in navigator)) return;

    const requestLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // Wake Lock request can fail (e.g. low battery, background tab)
      }
    };

    void requestLock();

    // Re-acquire when page becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        void requestLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, [active]);
}
