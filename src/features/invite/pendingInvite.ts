// Invite links (2026-11-23): "{web app}/join/{code}" opens the app (Android App Links) through app/+native-intent,
// which puts the code here and lands on Home. Signed in, the root layout opens app/invite/[code] at once; signed out,
// Stack.Protected shows sign-in (this SDK forgets the link it was given), so the code waits here and opens once
// sign-in or sign-up has finished. Only in memory: someone who closes the app halfway through signing up is not added.
import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

let pending: string | null = null;
const listeners = new Set<() => void>();

/** The code in a "/join/<code>" path or a whole link to it, or null for any other path. */
export function inviteCodeIn(path: string): string | null {
  const match = /(?:^|\/)join\/([A-Za-z0-9-]{4,20})\/?(?:[?#].*)?$/.exec(path);
  return match ? match[1].replace(/-/g, '').toUpperCase() : null;
}

export function setPendingInvite(code: string) {
  pending = code;
  listeners.forEach((l) => l());
}

function take(): string | null {
  const code = pending;
  pending = null;
  return code;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Opens a waiting invite as soon as someone is signed in. Used once, by the root layout. */
export function usePendingInvite(signedIn: boolean) {
  const code = useSyncExternalStore(subscribe, () => pending);
  useEffect(() => {
    if (!signedIn || !code) return;
    const next = take();
    if (next) router.push({ pathname: '/invite/[code]', params: { code: next } });
  }, [signedIn, code]);
}
