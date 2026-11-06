import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { ClientUpdate } from '@/api/types';

// Whether this app version should or must update (HLD P-25). The server decides: AUTH_OPTIONS says
// where this version stands at start-up and whenever the app comes back to the front, and any call
// refused with 426 means an update became required meanwhile. The root layout covers the app with the
// update screen when it's required; Home shows a banner when one is only suggested, until dismissed
// for that version.

type State = { update: ClientUpdate | null; dismissed: string | null };

const DISMISSED_KEY = 'update.dismissedVersion';

let state: State = { update: null, dismissed: null };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

AsyncStorage.getItem(DISMISSED_KEY)
  .then((v) => set({ dismissed: v }))
  .catch(() => {});

export function setClientUpdate(update: ClientUpdate | null | undefined) {
  set({ update: update ?? null });
}

/** A call was refused with 426: required now, whatever start-up said. */
export function markUpdateRequired(message: string) {
  set({ update: { ...(state.update ?? { latestVersion: null, description: null, storeUrl: null }), status: 'Required', message } });
}

export function dismissSuggestion() {
  const version = state.update?.latestVersion ?? null;
  set({ dismissed: version });
  if (version) AsyncStorage.setItem(DISMISSED_KEY, version).catch(() => {});
}

export function useClientUpdate() {
  const snapshot = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
  const update = snapshot.update;
  return {
    update,
    required: update?.status === 'Required',
    /** A newer version the person hasn't dismissed yet. */
    suggested: update?.status === 'Suggested' && update.latestVersion !== snapshot.dismissed,
  };
}
