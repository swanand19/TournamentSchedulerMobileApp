import { Stack } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketStats, FootballStats } from '@/api/types';
import ErrorBanner from '@/components/ErrorBanner';
import PitchBackground from '@/components/PitchBackground';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import TabPager from '@/components/TabPager';
import HubPage from '@/features/hub/HubPage';
import MatchesTab from '@/features/hub/MatchesTab';
import PreStartHub from '@/features/hub/PreStartHub';
import { CricketStatsPage, FootballStatsPage } from '@/features/hub/StatsTab';
import { CricketTable, FootballTable } from '@/features/hub/TableTab';
import TeamsList from '@/features/teams/TeamsList';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { useSportTheme } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// A tournament's hub. Before kick-off it's the setup checklist; after, it's four peer pages —
// matches, table, stats, teams — under a tab bar that stays pinned while each page scrolls on its
// own. Tap a tab or swipe sideways to move between them.

type Tab = 'matches' | 'table' | 'stats' | 'teams';

// Module scope: the pager rebuilds its gesture when this array changes identity.
const PAGES: Tab[] = ['matches', 'table', 'stats', 'teams'];
const SEGMENTS: { key: Tab; label: string }[] = [
  { key: 'matches', label: 'Matches' },
  { key: 'table', label: 'Table' },
  { key: 'stats', label: 'Stats' },
  { key: 'teams', label: 'Teams' },
];

export default function TournamentHub() {
  const t = useTournament();
  const [refreshKey, setRefreshKey] = useState(0);
  const loaded = !!t.query.data;

  if (loaded && t.isStarted) return <StartedHub />;

  return (
    <Screen
      error={loaded ? null : t.query.error}
      onRetry={t.query.refresh}
      onRefresh={() => {
        t.query.refresh();
        setRefreshKey((k) => k + 1);
      }}
      refreshing={t.query.refreshing}
    >
      <SectionHeader
        eyebrow={`${t.sport} tournament`}
        title={t.name}
        large
        right={loaded ? <StatusChip label="Not started" tone="setup" onDark /> : undefined}
      />
      {!loaded ? t.query.loading ? <Skeleton rows={3} height={140} /> : null : <PreStartHub key={refreshKey} onStarted={t.query.reload} />}
    </Screen>
  );
}

function StartedHub() {
  const theme = useSportTheme();
  const { id, sport, name } = useTournament();
  const [tab, setTab] = useState<Tab>('matches');
  const [seen, setSeen] = useState<Set<Tab>>(() => new Set(['matches']));
  if (!seen.has(tab)) setSeen(new Set(seen).add(tab));

  // One fetch feeds both Table and Stats; it waits until one of them has been opened.
  const statsFetcher = useCallback(
    () =>
      sport === 'Cricket'
        ? api.call<CricketStats>('TOURNAMENT_CRICKET_STATS', { routeParams: { id } })
        : api.call<FootballStats>('TOURNAMENT_STATS', { routeParams: { id } }),
    [id, sport],
  );
  const stats = useQuery<FootballStats | CricketStats>(statsFetcher, { enabled: seen.has('table') || seen.has('stats') });
  const teams = useTeams(id, seen.has('teams'));

  const statsBody = (render: (s: FootballStats | CricketStats) => ReactNode) =>
    stats.data ? (
      render(stats.data)
    ) : (
      <HubPage onRefresh={stats.refresh} refreshing={stats.refreshing}>
        <ErrorBanner message={stats.error?.message} actionLabel="Try again" onAction={stats.refresh} />
        {!stats.error && <Skeleton rows={4} height={96} />}
      </HubPage>
    );

  const renderPage = (key: Tab, active: boolean) => {
    switch (key) {
      case 'matches':
        return <MatchesTab tournamentId={id} active={active} />;
      case 'table':
        return statsBody((s) => (
          <HubPage onRefresh={stats.refresh} refreshing={stats.refreshing}>
            {sport === 'Cricket' ? <CricketTable stats={s as CricketStats} /> : <FootballTable stats={s as FootballStats} />}
          </HubPage>
        ));
      case 'stats':
        return statsBody((s) =>
          sport === 'Cricket' ? (
            <CricketStatsPage stats={s as CricketStats} refreshing={stats.refreshing} onRefresh={stats.refresh} />
          ) : (
            <FootballStatsPage stats={s as FootballStats} refreshing={stats.refreshing} onRefresh={stats.refresh} />
          ),
        );
      case 'teams':
        return (
          <HubPage onRefresh={teams.refresh} refreshing={teams.refreshing}>
            {teams.data ? (
              <TeamsList tournamentId={id} teams={teams.data} editable={false} onChanged={teams.reload} />
            ) : (
              <Skeleton rows={4} />
            )}
          </HubPage>
        );
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: name }} />
      <PitchBackground theme={theme} />
      <View style={[styles.tabBar, { backgroundColor: theme.deck, borderBottomColor: theme.borderOnDark }]}>
        <SegmentedControl accessibilityLabel="Tournament sections" segments={SEGMENTS} value={tab} onChange={setTab} />
      </View>
      <TabPager pages={PAGES} value={tab} onChange={setTab} renderPage={renderPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
});
