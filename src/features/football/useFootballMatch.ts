import { useCallback, useRef } from 'react';

import { api } from '@/api/client';
import type { FootballMatch, MatchEvent, Player } from '@/api/types';
import { useQuery } from '@/hooks/useQuery';
import { claimScoring } from '@/lib/scoringClaim';

// A football match and its timeline, fetched together so the scoreboard and the event list can't
// disagree. Football's action endpoints answer with small payloads, so after every action the
// console reloads this — and polls it, so a second phone watching the same match keeps up.

export type FootballMatchData = { match: FootballMatch; events: MatchEvent[] };

/** `claim`: a scoring screen — take the match first if nobody is scoring it (lib/scoringClaim). */
export function useFootballMatch(matchId: number, { pollMs, claim }: { pollMs?: number; claim?: boolean } = {}) {
  const claimed = useRef(!claim);
  const fetcher = useCallback(async (): Promise<FootballMatchData> => {
    if (!claimed.current) {
      claimed.current = true;
      await claimScoring('football', matchId);
    }
    const [match, events] = await Promise.all([
      api.call<FootballMatch>('MATCH_GET', { routeParams: { matchId } }),
      api.call<MatchEvent[]>('MATCH_EVENTS', { routeParams: { matchId } }),
    ]);
    return { match, events };
  }, [matchId]);
  // A polled screen is a live one: it also reloads the moment the live line says the match changed.
  return useQuery(fetcher, { pollMs, live: pollMs ? { kind: 'match', sport: 'football', matchId } : null });
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
