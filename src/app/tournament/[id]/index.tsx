import { Stack, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketStats, FootballStats } from '@/api/types';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import GlassTabBar, { type GlassTab } from '@/components/GlassTabBar';
import HeaderButton from '@/components/HeaderButton';
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
import { CricketSummaryPage, FootballSummaryPage } from '@/features/hub/SummaryTab';
import { CricketTable, FootballTable } from '@/features/hub/TableTab';
import TeamsList from '@/features/teams/TeamsList';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { dateRange } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// A tournament's hub. Before kick-off it's the setup checklist; after, it's five peer pages —
// matches, table, summary, stats, teams — under a tab bar that stays pinned while each page scrolls
// on its own. Tap a tab or swipe sideways to move between them.

type Tab = 'matches' | 'table' | 'summary' | 'stats' | 'teams';

// Module scope: the pager rebuilds its gesture when this array changes identity.
const PAGES: Tab[] = ['matches', 'table', 'summary', 'stats', 'teams'];
const SEGMENTS: GlassTab<Tab>[] = [
  { key: 'matches', label: 'Matches', icon: 'calendar-month-outline' },
  { key: 'table', label: 'Table', icon: 'format-list-numbered' },
  { key: 'summary', label: 'Summary', icon: 'chart-donut' },
  { key: 'stats', label: 'Stats', icon: 'chart-bar' },
  { key: 'teams', label: 'Teams', icon: 'account-group-outline' },
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
  const { type } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
  const { id, sport, name, access, closed, query } = useTournament();
  const action = useAction();
  const [promptDismissed, setPromptDismissed] = useState(false);
  const light = theme.mode === 'light';
  const dates = dateRange(query.data?.startDate, query.data?.endDate);

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

  // One fetch feeds Table, Summary and Stats; it waits until one of them has been opened.
  const statsFetcher = useCallback(
    () =>
      sport === 'Cricket'
        ? api.call<CricketStats>('TOURNAMENT_CRICKET_STATS', { routeParams: { id } })
        : api.call<FootballStats>('TOURNAMENT_STATS', { routeParams: { id } }),
    [id, sport],
  );
  const stats = useQuery<FootballStats | CricketStats>(statsFetcher, { enabled: seen.has('table') || seen.has('summary') || seen.has('stats') });
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
      case 'summary':
        return statsBody((s) =>
          sport === 'Cricket' ? (
            <CricketSummaryPage stats={s as CricketStats} refreshing={stats.refreshing} onRefresh={stats.refresh} />
          ) : (
            <FootballSummaryPage stats={s as FootballStats} refreshing={stats.refreshing} onRefresh={stats.refresh} />
          ),
        );
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
          // The name is the page's own big title below, so the bar stays empty.
          title: '',
          headerRight: () => (
            <View style={styles.headerRow}>
              <HeaderButton
                icon="tournament"
                label="Knockout stage"
                onPress={() => router.push({ pathname: '/tournament/[id]/knockout', params: { id: String(id) } })}
              />
              <HeaderButton
                icon="account-group-outline"
                label="People and settings"
                onPress={() => router.push({ pathname: '/tournament/[id]/people', params: { id: String(id) } })}
              />
            </View>
          ),
        }}
      />
      <View style={[styles.tabBar, light ? styles.lightTabBar : styles.glassTop]}>
        <View style={{ gap: 4, marginBottom: light ? space.sm : 0 }}>
          <Text style={[type.title, { color: theme.ink }]} accessibilityRole="header" numberOfLines={2}>
            {name}
          </Text>
          {!!dates && <Text style={[type.body, { color: theme.muted }]}>{dates}</Text>}
        </View>
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
        {/* Five words spread across the width, so they also fit a 360-wide phone. */}
        {light && (
          <SegmentedControl variant="tabs" accessibilityLabel="Tournament sections" segments={SEGMENTS} value={tab} onChange={setTab} style={styles.lightTabs} />
        )}
      </View>
      <TabPager pages={PAGES} value={tab} onChange={setTab} renderPage={renderPage} />
      {!light && <GlassTabBar accessibilityLabel="Tournament sections" tabs={SEGMENTS} value={tab} onChange={setTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: { paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, gap: space.sm },
  lightTabBar: { paddingBottom: 0, borderBottomWidth: 0 },
  lightTabs: { justifyContent: 'space-between', gap: space.md },
  glassTop: { borderBottomWidth: 0, paddingTop: 0, paddingHorizontal: space.lg + 4 },
  headerRow: { flexDirection: 'row', gap: space.sm },
  prompt: { borderWidth: 1, borderRadius: radius.xl, borderCurve: 'continuous', padding: space.md, gap: space.sm },
  promptRow: { flexDirection: 'row', gap: space.sm },
});
