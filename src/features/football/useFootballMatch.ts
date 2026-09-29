import { useCallback } from 'react';

import { api } from '@/api/client';
import type { FootballMatch, MatchEvent, Player } from '@/api/types';
import { useQuery } from '@/hooks/useQuery';

// A football match and its timeline, fetched together so the scoreboard and the event list can't
// disagree. Football's action endpoints answer with small payloads, so after every action the
// console reloads this — and polls it, so a second phone watching the same match keeps up.

export type FootballMatchData = { match: FootballMatch; events: MatchEvent[] };

export function useFootballMatch(matchId: number, { pollMs }: { pollMs?: number } = {}) {
  const fetcher = useCallback(async (): Promise<FootballMatchData> => {
    const [match, events] = await Promise.all([
      api.call<FootballMatch>('MATCH_GET', { routeParams: { matchId } }),
      api.call<MatchEvent[]>('MATCH_EVENTS', { routeParams: { matchId } }),
    ]);
    return { match, events };
  }, [matchId]);
  return useQuery(fetcher, { pollMs });
}

/** Every player on either side, by id — events carry ids, the timeline shows names. */
export function playerIndex(match: FootballMatch): Map<number, Player> {
  const map = new Map<number, Player>();
  for (const p of [...(match.homeTeam?.players ?? []), ...(match.awayTeam?.players ?? [])]) map.set(p.id, p);
  return map;
}

export function playerLabel(p: Player | undefined): string {
  if (!p) return 'Unknown';
  return p.jerseyNumber != null ? `#${p.jerseyNumber} ${p.name}` : p.name;
}
