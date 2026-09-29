import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import { api } from '@/api/client';
import type { MatchCard } from '@/api/types';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import SectionHeader from '@/components/SectionHeader';
import HubPage from '@/features/hub/HubPage';
import Skeleton from '@/components/Skeleton';
import { LiveMatchCard, MatchRow } from '@/features/matches/MatchCards';
import { openMatch } from '@/features/matches/openMatch';
import { phaseOf, type MatchPhase } from '@/features/matches/status';
import { useQuery } from '@/hooks/useQuery';
import { plural } from '@/lib/format';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// Every fixture, live first. Polled while the tab is open so a match being scored on another
// phone moves on this one too.

type Filter = 'all' | MatchPhase;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

export default function MatchesTab({ tournamentId, active }: { tournamentId: number; active: boolean }) {
  const router = useRouter();
  const theme = useSportTheme();
  const [filter, setFilter] = useState<Filter>('all');

  const fetcher = useCallback(
    () => api.call<MatchCard[]>('TOURNAMENT_MATCHES', { routeParams: { id: tournamentId } }),
    [tournamentId],
  );
  // Only the visible tab polls; the others keep what they last loaded.
  const matches = useQuery(fetcher, { pollMs: active ? 10000 : undefined });

  if (matches.loading) return <HubPage><Skeleton rows={4} height={120} /></HubPage>;
  if (!matches.data) {
    return (
      <HubPage onRefresh={matches.refresh} refreshing={matches.refreshing}>
        <ErrorBanner message={matches.error?.message} actionLabel="Try again" onAction={matches.refresh} />
      </HubPage>
    );
  }

  const all = matches.data;
  const live = all.filter((m) => phaseOf(m) === 'live');
  const shown = filter === 'all' ? all : all.filter((m) => phaseOf(m) === filter);
  const groups = [...new Set(shown.map((m) => m.groupName))];
  const pinLive = filter === 'all' || filter === 'live';

  const open = (m: MatchCard) => openMatch(router, tournamentId, m);

  return (
    <HubPage onRefresh={matches.refresh} refreshing={matches.refreshing}>
      <ErrorBanner message={matches.error?.message} actionLabel="Try again" onAction={matches.refresh} />

      <GestureScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            count={f.key === 'all' ? all.length : all.filter((m) => phaseOf(m) === f.key).length}
            selected={filter === f.key}
            onPress={() => setFilter(f.key)}
          />
        ))}
      </GestureScrollView>

      {pinLive && live.map((m) => <LiveMatchCard key={`live-${m.id}`} match={m} onOpen={() => open(m)} />)}

      {shown.length === 0 && (
        <EmptyState
          icon="calendar-blank"
          title="Nothing here"
          message={filter === 'live' ? 'No match is being played right now.' : 'No matches match this filter.'}
        />
      )}

      {groups.map((g) => {
        // Live matches are already pinned above as big cards; don't list them twice.
        const inGroup = shown.filter((m) => m.groupName === g && !(pinLive && phaseOf(m) === 'live'));
        if (inGroup.length === 0) return null;
        return (
          <View key={g} style={{ gap: space.sm }}>
            <SectionHeader
              title={`Group ${g}`}
              right={<Text style={[type.caption, { color: theme.onDarkSoft }]}>{plural(inGroup.length, 'match', 'matches')}</Text>}
            />
            {inGroup.map((m) => (
              <MatchRow key={m.id} match={m} onOpen={() => open(m)} />
            ))}
          </View>
        );
      })}
    </HubPage>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm, paddingRight: space.lg },
});
