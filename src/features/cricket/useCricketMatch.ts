import { useCallback } from 'react';

import { api } from '@/api/client';
import type { CricketMatchState } from '@/api/types';
import { useQuery } from '@/hooks/useQuery';

// A cricket match's full state. Every scoring call answers with this same shape, so the console
// replaces it straight from the response (setData) — no second fetch per ball.

export function useCricketMatch(matchId: number, { pollMs }: { pollMs?: number } = {}) {
  const fetcher = useCallback(
    () => api.call<CricketMatchState>('CRICKET_MATCH_GET', { routeParams: { matchId } }),
    [matchId],
  );
  return useQuery(fetcher, { pollMs });
}
