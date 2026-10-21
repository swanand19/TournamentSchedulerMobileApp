import type { useRouter } from 'expo-router';

import type { MatchCard } from '@/api/types';

type Router = ReturnType<typeof useRouter>;

// Where tapping a match goes. Someone who can't score here (a player, say) watches it: the
// preview before the start, the live view after. Owners and scorers get set-up for one that hasn't
// started and the console otherwise (a read-only summary once it's over; "Watch" while someone
// else scores). A cricket match that's set up but not under way still reports NotStarted — its
// setup screen sees that and forwards to the console.

export function openMatch(router: Router, tournamentId: number, match: MatchCard, canScore: boolean) {
  const params = { id: String(tournamentId), matchId: String(match.id) };
  if (!canScore) {
    if (match.sport === 'Football') router.push({ pathname: '/tournament/[id]/football/[matchId]/watch', params });
    else router.push({ pathname: '/tournament/[id]/cricket/[matchId]/watch', params });
    return;
  }
  if (match.sport === 'Football') {
    if (match.status === 'NotStarted') router.push({ pathname: '/tournament/[id]/football/[matchId]/setup', params });
    else if (match.status === 'PenaltyShootout') router.push({ pathname: '/tournament/[id]/football/[matchId]/penalties', params });
    else router.push({ pathname: '/tournament/[id]/football/[matchId]/live', params });
    return;
  }
  if (match.status === 'NotStarted') router.push({ pathname: '/tournament/[id]/cricket/[matchId]/setup', params });
  else router.push({ pathname: '/tournament/[id]/cricket/[matchId]/live', params });
}
