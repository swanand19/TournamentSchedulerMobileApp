import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { ThemeMode } from '@/theme/theme';

// Dark (the Liquid Glass theme) or light, as chosen on the profile. Kept on this phone only: it
// survives restarts, goes with the app when it is uninstalled, and is forgotten when the person
// signs out (Account → Sign out, Sign out on all devices, Delete account), so the next person to
// sign in on the phone starts from the default. A session that simply expires keeps it.

const KEY = 'appearance.mode';

type State = { loaded: boolean; mode: ThemeMode };

let state: State = { loaded: false, mode: 'dark' };
const listeners = new Set<() => void>();

function update(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** Read once at start-up, before the splash screen lifts, so the first screen is already right. */
export async function loadAppearance() {
  if (state.loaded) return;
  let mode: ThemeMode = 'dark';
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch {
    // Unreadable: the default.
  }
  update({ loaded: true, mode });
}

export function setThemeMode(mode: ThemeMode) {
  update({ mode });
  AsyncStorage.setItem(KEY, mode).catch(() => {});
}

type Switcher = (mode: ThemeMode) => Promise<void>;
let switcher: Switcher | null = null;

/** The root layout's crossfade (ThemeTransition) registers here; returns the unregister. */
export function registerThemeSwitcher(fn: Switcher) {
  switcher = fn;
  return () => {
    if (switcher === fn) switcher = null;
  };
}

/** The person's own choice on the profile: crossfades from the old look to the new one. */
export function switchThemeMode(mode: ThemeMode) {
  if (mode === state.mode) return;
  if (!switcher) return setThemeMode(mode);
  switcher(mode).catch(() => setThemeMode(mode));
}

/** Back to the default when the person signs out. */
export function resetAppearance() {
  update({ mode: 'dark' });
  AsyncStorage.removeItem(KEY).catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppearance(): State {
  return useSyncExternalStore(subscribe, () => state);
}

export function useThemeMode(): ThemeMode {
  return useAppearance().mode;
}
