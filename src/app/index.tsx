import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { NetworkError } from '@/api/errors';
import type { ClubListItem, LeagueListItem, TournamentListItem } from '@/api/types';
import { useSessionState } from '@/auth/session';
import { PhotoBadge } from '@/components/Badges';
import BottomTabBar, { useBottomTabRoom } from '@/components/BottomTabBar';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Glass from '@/components/Glass';
import type { GlassTab } from '@/components/GlassTabBar';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import Skeleton from '@/components/Skeleton';
import StatusChip, { type ChipTone } from '@/components/StatusChip';
import Wallpaper from '@/components/Wallpaper';
import { SERVER_ACTION_LABEL, useServer } from '@/config/server';
import { ClubRow, MakeTeamSheet } from '@/features/clubs/ClubParts';
import FindContent from '@/features/find/FindContent';
import { LeagueLogo, LeaguePickSheet } from '@/features/leagues/LeagueParts';
import NotificationBell from '@/features/notifications/NotificationBell';
import { UpdateBanner } from '@/features/update/UpdateParts';
import { useAction } from '@/hooks/useAction';
import { useKeyboardRoom } from '@/hooks/useKeyboardRoom';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { relativeDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useThemeMode } from '@/theme/appearance';
import { useGlassSupport } from '@/theme/glass';
import { SportThemeProvider, useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { lip, radius, space, SPORTS, themeFor, type Sport, type Typography } from '@/theme/theme';

// Home, in three tabs at the bottom (2026-11-26, the user's pick "B5" on the design canvas, section "Home page: the
// tournaments first"): Tournaments, Teams and Find. The tournaments used to start below the first screen behind the
// count tiles, the new-tournament field, the league row and the join / find links; now the title is followed by two
// buttons and the filter, then the list.
// - Tournaments: New tournament (a sheet: the name and an optional league) and Join a team; the filter All · In play ·
//   Upcoming · Past as underlined tabs with counts. All shows In play and Upcoming open, Past and the leagues the
//   person runs folded until tapped.
// - Teams (C-22, 2026-11-20): the person's own lasting teams in that sport — ones they run or play for. People only
//   ever read "team"; the API calls them clubs.
// - Find: what the /find screen shows (features/find/FindContent).
// The sport switch sits in the top row with the bell and the profile, and applies to the first two tabs.
//
// The list loads every tournament once and filters by sport on the phone, which is what lets the
// sport switch show a count for each side and flip instantly.

// Remembered across launches, so someone running a cricket tournament isn't dropped back into
// football every time they open the app. Same key as the website.
const SPORT_KEY = 'tournamentScheduler.sport';

type HomeTab = 'tournaments' | 'teams' | 'find';
const HOME_TABS: GlassTab<HomeTab>[] = [
  { key: 'tournaments', label: 'Tournaments', icon: 'trophy-outline' },
  { key: 'teams', label: 'Teams', icon: 'account-group-outline' },
  { key: 'find', label: 'Find', icon: 'magnify' },
];

function statusOf(t: TournamentListItem): { label: string; tone: ChipTone } {
  if (t.status === 'Completed') return { label: 'Completed', tone: 'done' };
  if (t.status === 'Cancelled') return { label: 'Cancelled', tone: 'done' };
  if (t.status === 'Live' || t.isStarted) return { label: 'In play', tone: 'live' };
  if (t.hasSchedule) return { label: 'Schedule ready', tone: 'ready' };
  return { label: 'Setting up', tone: 'setup' };
}

const onlyFollowing = (t: TournamentListItem) => t.myRoles.length > 0 && t.myRoles.every((r) => r === 'follower');

// The filter (the count tiles before 2026-11-26): All, or only those in play, upcoming or past. Followed tournaments
// go by their own status too, marked "following" on their line.
type HomeFilter = 'all' | 'live' | 'upcoming' | 'past';
type Phase = Exclude<HomeFilter, 'all'>;
const phaseOf = (t: TournamentListItem): Phase =>
  t.status === 'Live' ? 'live' : t.status === 'Completed' || t.status === 'Cancelled' ? 'past' : 'upcoming';
const PHASE_ORDER: Record<Phase, number> = { live: 0, upcoming: 1, past: 2 };
const FILTERS: { key: HomeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'In play' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
];
const FILTER_EMPTY: Record<Phase, { title: string; message: string }> = {
  live: { title: 'Nothing in play', message: 'None of these tournaments has started yet, or they have all finished.' },
  upcoming: { title: 'Nothing upcoming', message: 'Every one of these tournaments has started or finished.' },
  past: { title: 'Nothing finished yet', message: 'Tournaments land here once they are completed.' },
};

/** A line of Home's list: a heading, a tournament, the folded Past line, or a team. */
type Row =
  | { kind: 'head'; key: string; title: string; count: number }
  | { kind: 'tournament'; key: string; t: TournamentListItem }
  | { kind: 'fold'; key: string; title: string; detail: string; open: boolean; onToggle: () => void }
  | { kind: 'club'; key: string; club: ClubListItem };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "12 Oct – 20 Oct 2026", or null for tournaments from before dates existed. */
function dateRange(t: TournamentListItem): string | null {
  if (!t.startDate || !t.endDate) return null;
  const day = (v: string, year: boolean) => {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  };
  return t.startDate === t.endDate ? day(t.startDate, true) : `${day(t.startDate, t.startDate.slice(0, 4) !== t.endDate.slice(0, 4))} – ${day(t.endDate, true)}`;
}

// "owner", "scorer · player", "team admin" — what I am in it, from the server's myRoles. Lower case: it
// ends a card's line of context ("1–10 Nov, owner · player") in both themes.
const roleOf = (t: TournamentListItem) => {
  if (onlyFollowing(t)) return 'following';
  const parts = [
    t.myRoles.includes('owner') ? 'owner' : t.myRoles.includes('scorer') ? 'scorer' : null,
    t.myRoles.includes('teamAdmin') && !t.myRoles.includes('owner') ? 'team admin' : null,
    t.myRoles.includes('player') ? 'player' : null,
  ];
  const label = parts.filter(Boolean).join(' · ');
  return label || null;
};

export default function Home() {
  const [sport, setSport] = useState<Sport>('Football');

  useEffect(() => {
    AsyncStorage.getItem(SPORT_KEY)
      .then((saved) => {
        if (saved === 'Football' || saved === 'Cricket') setSport(saved);
      })
      .catch(() => {});
  }, []);

  const pickSport = (next: Sport) => {
    setSport(next);
    AsyncStorage.setItem(SPORT_KEY, next).catch(() => {});
  };

  return (
    <SportThemeProvider sport={sport}>
      <HomeContent sport={sport} onSport={pickSport} />
    </SportThemeProvider>
  );
}

function HomeContent({ sport, onSport }: { sport: Sport; onSport: (s: Sport) => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useSportTheme();
  const { ready, baseUrl } = useServer();
  const light = theme.mode === 'light';
  const barRoom = useBottomTabRoom();

  // The tab at the bottom. Find is only built once it has been opened, then kept (its search stays put).
  const [tab, setTab] = useState<HomeTab>('tournaments');
  const [findOpened, setFindOpened] = useState(false);
  const pickTab = (next: HomeTab) => {
    if (next === 'find') setFindOpened(true);
    setTab(next);
  };
  // Android's Back from Teams or Find returns to Tournaments before it leaves the app.
  useFocusEffect(
    useCallback(() => {
      if (tab === 'tournaments') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setTab('tournaments');
        return true;
      });
      return () => sub.remove();
    }, [tab]),
  );

  const fetcher = useCallback(
    // baseUrl is a dependency on purpose: a new server address means a fresh list.
    () => (baseUrl ? api.call<TournamentListItem[]>('TOURNAMENT_LIST') : Promise.reject(new NetworkError('(no server set)'))),
    [baseUrl],
  );
  const list = useQuery(fetcher, { enabled: ready });
  const action = useAction();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  // New tournament: a sheet with the name and its one optional question (leagues, 2026-11-24) — a season of a
  // league the person runs, or a one-off.
  const [creating, setCreating] = useState(false);
  const [league, setLeague] = useState<LeagueListItem | null>(null);
  const [pickingLeague, setPickingLeague] = useState({ open: false, key: 0 });
  const openLeaguePick = () => setPickingLeague((p) => ({ open: true, key: p.key + 1 }));
  const leaguesFetcher = useCallback(
    () => (baseUrl ? api.call<LeagueListItem[]>('LEAGUE_LIST', { query: { sport } }) : Promise.reject(new NetworkError('(no server set)'))),
    [baseUrl, sport],
  );
  const leagues = useQuery(leaguesFetcher, { enabled: ready });
  const myLeagues = leagues.data ?? [];
  const leagueChoice = league?.sport === sport ? league : null;

  const all = list.data ?? [];
  // In play, then upcoming, then past; within each, mine before the ones I only follow.
  const mine = all
    .filter((t) => t.sport === sport)
    .sort((a, b) => PHASE_ORDER[phaseOf(a)] - PHASE_ORDER[phaseOf(b)] || Number(onlyFollowing(a)) - Number(onlyFollowing(b)));
  const [filter, setFilter] = useState<HomeFilter>('all');
  const shown = filter === 'all' ? mine : mine.filter((t) => phaseOf(t) === filter);
  const countOf = (f: HomeFilter) => (f === 'all' ? mine.length : mine.filter((t) => phaseOf(t) === f).length);
  // Folded in All until tapped, so a long run of past seasons doesn't push the rest down.
  const [pastOpen, setPastOpen] = useState(false);
  const [leaguesOpen, setLeaguesOpen] = useState(false);

  // The Teams tab: the person's own lasting teams, every sport in one call (the sport switch filters, as for tournaments).
  const [making, setMaking] = useState({ open: false, key: 0 });
  const clubsFetcher = useCallback(
    () => (baseUrl ? api.call<ClubListItem[]>('CLUB_LIST') : Promise.reject(new NetworkError('(no server set)'))),
    [baseUrl],
  );
  const clubs = useQuery(clubsFetcher, { enabled: ready });
  const myClubs = (clubs.data ?? []).filter((c) => c.sport === sport);
  const teamsView = tab === 'teams';
  const openClub = (c: { clubId: number; name: string; sport: Sport }) =>
    router.push({ pathname: '/club/[clubId]', params: { clubId: String(c.clubId), sport: c.sport } });

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your tournament a name first.');
      return;
    }
    const res = await action.run(() =>
      // Dates come later, with the schedule, once the teams are known.
      api.call<{ id: number; name: string }>('TOURNAMENT_CREATE', { body: { name: trimmed, sport, leagueId: leagueChoice?.leagueId ?? null } }),
    );
    if (!res.ok) return;
    haptic.success();
    setName('');
    if (leagueChoice) {
      setLeague(null);
      leagues.reload();
    }
    setCreating(false);
    list.reload();
    router.push({ pathname: '/tournament/[id]', params: { id: res.value.id, name: res.value.name, sport } });
  };

  const remove = async (t: TournamentListItem) => {
    const ok = await confirm({
      title: `Delete ${t.name}?`,
      message: 'Its teams, schedule and every match result go with it. This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call('TOURNAMENT_DELETE', { routeParams: { id: t.id } }));
    if (res.ok) {
      haptic.heavy();
      list.reload();
    }
  };

  const open = (t: TournamentListItem) =>
    router.push({ pathname: '/tournament/[id]', params: { id: t.id, name: t.name, sport: t.sport } });

  const error = action.error ?? list.error;

  // The list's lines. All: a heading over In play and over Upcoming, then Past folded (opened in place); a filter:
  // just those tournaments.
  const tRow = (t: TournamentListItem): Row => ({ kind: 'tournament', key: `t-${t.id}`, t });
  const rows: Row[] = [];
  if (teamsView) {
    rows.push(...myClubs.map((club): Row => ({ kind: 'club', key: `club-${club.clubId}`, club })));
  } else if (filter !== 'all') {
    rows.push(...shown.map(tRow));
  } else {
    const live = mine.filter((t) => phaseOf(t) === 'live');
    const upcoming = mine.filter((t) => phaseOf(t) === 'upcoming');
    const past = mine.filter((t) => phaseOf(t) === 'past');
    if (live.length) rows.push({ kind: 'head', key: 'h-live', title: 'In play', count: live.length }, ...live.map(tRow));
    if (upcoming.length) rows.push({ kind: 'head', key: 'h-upcoming', title: 'Upcoming', count: upcoming.length }, ...upcoming.map(tRow));
    if (past.length) {
      rows.push({ kind: 'fold', key: 'f-past', title: 'Past', detail: plural(past.length, 'tournament'), open: pastOpen, onToggle: () => setPastOpen((o) => !o) });
      if (pastOpen) rows.push(...past.map(tRow));
    }
  }

  const nameInput = (
    <TextInput
      value={name}
      onChangeText={(v) => {
        setName(v);
        if (nameError) setNameError('');
      }}
      placeholder={theme.placeholder}
      placeholderTextColor={theme.placeholderInk}
      editable={!action.busy}
      returnKeyType="done"
      onSubmitEditing={create}
      accessibilityLabelledBy="new-tournament-label"
      style={
        light
          ? [styles.lightInput, { color: theme.ink }]
          : [styles.input, { backgroundColor: theme.field, color: theme.ink, borderColor: nameError ? theme.warnInk : theme.fieldBorder }]
      }
    />
  );

  const leagueRow = (
    <PressableScale
      onPress={openLeaguePick}
      accessibilityRole="button"
      accessibilityLabel={leagueChoice ? `League: ${leagueChoice.name}, this becomes season ${leagueChoice.seasons + 1}. Change` : 'League: none, a one-off tournament. Choose a league'}
      style={[styles.leagueRow, { borderColor: light ? theme.cardDivider : theme.fieldBorder }]}
    >
      {leagueChoice ? <LeagueLogo name={leagueChoice.shortName} link={leagueChoice.logoUrl} size={32} /> : <Icon name="trophy-outline" size={20} color={theme.muted} />}
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
          {leagueChoice ? leagueChoice.name : 'League (optional)'}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]}>{leagueChoice ? `This becomes Season ${leagueChoice.seasons + 1}` : 'A one-off tournament'}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={theme.muted} />
    </PressableScale>
  );

  // The leagues the person runs, folded at the end of All: a league with no season yet is reached here.
  const leagueRows = !teamsView && filter === 'all' && myLeagues.length > 0 && (
    <View style={{ gap: light ? 0 : space.sm }}>
      <Fold title="Leagues you run" detail={String(myLeagues.length)} open={leaguesOpen} onToggle={() => setLeaguesOpen((o) => !o)} />
      {leaguesOpen &&
        myLeagues.map((l) => (
          <PressableScale
            key={l.leagueId}
            onPress={() => router.push({ pathname: '/league/[leagueId]', params: { leagueId: String(l.leagueId), sport: l.sport } })}
            accessibilityLabel={`${l.name}, ${l.line}`}
            accessibilityHint="Opens the league"
            style={light ? [styles.lightLink, { borderBottomColor: theme.cardDivider }] : [styles.glassRow, { backgroundColor: theme.cream }]}
          >
            <LeagueLogo name={l.shortName} link={l.logoUrl} size={36} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: light ? theme.ink : theme.onDark }]} numberOfLines={1}>
                {l.name}
              </Text>
              <Text style={[type.caption, { color: light ? theme.muted : theme.onDarkSoft }]} numberOfLines={1}>
                {l.line}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={light ? theme.muted : theme.onDarkSoft} />
          </PressableScale>
        ))}
    </View>
  );

  const header = (
    <View style={{ gap: space.lg, marginBottom: space.sm }}>
      <TopRow
        sport={sport}
        onSport={onSport}
        counts={
          teamsView
            ? clubs.data && SPORTS.map((s) => clubs.data!.filter((c) => c.sport === s.key).length)
            : list.data && SPORTS.map((s) => all.filter((t) => t.sport === s.key).length)
        }
      />
      <Text style={[type.title, light ? styles.lightTitle : styles.glassTitle, { color: theme.ink }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
        {teamsView ? 'Your teams' : 'Your tournaments'}
      </Text>
      <UpdateBanner />
      <View style={styles.actions}>
        {teamsView ? (
          <Button label="Make a team" icon="account-multiple-plus" onPress={() => setMaking((m) => ({ open: true, key: m.key + 1 }))} style={styles.action} />
        ) : (
          <Button label="New tournament" icon="plus" onPress={() => setCreating(true)} style={styles.action} accessibilityLabel={`New ${theme.label.toLowerCase()} tournament`} />
        )}
        <Button
          label="Join a team"
          icon="account-group-outline"
          variant="secondary"
          onPress={() => router.push('/join')}
          style={styles.action}
          accessibilityLabel={teamsView ? "Join a team with a code from its admin" : 'Join a team with a code from its organiser or admin'}
        />
      </View>
      {!teamsView && list.data && (
        <FilterTabs
          value={filter}
          onChange={(f) => {
            haptic.select();
            setFilter(f);
          }}
          items={FILTERS.map((f) => ({ ...f, count: countOf(f.key) }))}
        />
      )}
      <ErrorBanner
        message={error?.message}
        actionLabel={error instanceof NetworkError ? SERVER_ACTION_LABEL : 'Try again'}
        onAction={error instanceof NetworkError ? () => router.push('/server') : list.refresh}
      />
    </View>
  );

  const footer = teamsView ? null : (
    <View style={{ gap: space.sm, marginTop: light ? 0 : space.xs }}>
      {leagueRows}
      {shown.some((t) => t.myRoles.includes('creator')) && (
        <Text style={[type.caption, { color: theme.muted, marginTop: space.sm, paddingHorizontal: light ? 0 : space.xs }]}>
          Press and hold one you created to delete it.
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Wallpaper />
      <View style={[styles.pane, tab === 'find' && styles.hidden]}>
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={{
            paddingTop: insets.top + (light ? space.md : space.sm),
            paddingBottom: barRoom,
            paddingHorizontal: light ? space.xl : space.lg,
            gap: light ? 0 : space.sm,
          }}
          refreshControl={
            <RefreshControl
              refreshing={teamsView ? clubs.refreshing : list.refreshing}
              onRefresh={teamsView ? clubs.refresh : list.refresh}
              tintColor={theme.accent}
              colors={[theme.deep]}
            />
          }
          ListEmptyComponent={
            teamsView ? (
              clubs.loading ? (
                <Skeleton rows={2} height={84} />
              ) : clubs.data ? (
                <EmptyState
                  icon="account-group-outline"
                  title={`No ${theme.label.toLowerCase()} teams yet`}
                  message="Make one for the friends you play with and keep your players for every tournament — or join one with the code its admin shares."
                />
              ) : (
                <ErrorBanner message={clubs.error?.message} actionLabel="Try again" onAction={clubs.refresh} />
              )
            ) : list.loading ? (
              <Skeleton rows={3} height={light ? 72 : 112} />
            ) : list.data && filter !== 'all' && mine.length > 0 ? (
              <EmptyState
                icon="filter-variant"
                title={FILTER_EMPTY[filter].title}
                message={FILTER_EMPTY[filter].message}
                actionLabel="Show all"
                onAction={() => setFilter('all')}
              />
            ) : list.data ? (
              <EmptyState
                icon={sport === 'Cricket' ? 'cricket' : 'soccer'}
                title={`No ${theme.label.toLowerCase()} tournaments`}
                message="Start one with New tournament, join a team with its code — or ask an organiser to add you using the email you signed in with."
              />
            ) : null
          }
          renderItem={({ item, index }) => {
            switch (item.kind) {
              case 'club':
                return <ClubRow club={item.club} onPress={() => openClub(item.club)} />;
              case 'head':
                return (
                  <View style={[styles.head, light ? { marginTop: index === 0 ? space.xs : space.xl } : { marginTop: index === 0 ? 0 : space.sm, marginHorizontal: space.xs }]}>
                    <Text style={[light ? type.eyebrow : type.bodyStrong, { color: theme.muted, flex: 1 }]} accessibilityRole="header">
                      {item.title}
                    </Text>
                    <Text style={[light ? type.eyebrow : type.bodyStrong, { color: theme.muted }]}>{item.count}</Text>
                  </View>
                );
              case 'fold':
                return <Fold title={item.title} detail={item.detail} open={item.open} onToggle={item.onToggle} spaced={index > 0} />;
              default:
                return <TournamentCard item={item.t} onOpen={() => open(item.t)} onDelete={item.t.myRoles.includes('creator') ? () => remove(item.t) : undefined} />;
            }
          }}
        />
      </View>

      {findOpened && (
        <View style={[styles.pane, tab !== 'find' && styles.hidden]}>
          <FindPane bottom={barRoom} />
        </View>
      )}

      <BottomTabBar tabs={HOME_TABS} value={tab} onChange={pickTab} accessibilityLabel="Home" />

      <MakeTeamSheet
        key={making.key}
        visible={making.open}
        onClose={() => setMaking((m) => ({ ...m, open: false }))}
        sport={sport}
        onMade={(club) => {
          setMaking((m) => ({ ...m, open: false }));
          clubs.reload();
          openClub(club);
        }}
      />

      <Sheet
        visible={creating}
        onClose={() => setCreating(false)}
        title={`New ${theme.label.toLowerCase()} tournament`}
        subtitle="Name it now. Teams, the schedule and its dates come next."
        footer={
          <>
            <Button label="Cancel" variant="deck" onPress={() => setCreating(false)} style={{ flex: 1 }} />
            <Button label="Create tournament" onPress={create} busy={action.busy} style={{ flex: 2 }} />
          </>
        }
      >
        <Text style={[type.label, { color: theme.muted }]} nativeID="new-tournament-label">
          Name
        </Text>
        {light ? <View style={[styles.lightField, { borderBottomColor: nameError ? theme.warnInk : theme.fieldBorder }]}>{nameInput}</View> : nameInput}
        {!!nameError && <Text style={[type.caption, { color: theme.warnInk }]}>{nameError}</Text>}
        {leagueRow}
        <ErrorBanner message={action.error?.message} />
      </Sheet>

      <LeaguePickSheet
        key={`league-${pickingLeague.key}`}
        visible={pickingLeague.open}
        onClose={() => setPickingLeague((p) => ({ ...p, open: false }))}
        sport={sport}
        value={leagueChoice}
        onPick={setLeague}
      />
    </View>
  );
}

/**
 * The top row of every tab: the sport switch (left; not on Find, which searches both), then the bell and the profile.
 * `counts` are Football's and Cricket's, in SPORTS order, once loaded.
 */
function TopRow({ sport, onSport, counts }: { sport?: Sport; onSport?: (s: Sport) => void; counts?: number[] | null }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const { session } = useSessionState();
  const light = theme.mode === 'light';
  const glass = useGlassSupport();
  return (
    // As tall as the sport switch even on Find, which has none: the bell and profile are centred in the row, so a
    // shorter row put them a few points higher there. Light pills 48; glass 44 + its 4 + 4 track, + a 1 + 1 edge
    // except iOS 26's own glass, which draws none. Plus the row's own top padding, which a minimum height counts.
    <View style={[styles.top, { minHeight: (light ? 48 : glass === 'native' ? 52 : 54) + space.xs }]}>
      {sport && onSport ? (
        <SegmentedControl
          accessibilityLabel="Sport"
          segments={SPORTS.map((s, i) => ({ key: s.key, label: s.label, badge: counts ? counts[i] : undefined }))}
          value={sport}
          onChange={onSport}
          style={styles.sports}
        />
      ) : null}
      <View style={{ flex: 1 }} />
      <NotificationBell style={light ? styles.iconButton : undefined} />
      <PressableScale
        onPress={() => router.push('/profile')}
        feel={light ? 'press' : 'glass'}
        glowRadius={22}
        style={light ? styles.iconButton : styles.glassCircle}
        accessibilityLabel={`Your profile, signed in as ${session?.user.name ?? 'you'}`}
      >
        {!light && <Glass pointerEvents="none" radius={22} interactive style={StyleSheet.absoluteFill} />}
        <Icon name="account-circle-outline" size={light ? 24 : 22} color={theme.ink} />
      </PressableScale>
    </View>
  );
}

/** The Find tab: the top row, its title and the Find screen's content, scrolling clear of the bar and the keyboard. */
function FindPane({ bottom }: { bottom: number }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const light = theme.mode === 'light';
  const { rootRef, scrollRef, room, onScroll } = useKeyboardRoom<ScrollView>();
  return (
    <View ref={rootRef} style={{ flex: 1, paddingBottom: room }}>
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + (light ? space.md : space.sm),
          paddingBottom: room ? space.lg : bottom,
          paddingHorizontal: light ? space.xl : space.lg,
          gap: space.lg,
        }}
      >
        <TopRow />
        <Text style={[type.title, light ? styles.lightTitle : styles.glassTitle, { color: theme.ink }]} accessibilityRole="header">
          Find
        </Text>
        <FindContent />
      </ScrollView>
    </View>
  );
}

/** All · In play · Upcoming · Past: words with their counts, spread across the width, the chosen one underlined. */
function FilterTabs({ value, onChange, items }: { value: HomeFilter; onChange: (f: HomeFilter) => void; items: { key: HomeFilter; label: string; count: number }[] }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <View style={[styles.filters, { borderBottomColor: light ? theme.cardDivider : theme.borderOnDark }]} accessibilityRole="tablist" accessibilityLabel="Show">
      {items.map((f) => {
        const on = f.key === value;
        return (
          <PressableScale
            key={f.key}
            onPress={() => !on && onChange(f.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${f.label}, ${f.count}`}
            style={[styles.filter, { borderBottomColor: on ? theme.accent : 'transparent' }]}
            hitSlop={{ top: 4, bottom: 4 }}
          >
            <Text style={[on ? type.bodyStrong : type.body, { color: on ? theme.ink : theme.muted }]} numberOfLines={1}>
              {f.label}
              <Text style={{ color: on ? theme.deep : theme.muted }}> {f.count}</Text>
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A folded group (Past, Leagues you run): its name, how many, a chevron; tapped, it opens in place. */
function Fold({ title, detail, open, onToggle, spaced }: { title: string; detail: string; open: boolean; onToggle: () => void; spaced?: boolean }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <PressableScale
      onPress={() => {
        haptic.select();
        onToggle();
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${title}, ${detail}`}
      accessibilityHint={open ? 'Folds them away' : 'Shows them'}
      style={
        light
          ? [styles.lightLink, { borderBottomColor: theme.cardDivider }, spaced && { marginTop: space.sm }]
          : [styles.glassRow, { backgroundColor: theme.cream }, spaced && { marginTop: space.xs }]
      }
    >
      <Text style={[light ? type.body : type.bodyStrong, { flex: 1, color: theme.ink }]}>
        {title}
        <Text style={[type.body, { color: theme.muted }]}> · {detail}</Text>
      </Text>
      <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={theme.muted} />
    </PressableScale>
  );
}

/** `onDelete` only for tournaments the signed-in person created — deleting is the creator's alone. */
function TournamentCard({ item, onOpen, onDelete }: { item: TournamentListItem; onOpen: () => void; onDelete?: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = themeFor(item.sport, useThemeMode());
  const status = statusOf(item);
  const longPress = onDelete
    ? () => {
        haptic.heavy();
        onDelete();
      }
    : undefined;

  // Light: a row, not a card — a live dot (or an empty ring), the name, one line of context.
  if (theme.mode === 'light') {
    const live = status.tone === 'live';
    const context = [item.league ? `Season ${item.league.season}` : null, status.label, dateRange(item) ?? `created ${relativeDate(item.createdAt)}`, roleOf(item)]
      .filter(Boolean)
      .join(', ');
    return (
      <PressableScale
        onPress={onOpen}
        onLongPress={longPress}
        delayLongPress={450}
        accessibilityLabel={`${item.name}, ${context}`}
        accessibilityHint="Opens the tournament"
        accessibilityActions={onDelete ? [{ name: 'delete', label: 'Delete tournament' }] : undefined}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete?.()}
        style={[styles.lightRow, { borderBottomColor: theme.cardDivider }]}
      >
        {live ? (
          <View style={[styles.lightMarkerRing, { backgroundColor: theme.tint }]}>
            <View style={[styles.lightMarker, { backgroundColor: theme.accent }]} />
          </View>
        ) : (
          <View style={[styles.lightMarker, { borderWidth: 1.5, borderColor: theme.placeholderInk }]} />
        )}
        {!!item.logoUrl && <PhotoBadge link={item.logoUrl} name={item.name} size={44} square />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.lead, { color: theme.ink, fontSize: 18, lineHeight: 24 }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[type.caption, { color: theme.muted }]}>{context}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.muted} />
      </PressableScale>
    );
  }

  return (
    <PressableScale
      onPress={onOpen}
      onLongPress={longPress}
      delayLongPress={450}
      accessibilityLabel={`${item.name}, ${status.label}`}
      accessibilityHint="Opens the tournament"
      accessibilityActions={onDelete ? [{ name: 'delete', label: 'Delete tournament' }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete?.()}
      // Glass: a frosted row — where it stands, the name, its dates and what I am in it.
      style={[styles.row, { backgroundColor: theme.cream }, lip(theme)]}
    >
      {/* The tournament's logo when it has one (HLD P-26); rows without one keep their old shape. */}
      {!!item.logoUrl && <PhotoBadge link={item.logoUrl} name={item.name} size={52} square />}
      <View style={{ flex: 1, gap: 3 }}>
        <StatusChip label={status.label} tone={status.tone} />
        <Text style={[type.lead, { color: theme.ink }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]}>
          {item.league ? `Season ${item.league.season} · ` : ''}
          {dateRange(item) ?? `Created ${relativeDate(item.createdAt)}`}
          {roleOf(item) ? `, ${roleOf(item)}` : ''}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={theme.muted} />
    </PressableScale>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  // A tab's page; the hidden ones stay built (scroll position, Find's search) but take no room.
  pane: { flex: 1 },
  hidden: { display: 'none' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingTop: space.xs },
  // Wide enough for "Football 12" and "Cricket 8"; only a narrow phone shrinks it (the spacer after it takes the rest).
  sports: { width: 236, flexShrink: 1 },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 0, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  glassCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: space.xs },
  lightTitle: { fontSize: 36, lineHeight: 42, letterSpacing: -0.6 },
  glassTitle: { fontSize: 34, lineHeight: 41, marginLeft: space.xs },
  // New tournament / Make a team beside Join a team: each as wide as its words, sharing what's left.
  actions: { flexDirection: 'row', gap: space.sm + 2 },
  action: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', paddingHorizontal: space.md },
  filters: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1 },
  filter: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, marginBottom: -1 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xs },
  // The new-tournament sheet's league line.
  leagueRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingVertical: space.xs, borderBottomWidth: 1 },
  glassRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderRadius: radius.glass, borderCurve: 'continuous', paddingHorizontal: space.lg, paddingVertical: space.sm },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingHorizontal: space.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  row: {
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  // The light home.
  lightField: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, paddingBottom: space.sm },
  lightInput: { flex: 1, minWidth: 0, minHeight: 44, fontFamily: fonts.body, fontSize: 18, paddingHorizontal: 0 },
  lightLink: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, borderBottomWidth: 1 },
  lightRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
  lightMarker: { width: 10, height: 10, borderRadius: 5 },
  lightMarkerRing: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: -5 },
});
