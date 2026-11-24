import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import { api } from '@/api/client';
import type { League, LeagueBoard, LeagueSeason, LeagueStats, LeagueTeams } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import HeaderButton from '@/components/HeaderButton';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import UnderlineTabs from '@/components/UnderlineTabs';
import Wallpaper from '@/components/Wallpaper';
import { LeagueLogo, NewSeasonSheet } from '@/features/leagues/LeagueParts';
import { useAction } from '@/hooks/useAction';
import { useQuery, type Query } from '@/hooks/useQuery';
import { haptic } from '@/lib/haptics';
import { SportThemeProvider, useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { lip, radius, space, type Typography } from '@/theme/theme';

// A league's page (canvas "Leagues and seasons", boards League-Seasons, League-Stats, League-Stats-Bowling, League-Teams):
// its logo, name, who runs it and its totals, then Seasons (being played, still to play, played, each with its winner),
// Stats (every season or one; Batting · Bowling · Fielding · MVP, each a row of leaderboard chips that scrolls sideways,
// as a tournament's Stats tab) and Teams (titles, and every team's record across the seasons it played). Anyone signed
// in may look; its organisers get the settings and "Start Season N", pinned on the Seasons tab.

type Tab = 'seasons' | 'stats' | 'teams';

export default function LeagueScreen() {
  const { leagueId, sport } = useLocalSearchParams<{ leagueId: string; sport?: string }>();
  const fetcher = useCallback(() => api.call<League>('LEAGUE_GET', { routeParams: { leagueId: Number(leagueId) } }), [leagueId]);
  const league = useQuery(fetcher);
  return (
    <SportThemeProvider sport={league.data?.sport ?? sport ?? 'Cricket'}>
      <LeagueView query={league} />
    </SportThemeProvider>
  );
}

function LeagueView({ query }: { query: Query<League> }) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const light = theme.mode === 'light';
  const [tab, setTab] = useState<Tab>('seasons');
  const [starting, setStarting] = useState({ open: false, key: 0 });
  const follow = useAction();
  const l = query.data;

  const openSeason = async (s: LeagueSeason) => {
    const go = () => router.push({ pathname: '/tournament/[id]', params: { id: String(s.tournamentId), name: s.name, sport: l!.sport } });
    if (s.canOpen) return go();
    if (!s.liveCode) return;
    // Every season is public: someone not in it follows it, then it opens like any tournament they follow.
    const res = await follow.run(() => api.call('FOLLOW_ADD', { body: { code: s.liveCode } }));
    if (res.ok) {
      haptic.success();
      query.reload();
      go();
    }
  };

  const runBy = !l || l.runBy.length === 0 ? null : `Run by ${l.runBy.length === 1 ? l.runBy[0] : `${l.runBy.slice(0, -1).join(', ')} and ${l.runBy[l.runBy.length - 1]}`}`;
  const sections: { key: LeagueSeason['section']; title: string }[] = [
    { key: 'live', title: 'Being played' },
    { key: 'upcoming', title: 'Still to play' },
    { key: 'past', title: 'Played' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: light ? (l?.name ?? '') : '',
          headerStyle: { backgroundColor: light ? theme.deck : 'transparent' },
          headerTintColor: light ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: light ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          headerBackButtonDisplayMode: 'minimal',
          headerRight: l?.canManage
            ? () => (
                <HeaderButton
                  icon="dots-horizontal"
                  label="League settings"
                  onPress={() => router.push({ pathname: '/league/[leagueId]/settings', params: { leagueId: String(l.leagueId), sport: l.sport } })}
                />
              )
            : undefined,
        }}
      />
      <Wallpaper underHeader />
      <Screen
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        error={l ? null : query.error}
        onRetry={query.refresh}
        footer={
          l?.canManage && tab === 'seasons' ? (
            <Button label={`Start Season ${l.nextSeason}`} icon="plus" size="lg" onPress={() => setStarting((s) => ({ open: true, key: s.key + 1 }))} />
          ) : undefined
        }
      >
        {!l ? (
          query.loading ? <Skeleton rows={5} height={72} /> : null
        ) : (
          <>
            <View style={styles.head}>
              <LeagueLogo name={l.shortName} link={l.logoUrl} size={64} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.eyebrow, { color: light ? theme.muted : theme.onDarkSoft }]}>{[`${theme.label} league`, l.area].filter(Boolean).join(' · ')}</Text>
                <Text style={[styles.name, { color: theme.onDark }]} accessibilityRole="header" numberOfLines={2}>
                  {l.name}
                </Text>
              </View>
            </View>
            {runBy && <Text style={[type.body, { color: light ? theme.muted : theme.onDarkSoft, marginTop: -space.sm }]}>{runBy}</Text>}

            <Card style={styles.tiles}>
              <Tile value={l.totals.seasons} label={l.totals.seasons === 1 ? 'Season' : 'Seasons'} />
              <Tile value={l.totals.teams} label={l.totals.teams === 1 ? 'Team' : 'Teams'} />
              <Tile value={l.totals.matches} label={l.totals.matches === 1 ? 'Match' : 'Matches'} />
              <Tile value={l.totals.champions} label={l.totals.champions === 1 ? 'Champion' : 'Champions'} wide />
            </Card>

            <UnderlineTabs
              tabs={[
                { key: 'seasons', label: 'Seasons' },
                { key: 'stats', label: 'Stats' },
                { key: 'teams', label: 'Teams' },
              ]}
              value={tab}
              onChange={(next: Tab) => {
                haptic.select();
                setTab(next);
              }}
            />

            {tab === 'seasons' && (
              <>
                <ErrorBanner message={follow.error?.message} />
                {l.seasons.length === 0 ? (
                  <EmptyState
                    icon="trophy-outline"
                    title="No seasons yet"
                    message={l.canManage ? `Start Season 1, or tick tournaments you've already run here in from the league's settings.` : 'Its first season shows here once it starts.'}
                  />
                ) : (
                  sections.map((s) => {
                    const rows = l.seasons.filter((x) => x.section === s.key);
                    if (rows.length === 0) return null;
                    return (
                      <View key={s.key} style={{ gap: space.sm }}>
                        <Text style={[type.eyebrow, { color: light ? theme.muted : theme.onDarkSoft }]} accessibilityRole="header">
                          {s.title}
                        </Text>
                        {rows.map((x) => (
                          <SeasonRow key={x.tournamentId} s={x} onPress={x.canOpen || x.liveCode ? () => openSeason(x) : undefined} />
                        ))}
                      </View>
                    );
                  })
                )}
              </>
            )}
            {tab === 'stats' && <StatsTab league={l} />}
            {tab === 'teams' && <TeamsTab league={l} />}

            {l.canManage && (
              <NewSeasonSheet
                key={starting.key}
                visible={starting.open}
                onClose={() => setStarting((s) => ({ ...s, open: false }))}
                league={l}
                sport={l.sport}
              />
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

/** One total. `wide` gives "Champions" the room it needs beside three short words. */
function Tile({ value, label, wide }: { value: number; label: string; wide?: boolean }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return (
    <View style={{ flex: wide ? 1.4 : 1, alignItems: 'center', gap: 2, paddingVertical: space.sm }} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[type.figure, { color: theme.ink, fontSize: 24, lineHeight: 30 }]}>{value}</Text>
      <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SeasonRow({ s, onPress }: { s: LeagueSeason; onPress?: () => void }) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  const now = s.section === 'live';
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`Season ${s.number}. ${s.title}. ${s.line}${s.hidden ? '. Hidden by KickCricket' : ''}`}
      accessibilityHint={onPress ? 'Opens the season' : undefined}
      style={light ? [styles.lightRow, { borderBottomColor: theme.cardDivider }] : [styles.row, { backgroundColor: theme.cream }, lip(theme)]}
    >
      <View
        style={[
          styles.season,
          { borderColor: now ? theme.accent : theme.cardDivider, backgroundColor: now ? theme.tint : 'transparent', borderStyle: s.section === 'upcoming' ? 'dashed' : 'solid' },
        ]}
      >
        <Text style={[styles.seasonSmall, { color: theme.muted, fontFamily: fonts.bodySemiBold }]}>SEASON</Text>
        <Text style={[styles.seasonNumber, { color: theme.ink, fontFamily: fonts.bodySemiBold }]}>{s.number}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
          {s.title}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={2}>
          {s.hidden ? `${s.line} · hidden by KickCricket` : s.line}
        </Text>
      </View>
      {now ? (
        <StatusChip label="Live" tone="live" />
      ) : s.championName ? (
        <View style={[styles.tag, { backgroundColor: theme.tint }]}>
          <Icon name="trophy" size={14} color={light ? theme.deep : theme.accent} />
          <Text style={[type.label, { color: light ? theme.deep : theme.accent }]}>Won</Text>
        </View>
      ) : null}
      {onPress && <Icon name="chevron-right" size={20} color={theme.muted} />}
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Stats: every season or one, groups as segments, the group's leaderboards as a sideways row of chips (the user's note)

function StatsTab({ league }: { league: League }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const [season, setSeason] = useState<number | null>(null);
  const fetcher = useCallback(
    () => api.call<LeagueStats>('LEAGUE_STATS', { routeParams: { leagueId: league.leagueId }, query: season == null ? {} : { season } }),
    [league.leagueId, season],
  );
  const stats = useQuery(fetcher);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [boardKey, setBoardKey] = useState<Record<string, string>>({});
  const s = stats.data;
  const group = s?.groups.find((g) => g.key === groupKey) ?? s?.groups[0];
  const board = group ? (group.boards.find((b) => b.key === boardKey[group.key]) ?? group.boards[0]) : undefined;

  return (
    <View style={{ gap: space.md }}>
      <GestureScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All seasons" selected={season == null} onPress={() => setSeason(null)} />
        {league.seasons
          .slice()
          .sort((a, b) => b.number - a.number)
          .map((x) => (
            <Chip key={x.number} label={`Season ${x.number}`} selected={season === x.number} onPress={() => setSeason(x.number)} />
          ))}
      </GestureScrollView>
      <ErrorBanner message={stats.error?.message} actionLabel="Try again" onAction={stats.refresh} />
      {!s ? (
        stats.loading ? <Skeleton rows={5} height={56} /> : null
      ) : (
        <>
          {group && (
            <SegmentedControl
              accessibilityLabel="Stats"
              segments={s.groups.map((g) => ({ key: g.key, label: g.title }))}
              value={group.key}
              onChange={(k: string) => {
                haptic.select();
                setGroupKey(k);
              }}
            />
          )}
          {group && group.boards.length > 1 && (
            <GestureScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {group.boards.map((b) => (
                <Chip
                  key={b.key}
                  label={b.title}
                  selected={board?.key === b.key}
                  onPress={() => {
                    haptic.select();
                    setBoardKey((k) => ({ ...k, [group.key]: b.key }));
                  }}
                />
              ))}
            </GestureScrollView>
          )}
          {board && <BoardCard key={`${season ?? 'all'}-${group?.key}-${board.key}`} board={board} basis={s.basis} />}
          {s.notes.map((n) => (
            <Text key={n} style={[type.caption, { color: theme.muted }]}>
              {n}
            </Text>
          ))}
        </>
      )}
    </View>
  );
}

/** One leaderboard: the top five, then all of them on "See all". A row opens the player's profile. */
function BoardCard({ board, basis }: { board: LeagueBoard; basis: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const [all, setAll] = useState(false);
  const rows = all ? board.rows : board.rows.slice(0, 5);
  return (
    <Card style={{ gap: space.xs }}>
      <View style={styles.between}>
        <Text style={[type.headline, { color: theme.ink, flex: 1 }]}>{board.title}</Text>
        <Text style={[type.caption, { color: theme.muted }]}>{basis.split(' · ')[0]}</Text>
      </View>
      {!!board.qualification && <Text style={[type.caption, { color: theme.muted }]}>{board.qualification}</Text>}
      {rows.length === 0 ? (
        <Text style={[type.body, { color: theme.muted, paddingVertical: space.md }]}>Nobody yet.</Text>
      ) : (
        rows.map((r, i) => (
          <PressableScale
            key={`${r.rank}-${r.playerId}-${i}`}
            onPress={() => router.push({ pathname: '/profile', params: r.userId != null ? { userId: String(r.userId) } : { playerId: String(r.playerId) } })}
            accessibilityLabel={`${r.rank}. ${r.name}, ${r.value} ${board.valueLabel}. ${r.line}`}
            accessibilityHint="Opens their profile"
            style={[styles.boardRow, { borderTopColor: theme.cardDivider }]}
          >
            <Text style={[styles.rank, { color: theme.muted }]}>{r.rank}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
                {r.name}
              </Text>
              <Text style={[type.caption, { color: theme.muted }]} numberOfLines={2}>
                {r.line}
              </Text>
            </View>
            <Text style={[type.figure, { color: theme.ink, fontSize: 20, lineHeight: 26 }]}>{r.value}</Text>
          </PressableScale>
        ))
      )}
      {!all && board.rows.length > 5 && (
        <Button label={`See all ${board.rows.length}`} variant="secondary" size="sm" onPress={() => setAll(true)} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Teams: titles, and every team's record across the seasons it played

function TeamsTab({ league }: { league: League }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  const fetcher = useCallback(() => api.call<LeagueTeams>('LEAGUE_TEAMS', { routeParams: { leagueId: league.leagueId } }), [league.leagueId]);
  const teams = useQuery(fetcher);
  const t = teams.data;
  const seasonsLine = league.totals.seasons === 1 ? 'Season 1' : league.totals.seasons > 1 ? `Seasons 1–${league.totals.seasons}` : '';

  return (
    <View style={{ gap: space.md }}>
      <ErrorBanner message={teams.error?.message} actionLabel="Try again" onAction={teams.refresh} />
      {!t ? (
        teams.loading ? <Skeleton rows={4} height={56} /> : null
      ) : (
        <>
          {t.titles.length > 0 && (
            <Card style={{ gap: space.xs }}>
              <Text style={[type.headline, { color: theme.ink }]}>Titles</Text>
              {t.titles.map((x) => (
                <View key={x.name} style={[styles.boardRow, { borderTopColor: theme.cardDivider }]} accessible accessibilityLabel={`${x.name}, ${x.count} titles: seasons ${x.seasons.join(', ')}`}>
                  <LeagueLogo name={x.name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase()} link={null} size={36} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.bodyStrong, { color: theme.ink }]}>{x.name}</Text>
                    <Text style={[type.caption, { color: theme.muted }]}>{x.seasons.length === 1 ? `Season ${x.seasons[0]}` : `Seasons ${x.seasons.join(', ')}`}</Text>
                  </View>
                  <Icon name="trophy" size={18} color={light ? theme.deep : theme.accent} />
                  <Text style={[type.figure, { color: theme.ink, fontSize: 20 }]}>{x.count}</Text>
                </View>
              ))}
            </Card>
          )}
          <Card style={{ gap: space.xs }}>
            <View style={styles.between}>
              <Text style={[type.headline, { color: theme.ink, flex: 1 }]}>Every team</Text>
              <Text style={[type.caption, { color: theme.muted }]}>{seasonsLine}</Text>
            </View>
            {t.teams.length === 0 ? (
              <Text style={[type.body, { color: theme.muted, paddingVertical: space.md }]}>No teams yet.</Text>
            ) : (
              <>
                <View style={styles.tableRow}>
                  <Text style={[type.label, styles.teamCell, { color: theme.muted }]}>Team</Text>
                  {['Seasons', 'Played', 'Won', 'Win %'].map((h) => (
                    <Text key={h} style={[type.label, styles.numCell, { color: theme.muted }]}>
                      {h}
                    </Text>
                  ))}
                </View>
                {t.teams.map((x, i) => (
                  <View
                    key={`${x.name}-${i}`}
                    style={[styles.tableRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.cardDivider }]}
                    accessible
                    accessibilityLabel={`${x.name}: ${x.seasons} seasons, played ${x.played}, won ${x.won}, ${x.winPercent} percent`}
                  >
                    <Text style={[type.bodyStrong, styles.teamCell, { color: theme.ink }]} numberOfLines={1}>
                      {x.name}
                    </Text>
                    {[x.seasons, x.played, x.won, x.winPercent].map((n, k) => (
                      <Text key={k} style={[type.body, styles.numCell, { color: theme.ink, fontVariant: ['tabular-nums'] }]}>
                        {n}
                      </Text>
                    ))}
                  </View>
                ))}
              </>
            )}
          </Card>
          <Text style={[type.caption, { color: theme.muted }]}>{t.note}</Text>
        </>
      )}
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33 },
  tiles: { flexDirection: 'row', paddingVertical: space.xs, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 64 },
  lightRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, minHeight: 60, borderBottomWidth: 1 },
  season: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  seasonSmall: { fontSize: 9, letterSpacing: 0.4, lineHeight: 12 },
  seasonNumber: { fontSize: 18, lineHeight: 21 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  chipRow: { gap: space.sm, paddingRight: space.lg },
  between: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  rank: { width: 22, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 14 },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.xs },
  teamCell: { flex: 2.2 },
  numCell: { flex: 1, textAlign: 'right' },
});
