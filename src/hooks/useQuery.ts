import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useServer } from '@/config/server';
import { isLive, onLiveChange, subscribe, type LiveTopic } from '@/realtime/live';

/** While the live line is open, polling is only a safety net for a nudge that went missing. */
export const LIVE_POLL_MS = 60_000;

/** Several nudges this close together make one reload. */
const BUNCH_MS = 500;

// Loading data for a screen: the first load, pull-to-refresh, a silent reload when the screen comes
// back into focus (so the hub shows a score entered on the match screen), and optional polling for
// live screens so a second phone stays in step.
//
// Polling only runs while the screen is focused and the app is in the foreground — a scorer's
// phone in a pocket shouldn't be hitting the laptop every few seconds. With a `live` topic the
// screen also reloads as soon as the live line says it changed (realtime/live.ts), and polls only
// slowly (LIVE_POLL_MS) while the line is open.

type Options = {
  /** Reload every this many ms while focused. Off by default. */
  pollMs?: number;
  /** When false the query waits (e.g. until the server address has been read). */
  enabled?: boolean;
  /** Reload when the live line says this changed. */
  live?: LiveTopic | null;
  /** Nudges this close together make one reload (default 500 ms; the auction wants a bid on screen sooner). */
  bunchMs?: number;
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
export function useQuery<T>(fetcher: () => Promise<T>, { pollMs, enabled: wanted = true, live, bunchMs = BUNCH_MS }: Options = {}): Query<T> {
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

  // What the screen is showing, as text. A reload that brings back exactly the same answer (most
  // polls, and most returns to a screen) is dropped here: a new object with the same contents would
  // still redraw the whole screen, on the thread that also has to answer the next tap.
  const showing = useRef<string | undefined>(undefined);

  const run = useCallback(async () => {
    const mine = ++ticket.current;
    try {
      const value = await fetcher();
      if (mine !== ticket.current) return;
      const text = JSON.stringify(value);
      if (text === undefined || text !== showing.current) {
        showing.current = text;
        setDataState(value);
      }
      setError(null);
    } catch (e) {
      if (mine !== ticket.current) return;
      // The error stays until fresh data arrives, so it's visible while a retry is in flight.
      setError(e as Error);
    }
  }, [fetcher]);

  const [lineOpen, setLineOpen] = useState(isLive);
  useEffect(() => onLiveChange(setLineOpen), []);
  const liveKey = live ? JSON.stringify(live) : null;
  const every = pollMs && liveKey && lineOpen ? Math.max(pollMs, LIVE_POLL_MS) : pollMs;

  // Runs on first focus, on every return to the screen, and whenever the fetcher changes while
  // focused — one effect covers the first load, the reload-on-return and a changed query.
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      run();

      if (!every) return undefined;
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') run();
      }, every);
      return () => clearInterval(timer);
      // baseUrl isn't read here, but a changed server address has to trigger a fresh load.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, every, run, baseUrl]),
  );

  // Listening only while focused: a screen further back in the stack reloads when it's returned to.
  useFocusEffect(
    useCallback(() => {
      if (!enabled || !liveKey) return undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const unsubscribe = subscribe(JSON.parse(liveKey) as LiveTopic, () => {
        if (timer) return;
        timer = setTimeout(() => {
          timer = undefined;
          if (AppState.currentState === 'active') run();
        }, bunchMs);
      });
      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }, [enabled, liveKey, run, bunchMs]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await run();
    setRefreshing(false);
  }, [run]);

  const setData = useCallback((value: T) => {
    ticket.current++; // an action's answer is newer than any request still in flight
    showing.current = undefined; // not worth comparing: the next reload simply draws
    setDataState(value);
    setError(null);
  }, []);

  return { data, error, loading: data === undefined && !error, refreshing, refresh, reload: run, setData };
}
