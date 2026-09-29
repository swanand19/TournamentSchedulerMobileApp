import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useServer } from '@/config/server';

// Loading data for a screen: the first load, pull-to-refresh, a silent reload when the screen comes
// back into focus (so the hub shows a score entered on the match screen), and optional polling for
// live screens so a second phone stays in step.
//
// Polling only runs while the screen is focused and the app is in the foreground — a scorer's
// phone in a pocket shouldn't be hitting the laptop every few seconds.

type Options = {
  /** Reload every this many ms while focused. Off by default. */
  pollMs?: number;
  /** When false the query waits (e.g. until the server address has been read). */
  enabled?: boolean;
};

export type Query<T> = {
  data: T | undefined;
  error: Error | null;
  /** True only for the very first load, so a refresh never blanks the screen. */
  loading: boolean;
  refreshing: boolean;
  /** Pull-to-refresh: shows the spinner. */
  refresh: () => Promise<void>;
  /** Quiet reload after an action, with no spinner. */
  reload: () => Promise<void>;
  /** Replace the data with what an action returned, skipping a round trip. */
  setData: (value: T) => void;
};

/** `fetcher` must be stable (wrap it in useCallback); a new fetcher means a fresh load. */
export function useQuery<T>(fetcher: () => Promise<T>, { pollMs, enabled: wanted = true }: Options = {}): Query<T> {
  // Nothing loads until the saved server address has been read — otherwise a screen opened
  // straight from a link (or restored by Android) asks "(no server set)" and fails. A new
  // address means a fresh load, so it's part of the effect below.
  const { ready, baseUrl } = useServer();
  const enabled = wanted && ready;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Each request takes a ticket; only the newest ticket may write. A slow answer for a screen's
  // previous state can then never land on top of a newer one.
  const ticket = useRef(0);

  const run = useCallback(async () => {
    const mine = ++ticket.current;
    try {
      const value = await fetcher();
      if (mine !== ticket.current) return;
      setDataState(value);
      setError(null);
    } catch (e) {
      if (mine !== ticket.current) return;
      // The error stays until fresh data arrives, so it's visible while a retry is in flight.
      setError(e as Error);
    }
  }, [fetcher]);

  // Runs on first focus, on every return to the screen, and whenever the fetcher changes while
  // focused — one effect covers the first load, the reload-on-return and a changed query.
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      run();

      if (!pollMs) return undefined;
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') run();
      }, pollMs);
      return () => clearInterval(timer);
      // baseUrl isn't read here, but a changed server address has to trigger a fresh load.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, pollMs, run, baseUrl]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  const setData = useCallback((value: T) => {
    ticket.current++; // an action's answer is newer than any request still in flight
    setDataState(value);
    setError(null);
  }, []);

  return { data, error, loading: data === undefined && !error, refreshing, refresh, reload: run, setData };
}
