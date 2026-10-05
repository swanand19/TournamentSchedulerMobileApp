import { Stack, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketStats, FootballStats } from '@/api/types';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PitchBackground from '@/components/PitchBackground';
import PressableScale from '@/components/PressableScale';
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
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type } from '@/theme/theme';

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
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const loaded = !!t.query.data;

  if (loaded && t.isStarted) return <StartedHub />;

  const status = t.query.data?.status;
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
        right={loaded ? <StatusChip label={status === 'Cancelled' ? 'Cancelled' : 'Not started'} tone="setup" onDark /> : undefined}
      />
      {loaded && (
        <Button
          label="People & settings"
          icon="account-group-outline"
          variant="ghost"
          onPress={() => router.push({ pathname: '/tournament/[id]/people', params: { id: String(t.id) } })}
        />
      )}
      {!loaded ? (
        t.query.loading ? <Skeleton rows={3} height={140} /> : null
      ) : t.access.canEdit ? (
        <PreStartHub key={refreshKey} onStarted={t.query.reload} />
      ) : (
        // Groups and fixtures are the owners' to build; scorers and players wait for kick-off.
        <EmptyState
          icon="timer-sand"
          title={status === 'Cancelled' ? 'This tournament was cancelled' : 'Not started yet'}
          message={
            status === 'Cancelled'
              ? 'It never started and its dates have passed.'
              : `The owners are still setting up its teams and fixtures. Once they start it, its matches appear here${t.access.canScore ? ' and you can score them' : ' to follow'}.`
          }
          actionLabel="See the teams"
          onAction={() => router.push({ pathname: '/tournament/[id]/teams', params: { id: String(t.id) } })}
        />
      )}
    </Screen>
  );
}

function StartedHub() {
  const theme = useSportTheme();
  const router = useRouter();
  const { id, sport, name, access, closed, query } = useTournament();
  const action = useAction();
  const [promptDismissed, setPromptDismissed] = useState(false);

  // Asked once, when the last match finishes.
  const completeNow = async () => {
    const ok = await confirm({
      title: 'Mark the tournament complete?',
      message: "Nothing can be started or changed afterwards. This can't be undone.",
      confirmLabel: 'Mark complete',
    });
    if (!ok) return;
    const res = await action.run(() => api.call('TOURNAMENT_COMPLETE', { routeParams: { id }, body: {} }));
    if (res.ok) {
      haptic.success();
      query.reload();
    }
  };
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
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <PressableScale
              onPress={() => router.push({ pathname: '/tournament/[id]/people', params: { id: String(id) } })}
              accessibilityLabel="People and settings"
              style={styles.headerBtn}
            >
              <Icon name="account-group-outline" size={24} color={theme.accent} />
            </PressableScale>
          ),
        }}
      />
      <PitchBackground theme={theme} />
      <View style={[styles.tabBar, { backgroundColor: theme.deck, borderBottomColor: theme.borderOnDark }]}>
        {closed && (
          <Text style={[type.caption, { color: theme.onDarkSoft, paddingVertical: space.xs }]}>
            {query.data?.status === 'Completed'
              ? 'Completed — results and stats stay here; nothing more can be played or changed.'
              : 'Cancelled — it never started and its dates have passed.'}
          </Text>
        )}
        {access.allMatchesPlayed && access.canComplete && !promptDismissed && (
          <View style={[styles.prompt, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]} accessibilityRole="alert">
            <ErrorBanner message={action.error?.message} />
            <Text style={[type.bodyStrong, { color: theme.onDark }]}>All matches played. Mark the tournament complete?</Text>
            <View style={styles.promptRow}>
              <Button label="Mark complete" icon="flag-checkered" size="sm" busy={action.busy} onPress={completeNow} style={{ flex: 1 }} />
              <Button label="Not yet" size="sm" variant="ghost" onPress={() => setPromptDismissed(true)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
        <SegmentedControl accessibilityLabel="Tournament sections" segments={SEGMENTS} value={tab} onChange={setTab} />
      </View>
      <TabPager pages={PAGES} value={tab} onChange={setTab} renderPage={renderPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, gap: space.sm },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  prompt: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  promptRow: { flexDirection: 'row', gap: space.sm },
});
