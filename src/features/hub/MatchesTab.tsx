import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import { api } from '@/api/client';
import type { KnockoutStage, MatchCard } from '@/api/types';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import HubPage, { StickyBand } from '@/features/hub/HubPage';
import { Champion } from '@/features/hub/TableTab';
import Skeleton from '@/components/Skeleton';
import { LiveMatchCard, MatchRow } from '@/features/matches/MatchCards';
import { openMatch } from '@/features/matches/openMatch';
import { phaseOf, type MatchPhase } from '@/features/matches/status';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { plural } from '@/lib/format';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

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
  const { type } = useTypography();
  const { access } = useTournament();
  const router = useRouter();
  const theme = useSportTheme();
  const [filter, setFilter] = useState<Filter>('all');

  const fetcher = useCallback(
    () => api.call<MatchCard[]>('TOURNAMENT_MATCHES', { routeParams: { id: tournamentId } }),
    [tournamentId],
  );
  // Only the visible tab polls (and listens to the live line); the others keep what they last loaded.
  const matches = useQuery(fetcher, { pollMs: active ? 10000 : undefined, live: active ? { kind: 'tournament', tournamentId } : null });

  // The champion is the server's word (the knockout stage's), asked for only once a knockout match is over.
  const knockoutOver = matches.data?.some((m) => m.stage === 'Knockout' && phaseOf(m) === 'completed') ?? false;
  const stageFetcher = useCallback(() => api.call<KnockoutStage>('KNOCKOUT_GET', { routeParams: { id: tournamentId } }), [tournamentId]);
  const stage = useQuery(stageFetcher, { enabled: knockoutOver, live: active && knockoutOver ? { kind: 'tournament', tournamentId } : null });

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
  const groups = [...new Set(shown.filter((m) => m.stage !== 'Knockout').map((m) => m.groupName))];
  // Declared before it's read: the knockout filter below runs at once, so a later declaration threw
  // ("Cannot access 'pinLive' before initialization") for any tournament with a knockout match.
  const pinLive = filter === 'all' || filter === 'live';
  const knockouts = shown.filter((m) => m.stage === 'Knockout' && !(pinLive && phaseOf(m) === 'live'));
  const count = (f: Filter) => (f === 'all' ? all.length : all.filter((m) => phaseOf(m) === f).length);

  const openKnockouts = () => router.push({ pathname: '/tournament/[id]/knockout', params: { id: String(tournamentId) } });
  // A knockout match still waiting for its teams can't be set up: the bracket says what it's waiting for.
  const open = (m: MatchCard) =>
    access.canScore && m.status === 'NotStarted' && (m.homeTeamId == null || m.awayTeamId == null)
      ? openKnockouts()
      : openMatch(router, tournamentId, m, access.canScore);

  return (
    // The filter is pinned under the tabs, like the Stats page's header: it stays in reach down a long
    // fixture list. It must be the first child (stickyIndex 0).
    <HubPage onRefresh={matches.refresh} refreshing={matches.refreshing} stickyIndex={0}>
      <StickyBand>
        {theme.mode === 'dark' ? (
          // Glass: one glass track with the counts beside the words.
          <SegmentedControl
            accessibilityLabel="Filter matches"
            segments={FILTERS.map((f) => ({ key: f.key, label: f.label, badge: count(f.key) }))}
            value={filter}
            onChange={setFilter}
          />
        ) : (
          <GestureScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => (
              <Chip key={f.key} label={f.label} count={count(f.key)} selected={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </GestureScrollView>
        )}
      </StickyBand>

      <ErrorBanner message={matches.error?.message} actionLabel="Try again" onAction={matches.refresh} />
      {knockoutOver && <Champion name={stage.data?.championName} />}

      {pinLive && live.map((m) => <LiveMatchCard key={`live-${m.id}`} match={m} onOpen={() => open(m)} canScore={access.canScore} />)}

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
              <MatchRow key={m.id} match={m} onOpen={() => open(m)} canScore={access.canScore} />
            ))}
          </View>
        );
      })}

      {knockouts.length > 0 && (
        <View style={{ gap: space.sm }}>
          <SectionHeader
            title="Knockouts"
            right={<Button label="Bracket" icon="tournament" size="sm" variant="ghost" onPress={openKnockouts} />}
          />
          {knockouts.map((m) => (
            <MatchRow key={m.id} match={m} onOpen={() => open(m)} canScore={access.canScore} />
          ))}
        </View>
      )}
    </HubPage>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm, paddingRight: space.lg },
});
