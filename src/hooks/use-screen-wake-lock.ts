import { useEffect, useRef } from "react";

export function useScreenWakeLock(enabled: boolean) {
  const enabledRef = useRef(enabled);
  const requestInFlightRef = useRef(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let isMounted = true;

    function handleWakeLockRelease() {
      const activeSentinel = sentinelRef.current;

      if (activeSentinel) {
        activeSentinel.removeEventListener("release", handleWakeLockRelease);
      }

      sentinelRef.current = null;

      if (enabledRef.current && document.visibilityState === "visible") {
        void requestWakeLock();
      }
    }

    async function releaseWakeLock() {
      const activeSentinel = sentinelRef.current;

      if (!activeSentinel) {
        return;
      }

      sentinelRef.current = null;
      activeSentinel.removeEventListener("release", handleWakeLockRelease);

      if (activeSentinel.released) {
        return;
      }

      try {
        await activeSentinel.release();
      } catch {
        // Ignore platform-specific release failures.
      }
    }

    async function requestWakeLock() {
      if (!isMounted || !enabledRef.current || document.visibilityState !== "visible") {
        return;
      }

      if (requestInFlightRef.current) {
        return;
      }

      const wakeLock = navigator.wakeLock;

      if (!wakeLock?.request) {
        return;
      }

      const activeSentinel = sentinelRef.current;

      if (activeSentinel && !activeSentinel.released) {
        return;
      }

      requestInFlightRef.current = true;

      try {
        const nextSentinel = await wakeLock.request("screen");

        if (!isMounted || !enabledRef.current || document.visibilityState !== "visible") {
          try {
            await nextSentinel.release();
          } catch {
            // Ignore platform-specific release failures.
          }

          return;
        }

        nextSentinel.addEventListener("release", handleWakeLockRelease);
        sentinelRef.current = nextSentinel;
      } catch {
        // Unsupported browsers and denied requests should fail silently.
      } finally {
        requestInFlightRef.current = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
        return;
      }

      void releaseWakeLock();
    }

    if (enabled) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void releaseWakeLock();
    };
  }, [enabled]);
}
