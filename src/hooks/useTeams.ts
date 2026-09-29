import { useCallback } from 'react';

import { api } from '@/api/client';
import type { Team } from '@/api/types';
import { useQuery } from '@/hooks/useQuery';

/** A tournament's teams with their players, sorted by name on the server. */
export function useTeams(tournamentId: number, enabled = true) {
  const fetcher = useCallback(
    () => api.call<Team[]>('TEAM_LIST', { routeParams: { id: tournamentId } }),
    [tournamentId],
  );
  return useQuery(fetcher, { enabled });
}
