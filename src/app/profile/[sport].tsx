import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { NetworkError } from '@/api/errors';
import type { Career, StatGroup } from '@/api/types';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import type { IconName } from '@/components/Icon';
import Wallpaper from '@/components/Wallpaper';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import TabPager from '@/components/TabPager';
import {
  HeroStat,
  HonourBand,
  HonourRow,
  ShootoutTile,
  StatTile,
  TeamRow,
  TournamentRow,
  UnderlineTabs,
} from '@/features/profile/ProfileParts';
import { useQuery } from '@/hooks/useQuery';
import { dateRange, shortDate } from '@/lib/format';
import { SportThemeProvider, useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// A sport profile: Stats (cricket splits it into batting, bowling and fielding), Teams,
// Tournaments and Honours, as swipeable peers. Everything is the server's: the figures arrive
// worded, completed matches only. A team or tournament row opens only when the server says the
// viewer may see that tournament (`canOpen`: they own, score or play in it).

type Tab = 'stats' | 'teams' | 'tournaments' | 'honours';

// Module scope: the pager rebuilds its gesture when this array changes identity.
const PAGES: Tab[] = ['stats', 'teams', 'tournaments', 'honours'];
const TABS: { key: Tab; label: string }[] = [
  { key: 'stats', label: 'Stats' },
  { key: 'teams', label: 'Teams' },
  { key: 'tournaments', label: 'Tournaments' },
  { key: 'honours', label: 'Honours' },
];

/** The figure that leads each stat group, and the faint picture behind it. */
const HERO: Record<string, { key: string; icon: IconName }> = {
  overview: { key: 'goals', icon: 'soccer' },
  batting: { key: 'runs', icon: 'cricket' },
  bowling: { key: 'wickets', icon: 'bullseye' },
  fielding: { key: 'catches', icon: 'hand-back-right-outline' },
};

export default function CareerScreen() {
  const { sport, userId, playerId } = useLocalSearchParams<{ sport: string; userId?: string; playerId?: string }>();
  return (
    <SportThemeProvider sport={sport}>
      <CareerView sport={sport} userId={userId} playerId={playerId} />
    </SportThemeProvider>
  );
}

function CareerView({ sport, userId, playerId }: { sport: string; userId?: string; playerId?: string }) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const fetcher = useCallback(() => api.call<Career>('PROFILE_CAREER', { query: { sport, userId, playerId } }), [sport, userId, playerId]);
  const career = useQuery(fetcher);
  const [tab, setTab] = useState<Tab>('stats');
  const c = career.data;

  const openTournament = (id: number, name: string) =>
    router.push({ pathname: '/tournament/[id]', params: { id: String(id), name, sport: theme.key } });

  const renderPage = (key: Tab) => {
    if (!c) return null;
    const refresh = { refreshing: career.refreshing, onRefresh: career.refresh };
    if (key === 'stats') return <StatsPage career={c} {...refresh} onJoin={() => router.push('/join')} />;
    if (key === 'teams')
      return (
        <Page {...refresh}>
          {c.teams.length === 0 ? (
            <EmptyState icon="tshirt-crew-outline" title="No teams yet" message={c.isMe ? `Teams you play ${theme.label.toLowerCase()} for appear here.` : `${c.name} isn't in a ${theme.label.toLowerCase()} team yet.`} />
          ) : (
            c.teams.map((t) => (
              <TeamRow key={t.teamId} team={t} onPress={t.canOpen ? () => openTournament(t.tournamentId, t.tournamentName) : undefined} />
            ))
          )}
          {c.teams.some((t) => t.canOpen) ? <Text style={[type.caption, styles.note, { color: theme.onDarkSoft }]}>Open a team to see its tournament.</Text> : null}
        </Page>
      );
    if (key === 'tournaments')
      return (
        <Page {...refresh}>
          {c.tournaments.length === 0 ? (
            <EmptyState icon="trophy-outline" title="No tournaments yet" message={`${theme.label} tournaments ${c.isMe ? 'you play in' : `${c.name} plays in`} appear here.`} />
          ) : (
            c.tournaments.map((t) => (
              <TournamentRow key={t.tournamentId} item={t} dates={dateRange(t.startDate, t.endDate)} onPress={t.canOpen ? () => openTournament(t.tournamentId, t.name) : undefined} />
            ))
          )}
        </Page>
      );
    return (
      <Page {...refresh}>
        <HonourBand stats={c.honourStats} />
        {c.honours.length === 0 ? (
          <EmptyState
            icon="trophy-outline"
            title="No honours yet"
            message={theme.key === 'Cricket' ? 'Player of the match awards and tournament MVPs appear here.' : 'Titles go to the top scorer and top assister when a tournament is completed.'}
          />
        ) : (
          c.honours.map((h, i) => (
            <HonourRow
              key={`${h.kind}-${h.tournamentId}-${h.matchId ?? i}`}
              honour={h}
              when={h.matchId ? [h.tournamentName, shortDate(h.date)].filter(Boolean).join(' · ') : h.date ? `Completed ${shortDate(h.date)}` : ''}
            />
          ))
        )}
        {theme.key === 'Football' && c.honours.length > 0 ? (
          <Text style={[type.caption, styles.note, { color: theme.onDarkSoft }]}>Titles are awarded when a tournament is completed.</Text>
        ) : null}
      </Page>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          // Glass: the sport is the small line over the name, so the bar stays empty.
          title: theme.mode === 'light' ? theme.label : '',
          headerStyle: { backgroundColor: theme.mode === 'light' ? theme.deck : 'transparent' },
          headerTintColor: theme.mode === 'light' ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: theme.mode === 'light' ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          contentStyle: { backgroundColor: theme.page },
        }}
      />
      <Wallpaper underHeader />
      <View style={[styles.who, { backgroundColor: theme.mode === 'light' ? theme.deck : 'transparent' }]}>
        {theme.mode === 'dark' && <Text style={[type.eyebrow, { color: theme.onDarkSoft }]}>{theme.label}</Text>}
        <Text style={[styles.name, { color: theme.onDark }]} numberOfLines={1} accessibilityRole="header">
          {c ? c.name : ' '}
        </Text>
      </View>
      <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} />

      {career.error && !c ? (
        <View style={{ padding: space.lg }}>
          <ErrorBanner
            message={career.error.message}
            actionLabel={career.error instanceof NetworkError ? 'Change server' : 'Try again'}
            onAction={career.error instanceof NetworkError ? () => router.push('/server') : career.refresh}
          />
        </View>
      ) : null}
      {!c && !career.error ? (
        <View style={{ padding: space.lg }}>
          <Skeleton rows={3} height={110} />
        </View>
      ) : null}
      {c ? <TabPager pages={PAGES} value={tab} onChange={setTab} renderPage={renderPage} /> : null}
    </View>
  );
}

