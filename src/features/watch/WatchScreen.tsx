import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERVER_ACTION_LABEL } from '@/config/server';
import { api } from '@/api/client';
import { NetworkError } from '@/api/errors';
import type { CricketMatchAwards, CricketScorecard, Scoring, WatchMatch } from '@/api/types';
import Button from '@/components/Button';
import { Deck } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon, { type IconName } from '@/components/Icon';
import ScoringBanner from '@/components/ScoringBanner';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import TabPager from '@/components/TabPager';
import UnderlineTabs from '@/components/UnderlineTabs';
import { CreaseCard, CricketScoreboard, DlsStrip, OverStrip } from '@/features/cricket/ConsoleParts';
import MatchAwards from '@/features/cricket/MatchAwards';
import ScorecardBody from '@/features/cricket/ScorecardBody';
import { useCricketMatch } from '@/features/cricket/useCricketMatch';
import Scoreboard from '@/features/football/Scoreboard';
import { useFootballMatch } from '@/features/football/useFootballMatch';
import ActivityFeed from '@/features/watch/ActivityFeed';
import SideCard from '@/features/watch/SideCard';
import { useActivity } from '@/features/watch/useActivity';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// Watching a match (Round 2) — for everyone who can't score it, and for owners and scorers who
// chose "Watch" while someone else scores. Before the start: a preview with both squads (the XIs
// and the toss once a cricket match is set up). Once under way: the Live page (the scoreboard and
// the match activity) and, a swipe away, the Scorecard and Playing XI (cricket) or the Line-ups
// (football). Nothing here changes the match; it all polls, so it follows the scorer within a few seconds.

type Sport = 'football' | 'cricket';
type Page = 'live' | 'scorecard' | 'sides';

// Module scope: the pager rebuilds its gesture when this array changes identity.
const CRICKET_PAGES: Page[] = ['live', 'scorecard', 'sides'];
const FOOTBALL_PAGES: Page[] = ['live', 'sides'];

export default function WatchScreen({ sport }: { sport: Sport }) {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const id = Number(matchId);
  const fetcher = useCallback(() => api.call<WatchMatch>('WATCH_MATCH', { routeParams: { sport, matchId: id } }), [sport, id]);
  // Slow poll: the sides rarely change, but a preview has to notice when play starts.
  const watch = useQuery(fetcher, { pollMs: 10000, live: { kind: 'match', sport, matchId: id } });
  const w = watch.data;

  const title = !w ? '' : w.phase === 'Preview' ? 'Match preview' : w.phase === 'Finished' ? 'Result' : 'Live';
  const header = <Stack.Screen options={{ title }} />;

  if (!w) {
    return (
      <>
        {header}
        <Screen error={watch.error} onRetry={watch.refresh}>
          {watch.loading && <Skeleton rows={3} height={140} />}
        </Screen>
      </>
    );
  }

  if (w.phase === 'Preview') {
    return (
      <>
        {header}
        <Screen onRefresh={watch.refresh} refreshing={watch.refreshing} error={watch.error} onRetry={watch.refresh}>
          <PreviewBoard w={w} />
          <SideCard side={w.home} sport={sport} />
          <SideCard side={w.away} sport={sport} />
        </Screen>
      </>
    );
  }

  return (
    <>
      {header}
      <Viewer w={w} sport={sport} matchId={id} onRefreshSides={watch.refresh} sidesError={watch.error} onChangeServer={() => router.push('/server')} />
    </>
  );
}

function PreviewBoard({ w }: { w: WatchMatch }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return (
    <Deck>
      <View style={styles.boardTop}>
        <Text style={[type.eyebrow, { color: theme.accent, flex: 1 }]} numberOfLines={2}>
          {w.tournamentName} · {w.roundLabel ?? `Group ${w.groupName}`} · Match {w.matchNumber}
        </Text>
        <StatusChip label="Not started" tone="setup" onDark />
      </View>
      <Text style={[type.title, { color: theme.onDark }]} accessibilityRole="header">
        {w.home.name} <Text style={{ color: theme.mode === 'light' ? theme.muted : theme.accent }}>{'v'}</Text> {w.away.name}
      </Text>
      {w.formatLine ? <Line icon="timer-outline" text={w.formatLine} /> : null}
      {w.tossLine ? <Line icon="circle-half-full" text={w.tossLine} strong /> : null}
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>
        {w.sport === 'Cricket' ? 'The live score opens here with the first ball.' : 'The live score opens here at kick-off.'}
      </Text>
    </Deck>
  );
}

function Line({ icon, text, strong }: { icon: IconName; text: string; strong?: boolean }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return (
    <View style={styles.line}>
      <Icon name={icon} size={18} color={theme.accent} />
      <Text style={[strong ? type.bodyStrong : type.body, { color: theme.onDark, flex: 1 }]}>{text}</Text>
    </View>
  );
}

