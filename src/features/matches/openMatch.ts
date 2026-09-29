import type { useRouter } from 'expo-router';

import type { MatchCard } from '@/api/types';

type Router = ReturnType<typeof useRouter>;

// Where tapping a match goes: set-up for one that hasn't started, the console otherwise (it shows
// a read-only summary once the match is over). A cricket match that's set up but not yet under
// way still reports NotStarted — its setup screen sees that and forwards to the console.

export function openMatch(router: Router, tournamentId: number, match: MatchCard) {
  const params = { id: String(tournamentId), matchId: String(match.id) };
  if (match.sport === 'Football') {
    if (match.status === 'NotStarted') router.push({ pathname: '/tournament/[id]/football/[matchId]/setup', params });
    else if (match.status === 'PenaltyShootout') router.push({ pathname: '/tournament/[id]/football/[matchId]/penalties', params });
    else router.push({ pathname: '/tournament/[id]/football/[matchId]/live', params });
    return;
  }
  if (match.status === 'NotStarted') router.push({ pathname: '/tournament/[id]/cricket/[matchId]/setup', params });
  else router.push({ pathname: '/tournament/[id]/cricket/[matchId]/live', params });
}
