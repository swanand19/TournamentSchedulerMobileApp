import { useLocalSearchParams } from 'expo-router';
import { createContext, useCallback, useContext, type ReactNode } from 'react';

import { api } from '@/api/client';
import type { Tournament } from '@/api/types';
import { useQuery, type Query } from '@/hooks/useQuery';
import { SportThemeProvider } from '@/theme/SportTheme';
import type { Sport } from '@/theme/theme';

// The tournament every screen under tournament/[id] belongs to. Loaded once by the tournament's
// layout; the name and sport passed from the list are used until it arrives, so the first frame
// already has the right title and colours.

type TournamentContextValue = {
  id: number;
  name: string;
  sport: Sport;
  isStarted: boolean;
  query: Query<Tournament>;
};

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const params = useLocalSearchParams<{ id: string; name?: string; sport?: string }>();
  const id = Number(params.id);

  const fetcher = useCallback(() => api.call<Tournament>('TOURNAMENT_GET', { routeParams: { id } }), [id]);
  const query = useQuery(fetcher);

  const t = query.data;
  const sport: Sport = t?.sport ?? (params.sport === 'Cricket' ? 'Cricket' : 'Football');
  const value: TournamentContextValue = {
    id,
    name: t?.name ?? params.name ?? 'Tournament',
    sport,
    isStarted: t?.isStarted ?? false,
    query,
  };

  return (
    <TournamentContext.Provider value={value}>
      <SportThemeProvider sport={sport}>{children}</SportThemeProvider>
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used inside <TournamentProvider>.');
  return ctx;
}