function Viewer({
  w,
  sport,
  matchId,
  onRefreshSides,
  sidesError,
  onChangeServer,
}: {
  w: WatchMatch;
  sport: Sport;
  matchId: number;
  onRefreshSides: () => Promise<void>;
  sidesError: Error | null;
  onChangeServer: () => void;
}) {
  const [page, setPage] = useState<Page>('live');
  const live = { key: 'live' as const, label: w.phase === 'Finished' ? 'Match' : 'Live' };
  const tabs: { key: Page; label: string }[] =
    sport === 'cricket'
      ? [live, { key: 'scorecard', label: 'Scorecard' }, { key: 'sides', label: 'Playing XI' }]
      : [live, { key: 'sides', label: 'Line-ups' }];

  const renderPage = (key: Page) => {
    if (key === 'live') return sport === 'cricket' ? <CricketLive matchId={matchId} w={w} /> : <FootballLive matchId={matchId} w={w} />;
    if (key === 'scorecard') return <ScorecardPage matchId={matchId} />;
    return (
      <PageScroll refreshing={false} onRefresh={onRefreshSides}>
        <ErrorBanner
          message={sidesError?.message}
          actionLabel={sidesError instanceof NetworkError ? SERVER_ACTION_LABEL : 'Try again'}
          onAction={sidesError instanceof NetworkError ? onChangeServer : onRefreshSides}
        />
        <SideCard side={w.home} sport={sport} />
        <SideCard side={w.away} sport={sport} />
      </PageScroll>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <UnderlineTabs tabs={tabs} value={page} onChange={setPage} />
      <TabPager pages={sport === 'cricket' ? CRICKET_PAGES : FOOTBALL_PAGES} value={page} onChange={setPage} renderPage={renderPage} />
    </View>
  );
}

function PageScroll({ children, refreshing, onRefresh }: { children: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.deep]} />}
    >
      {children}
    </ScrollView>
  );
}

/** For owners and scorers only: who is scoring, and the way back to the scoring screen when it's free. */
function WatchStrip({ sport, matchId, scoring, over, onChanged }: { sport: Sport; matchId: number; scoring: Scoring | null | undefined; over: boolean; onChanged: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
  const { id: tournamentId, access } = useTournament();
  if (!access.canScore || over || !scoring) return null;

  if (scoring.canScore) {
    const params = { id: String(tournamentId), matchId: String(matchId) };
    const open = () =>
      sport === 'cricket'
        ? router.replace({ pathname: '/tournament/[id]/cricket/[matchId]/live', params })
        : router.replace({ pathname: '/tournament/[id]/football/[matchId]/live', params });
    return (
      <View style={[styles.strip, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
        <Text style={[type.bodyStrong, { color: theme.onDark, flex: 1 }]}>
          {scoring.isActiveScorer ? 'You are scoring this match.' : 'Nobody is scoring this match right now.'}
        </Text>
        <Button label="Open scoring" icon="scoreboard-outline" size="sm" onPress={open} />
      </View>
    );
  }
  return <ScoringBanner sport={sport} matchId={matchId} scoring={scoring} onChanged={onChanged} watching />;
}

function ActivitySection({ sport, matchId }: { sport: Sport; matchId: number }) {
  const activity = useActivity(sport, matchId, { pollMs: 5000 });
  return (
    <View style={{ gap: space.md }}>
      <SectionHeader eyebrow="Newest first" title={sport === 'cricket' ? 'Ball by ball' : 'Match activity'} />
      <ErrorBanner message={activity.data ? undefined : activity.error?.message} actionLabel="Try again" onAction={activity.refresh} />
      {activity.data ? (
        <ActivityFeed
          items={activity.items}
          sport={sport}
          hasMore={activity.hasMore}
          loadingMore={activity.loadingMore}
          moreError={activity.moreError}
          onLoadMore={activity.loadMore}
        />
      ) : activity.loading ? (
        <Skeleton rows={4} height={48} />
      ) : null}
    </View>
  );
}

function CricketLive({ matchId, w }: { matchId: number; w: WatchMatch }) {
  const match = useCricketMatch(matchId, { pollMs: 5000 });
  const finished = w.phase === 'Finished';
  const awardsFetcher = useCallback(() => api.call<CricketMatchAwards>('CRICKET_AWARDS', { routeParams: { matchId } }), [matchId]);
  const awards = useQuery(awardsFetcher, { enabled: finished });
  const state = match.data;
  const live = state?.current ?? null;

  return (
    <PageScroll refreshing={match.refreshing} onRefresh={match.refresh}>
      <ErrorBanner message={match.error?.message} actionLabel="Try again" onAction={match.refresh} />
      <WatchStrip sport="cricket" matchId={matchId} scoring={state?.scoring} over={finished} onChanged={match.reload} />
      {state ? <CricketScoreboard state={state} /> : <Skeleton rows={1} height={160} />}
      {live && <CreaseCard live={live} />}
      {live && state && <OverStrip key={live.inningsNumber} live={live} ballsPerOver={state.rules.ballsPerOver} />}
      {state && <DlsStrip state={state} />}
      {finished && awards.data && <MatchAwards awards={awards.data} />}
      <ActivitySection sport="cricket" matchId={matchId} />
    </PageScroll>
  );
}

function FootballLive({ matchId, w }: { matchId: number; w: WatchMatch }) {
  const data = useFootballMatch(matchId, { pollMs: 5000 });
  const m = data.data;
  return (
    <PageScroll refreshing={data.refreshing} onRefresh={data.refresh}>
      <ErrorBanner message={data.error?.message} actionLabel="Try again" onAction={data.refresh} />
      <WatchStrip sport="football" matchId={matchId} scoring={m?.match.scoring} over={w.phase === 'Finished'} onChanged={data.reload} />
      {m ? <Scoreboard match={m.match} events={m.events} /> : <Skeleton rows={1} height={180} />}
      <ActivitySection sport="football" matchId={matchId} />
    </PageScroll>
  );
}

function ScorecardPage({ matchId }: { matchId: number }) {
  const fetcher = useCallback(() => api.call<CricketScorecard>('CRICKET_SCORECARD', { routeParams: { matchId } }), [matchId]);
  const card = useQuery(fetcher, { pollMs: 15000, live: { kind: 'match', sport: 'cricket', matchId } });
  return (
    <PageScroll refreshing={card.refreshing} onRefresh={card.refresh}>
      <ErrorBanner message={card.error?.message} actionLabel="Try again" onAction={card.refresh} />
      {card.data ? <ScorecardBody card={card.data} /> : card.loading ? <Skeleton rows={4} /> : null}
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  boardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  strip: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
});
