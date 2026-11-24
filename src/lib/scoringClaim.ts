import { api } from '@/api/client';

// Opening a scoring screen claims the match when nobody is scoring it (SCORING_CLAIM, 2026-11-20):
// the first person in gets the buttons, anyone after sees who has it — instead of both getting the
// buttons until one of them records something. A match someone else holds is left alone (no
// request is sent just by opening). Done before the screen's first load, so that load already says
// who has it. Errors are ignored: the load that follows shows how things stand.

export async function claimScoring(sport: 'football' | 'cricket', matchId: number | string) {
  try {
    await api.call('SCORING_CLAIM', { routeParams: { sport, matchId }, body: {} });
  } catch {
    // A closed tournament, no network, a stranger's link: the screen's own load says so.
  }
}
