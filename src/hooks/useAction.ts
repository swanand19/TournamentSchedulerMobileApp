import { useCallback, useRef, useState } from 'react';

import { haptic } from '@/lib/haptics';

// Running anything that changes data. The in-flight guard is the important part: a scorer who
// taps GOAL twice because the Wi-Fi is slow must record one goal, not two. The ref closes the gap
// between the tap and React re-rendering the disabled button.

export type ActionResult<T> = { ok: true; value: T } | { ok: false };

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef(false);

  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<ActionResult<T>> => {
    if (inFlight.current) return { ok: false };
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      return { ok: true, value: await fn() };
    } catch (e) {
      setError(e as Error);
      haptic.error();
      return { ok: false };
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { busy, error, run, clearError, setError };
}