function Page({ children, refreshing, onRefresh }: { children: ReactNode; refreshing: boolean; onRefresh: () => void }) {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.md - 2 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.deep]} />}
    >
      {children}
    </ScrollView>
  );
}

/** One group's figures: the hero, then tiles two by two, and football's shootout row last. */
function StatsPage({ career, refreshing, onRefresh, onJoin }: { career: Career; refreshing: boolean; onRefresh: () => void; onJoin: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const groups = career.statGroups;
  const [groupKey, setGroupKey] = useState(groups[0]?.key ?? '');
  const group: StatGroup | undefined = groups.find((g) => g.key === groupKey) ?? groups[0];

  if (career.matches === 0) {
    return (
      <Page refreshing={refreshing} onRefresh={onRefresh}>
        <EmptyState
          icon={theme.key === 'Cricket' ? 'cricket' : 'soccer'}
          title={`No ${theme.label.toLowerCase()} matches yet`}
          message={
            career.isMe
              ? `Your figures fill in here once you play in a completed ${theme.label.toLowerCase()} match. Join a team with its code, or ask the organiser to add you by email.`
              : `${career.name} hasn't completed a ${theme.label.toLowerCase()} match yet.`
          }
          actionLabel={career.isMe ? 'Join a team' : undefined}
          onAction={career.isMe ? onJoin : undefined}
        />
      </Page>
    );
  }
  if (!group) return null;

  const heroKey = HERO[group.key]?.key;
  const hero = group.stats.find((s) => s.key === heroKey) ?? group.stats[0];
  const shootout = group.stats.find((s) => s.key === 'shootout');
  const tiles = group.stats.filter((s) => s !== hero && s !== shootout);
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <Page refreshing={refreshing} onRefresh={onRefresh}>
      {groups.length > 1 ? (
        <SegmentedControl
          accessibilityLabel="Discipline"
          segments={groups.map((g) => ({ key: g.key, label: g.title }))}
          value={group.key}
          onChange={setGroupKey}
        />
      ) : null}
      <HeroStat stat={hero} icon={HERO[group.key]?.icon} />
      {rows.map((row) => (
        <View key={row.map((s) => s.key).join()} style={styles.tileRow}>
          {row.map((s) => (
            <StatTile key={s.key} stat={s} dim={s.value === '0'} />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
      {shootout ? <ShootoutTile stat={shootout} /> : null}
    </Page>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  who: { paddingHorizontal: space.lg, paddingTop: space.xs, paddingBottom: space.md },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: 0.5 },
  tileRow: { flexDirection: 'row', gap: space.md - 2 },
  note: { paddingHorizontal: space.xs, marginTop: space.xs },
});
