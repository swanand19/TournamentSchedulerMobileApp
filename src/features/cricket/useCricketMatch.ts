import { useCallback, useRef } from 'react';

import { api } from '@/api/client';
import type { CricketMatchState } from '@/api/types';
import { useQuery } from '@/hooks/useQuery';
import { claimScoring } from '@/lib/scoringClaim';

// A cricket match's full state. Every scoring call answers with this same shape, so the console
// replaces it straight from the response (setData) — no second fetch per ball.

/** `claim`: a scoring screen — take the match first if nobody is scoring it (lib/scoringClaim). */
export function useCricketMatch(matchId: number, { pollMs, claim }: { pollMs?: number; claim?: boolean } = {}) {
  const claimed = useRef(!claim);
  const fetcher = useCallback(async () => {
    if (!claimed.current) {
      claimed.current = true;
      await claimScoring('cricket', matchId);
    }
    return api.call<CricketMatchState>('CRICKET_MATCH_GET', { routeParams: { matchId } });
  }, [matchId]);
  // A polled screen is a live one: it also reloads the moment the live line says the match changed.
  return useQuery(fetcher, { pollMs, live: pollMs ? { kind: 'match', sport: 'cricket', matchId } : null });
}
