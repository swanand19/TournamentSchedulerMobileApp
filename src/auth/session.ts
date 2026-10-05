import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import type { Account } from '@/api/types';

// The signed-in session: the token the server gave at sign-in, its (non-secret) id, and who it is.
//
// The token lives in the phone's keychain / keystore (expo-secure-store), not AsyncStorage. It only
// ever leaves the phone sealed inside a gateway request (gateway.ts). A session belongs to the
// server that issued it, so it is saved with that server's address and ignored on any other.
//
// client.ts clears it when the server answers 401 (signed out elsewhere, expired, blocked); the
// root layout then shows the sign-in screen, which says why.

export type Session = {
  server: string;
  token: string;
  sessionId: string;
  expiresAt: string;
  user: Account;
};

const KEY = 'session.v1';

// SecureStore has no web implementation; the web preview keeps it in AsyncStorage instead.
const storage =
  Platform.OS === 'web'
    ? { get: (k: string) => AsyncStorage.getItem(k), set: (k: string, v: string) => AsyncStorage.setItem(k, v), remove: (k: string) => AsyncStorage.removeItem(k) }
    : { get: (k: string) => SecureStore.getItemAsync(k), set: (k: string, v: string) => SecureStore.setItemAsync(k, v), remove: (k: string) => SecureStore.deleteItemAsync(k) };

type State = { loaded: boolean; session: Session | null; signedOutReason: string };

let state: State = { loaded: false, session: null, signedOutReason: '' };
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** Reads the saved session once at start-up. */
export async function loadSession() {
  if (state.loaded) return;
  let session: Session | null = null;
  try {
    const saved = await storage.get(KEY);
    const parsed = saved ? (JSON.parse(saved) as Session) : null;
    session = parsed && typeof parsed.token === 'string' ? parsed : null;
  } catch {
    // Unreadable: sign in again.
  }
  update({ loaded: true, session });
}

export function getSession(): Session | null {
  return state.session;
}

export async function saveSession(session: Session) {
  update({ session, signedOutReason: '' });
  try {
    await storage.set(KEY, JSON.stringify(session));
  } catch {
    // Not saved: signed in until the app restarts.
  }
}

/** Updates who is signed in (after a name change) without touching the token. */
export function updateSessionUser(user: Partial<Account>) {
  if (!state.session) return;
  saveSession({ ...state.session, user: { ...state.session.user, ...user } });
}

export function clearSession(reason = '') {
  update({ session: null, signedOutReason: reason });
  storage.remove(KEY).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The session for `server` (null when signed out, or signed in to a different server). */
export function sessionFor(server: string): Session | null {
  return state.session && state.session.server === server ? state.session : null;
}

/** Re-renders on sign-in, sign-out and 401s. */
export function useSessionState(): State {
  return useSyncExternalStore(subscribe, () => state);
}
