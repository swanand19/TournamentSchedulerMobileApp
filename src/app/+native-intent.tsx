// Every link the system hands the app comes through here first (Expo Router). An invite link (2026-11-23,
// "{web app}/join/{code}") is kept by features/invite/pendingInvite and the app lands on Home: the root layout opens
// the join once someone is signed in, which may be after a sign-up. Anything else goes where it pointed.
import { inviteCodeIn, setPendingInvite } from '@/features/invite/pendingInvite';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const code = inviteCodeIn(path);
    if (code) {
      setPendingInvite(code);
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
