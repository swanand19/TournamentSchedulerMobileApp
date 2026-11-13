import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { request, setApiBaseUrl } from '@/api/client';
import { ApiError } from '@/api/errors';

// Where the API lives. In development (Expo Go against the laptop) the laptop's IP can change, so the
// address is saved on the phone and editable in the Server screen; EXPO_PUBLIC_API_BASE_URL (in
// .env.local) is only the first-run default. Installed builds (the APK and Google Play, eas.json) set
// EXPO_PUBLIC_SERVER_LOCKED: they always use the Azure address they were built with, whatever an earlier
// install saved, and the Server screen only checks the connection.

const STORAGE_KEY = 'server.baseUrl';
const DEFAULT_PORT = 5080;

/** An installed build talks only to the server it was built for. */
export const SERVER_LOCKED = process.env.EXPO_PUBLIC_SERVER_LOCKED === 'true';

/** The action offered next to a network error: change the address, or (installed builds) check the connection. */
export const SERVER_ACTION_LABEL = SERVER_LOCKED ? 'Check connection' : 'Change server';

/**
 * Accepts the address however it's typed — "192.168.1.14", "192.168.1.14:5080",
 * "http://192.168.1.14:5080/api/" — and returns "http://192.168.1.14:5080".
 * Returns null when it can't be an address.
 */
export function normaliseServerAddress(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  value = value.replace(/\/+$/, '').replace(/\/api$/i, '');

  const match = /^(https?):\/\/([^/:\s]+)(?::(\d{1,5}))?$/i.exec(value);
  if (!match) return null;
  const [, scheme, host, port] = match;
  const finalPort = port ?? (scheme.toLowerCase() === 'http' ? String(DEFAULT_PORT) : undefined);
  return `${scheme.toLowerCase()}://${host}${finalPort ? `:${finalPort}` : ''}`;
}

export type ConnectionTest =
  | { ok: true; ms: number; environment: string }
  | { ok: false; message: string };

type HealthResponse = { status: string; database: string; environment: string; serverTime: string };

type ServerContextValue = {
  /** False until the saved address has been read from storage. */
  ready: boolean;
  baseUrl: string;
  save: (address: string) => Promise<string>;
  test: (address: string) => Promise<ConnectionTest>;
};

const ServerContext = createContext<ServerContextValue | null>(null);

export async function testServer(address: string): Promise<ConnectionTest> {
  const root = normaliseServerAddress(address);
  if (!root) return { ok: false, message: 'That doesn\'t look like an address. Try 192.168.1.14 or 192.168.1.14:5080.' };

  const started = Date.now();
  try {
    const health = await request<HealthResponse>(root, 'HEALTH_CHECK', { timeoutMs: 5000 });
    return { ok: true, ms: Date.now() - started, environment: health.environment };
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) {
      return {
        ok: false,
        message: SERVER_LOCKED
          ? 'The server answered, but its database isn\'t reachable. Try again in a few minutes.'
          : 'The server answered, but its database isn\'t reachable. Check SQL Server on the laptop.',
      };
    }
    return { ok: false, message: e instanceof Error ? e.message : 'The server didn\'t answer.' };
  }
}

export function ServerProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let saved: string | null = null;
      if (!SERVER_LOCKED) {
        try {
          saved = await AsyncStorage.getItem(STORAGE_KEY);
        } catch {
          // Storage unavailable: fall back to the build's default.
        }
      }
      const initial = normaliseServerAddress(saved ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? '') ?? '';
      if (cancelled) return;
      setApiBaseUrl(initial);
      setBaseUrl(initial);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (address: string) => {
    if (SERVER_LOCKED) throw new Error('This app always uses its own server.');
    const root = normaliseServerAddress(address);
    if (!root) throw new Error('That doesn\'t look like an address.');
    await AsyncStorage.setItem(STORAGE_KEY, root);
    setApiBaseUrl(root);
    setBaseUrl(root);
    return root;
  }, []);

  const value = useMemo(() => ({ ready, baseUrl, save, test: testServer }), [ready, baseUrl, save]);
  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>;
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error('useServer must be used inside <ServerProvider>.');
  return ctx;
}
