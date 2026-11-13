import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { NetworkError } from '@/api/errors';
import type { TournamentListItem } from '@/api/types';
import { useSessionState } from '@/auth/session';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Glass from '@/components/Glass';
import Icon, { type IconName } from '@/components/Icon';
import Wallpaper from '@/components/Wallpaper';
import { UpdateBanner } from '@/features/update/UpdateParts';
import PressableScale from '@/components/PressableScale';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import Skeleton from '@/components/Skeleton';
import StatusChip, { type ChipTone } from '@/components/StatusChip';
import { SERVER_ACTION_LABEL, useServer } from '@/config/server';
import NotificationBell from '@/features/notifications/NotificationBell';
import { useAction } from '@/hooks/useAction';
import { useKeyboardRoom } from '@/hooks/useKeyboardRoom';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { relativeDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useThemeMode } from '@/theme/appearance';
import { SportThemeProvider, useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { lip, radius, space, SPORTS, themeFor, type Sport, type Typography } from '@/theme/theme';

// Home: the organiser's tournaments for one sport, and the place to start a new one.
//
// The list loads every tournament once and filters by sport on the phone, which is what lets the
// sport switch show a count for each side and flip instantly.

// Remembered across launches, so someone running a cricket tournament isn't dropped back into
// football every time they open the app. Same key as the website.
const SPORT_KEY = 'tournamentScheduler.sport';

function statusOf(t: TournamentListItem): { label: string; tone: ChipTone } {
  if (t.status === 'Completed') return { label: 'Completed', tone: 'done' };
  if (t.status === 'Cancelled') return { label: 'Cancelled', tone: 'done' };
  if (t.status === 'Live' || t.isStarted) return { label: 'In play', tone: 'live' };
  if (t.hasSchedule) return { label: 'Schedule ready', tone: 'ready' };
  return { label: 'Setting up', tone: 'setup' };
}

// Live first, then what's coming, then the past — each under its own heading. Public tournaments I
// only follow (6E) come last, under Following; one I also run or play in stays with mine.
const SECTION_ORDER = { Live: 0, Upcoming: 1, Completed: 2, Cancelled: 2 } as const;
const SECTION_TITLE = ['Live', 'Upcoming', 'Past', 'Following'];
const onlyFollowing = (t: TournamentListItem) => t.myRoles.length > 0 && t.myRoles.every((r) => r === 'follower');
const sectionOf = (t: TournamentListItem) => (onlyFollowing(t) ? 3 : (SECTION_ORDER[t.status] ?? 1));

/** "12 Oct – 20 Oct 2026", or null for tournaments from before dates existed. */
function dateRange(t: TournamentListItem): string | null {
  if (!t.startDate || !t.endDate) return null;
  const day = (v: string, year: boolean) => {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) });
  };
  return t.startDate === t.endDate ? day(t.startDate, true) : `${day(t.startDate, t.startDate.slice(0, 4) !== t.endDate.slice(0, 4))} – ${day(t.endDate, true)}`;
}

// "owner", "scorer · player", "player" — what I am in it, from the server's myRoles. Lower case: it
// ends a card's line of context ("1–10 Nov, owner · player") in both themes.
const roleOf = (t: TournamentListItem) => {
  if (onlyFollowing(t)) return 'following';
  const parts = [t.myRoles.includes('owner') ? 'owner' : t.myRoles.includes('scorer') ? 'scorer' : null, t.myRoles.includes('player') ? 'player' : null];
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
  const { rootRef: keyboardRootRef, scrollRef: keyboardScrollRef, room: keyboardRoom, onScroll: onKeyboardScroll } = useKeyboardRoom<FlatList<TournamentListItem>>();
  const theme = useSportTheme();
  const { ready, baseUrl } = useServer();
  const { session } = useSessionState();

  const fetcher = useCallback(
    // baseUrl is a dependency on purpose: a new server address means a fresh list.
    () => (baseUrl ? api.call<TournamentListItem[]>('TOURNAMENT_LIST') : Promise.reject(new NetworkError('(no server set)'))),
    [baseUrl],
  );
  const list = useQuery(fetcher, { enabled: ready });
  const action = useAction();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  // Glass: the new-tournament form opens in a sheet from the floating + button.
  const [creating, setCreating] = useState(false);

  const all = list.data ?? [];
  const mine = all.filter((t) => t.sport === sport).sort((a, b) => sectionOf(a) - sectionOf(b));
  const online = !!list.data && !(list.error instanceof NetworkError);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your tournament a name first.');
      return;
    }
    const res = await action.run(() =>
      // Dates come later, with the schedule, once the teams are known.
      api.call<{ id: number; name: string }>('TOURNAMENT_CREATE', { body: { name: trimmed, sport } }),
    );
    if (!res.ok) return;
    haptic.success();
    setName('');
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
  const light = theme.mode === 'light';

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

  // The light theme's home ("B · Sight-screen"): no panels — a quiet top row, the sports as
  // underlined tabs, figures in a strip of hairlines, a line to write the new name on, and rows.
  const lightHeader = (
    <View style={{ gap: space.xl + 4, marginBottom: space.sm }}>
      <View style={styles.lightTop}>
        <PressableScale
          onPress={() => router.push('/server')}
          style={styles.lightOnline}
          accessibilityLabel={`Server ${online ? 'connected' : 'not connected'}, ${baseUrl || 'not set'}. ${SERVER_ACTION_LABEL}`}
        >
          <View style={[styles.dot, { width: 7, height: 7, backgroundColor: online ? theme.success : theme.danger }]} />
          <Text style={[type.body, { color: theme.muted }]}>{online ? 'Online' : 'Server'}</Text>
        </PressableScale>
        <NotificationBell style={styles.iconButton} />
        <PressableScale
          onPress={() => router.push('/profile')}
          style={styles.iconButton}
          accessibilityLabel={`Your profile, signed in as ${session?.user.name ?? 'you'}`}
        >
          <Icon name="account-circle-outline" size={24} color={theme.ink} />
        </PressableScale>
      </View>

      <View style={{ gap: space.lg + 2 }}>
        <Text style={[type.title, styles.lightTitle, { color: theme.ink }]} accessibilityRole="header">
          Your tournaments
        </Text>
        <SegmentedControl
          variant="tabs"
          accessibilityLabel="Sport"
          segments={SPORTS.map((s) => ({
            key: s.key,
            label: s.label,
            badge: list.data ? all.filter((t) => t.sport === s.key).length : undefined,
          }))}
          value={sport}
          onChange={onSport}
        />
      </View>

      <UpdateBanner />

      {list.data && (
        <View style={[styles.lightTiles, { borderColor: theme.cardDivider }]}>
          <Tile value={mine.length} label="Tournaments" />
          <Tile value={mine.filter((t) => t.status === 'Live').length} label="In play" accent divided />
          <Tile value={mine.filter((t) => t.status === 'Upcoming').length} label="Upcoming" />
        </View>
      )}

      <ErrorBanner
        message={error?.message}
        actionLabel={error instanceof NetworkError ? SERVER_ACTION_LABEL : 'Try again'}
        onAction={error instanceof NetworkError ? () => router.push('/server') : list.refresh}
      />

      <View style={{ gap: space.sm }}>
        <Text style={[type.eyebrow, { color: theme.muted }]} nativeID="new-tournament-label">
          New {theme.label.toLowerCase()} tournament
        </Text>
        <View style={[styles.lightField, { borderBottomColor: nameError ? theme.warnInk : theme.fieldBorder }]}>
          {nameInput}
          <PressableScale
            onPress={create}
            disabled={action.busy}
            style={[styles.lightCreate, { backgroundColor: theme.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Create tournament"
            accessibilityState={{ busy: action.busy }}
          >
            <Icon name="plus" size={26} color={theme.accentInk} />
          </PressableScale>
        </View>
        {!!nameError && <Text style={[type.caption, { color: theme.warnInk }]}>{nameError}</Text>}
      </View>

      <View>
        <LinkRow icon="account-group-outline" title="Join a team" detail="with a code" onPress={() => router.push('/join')} label="Join a team with a code from its organiser" />
        <LinkRow icon="star-outline" title="Find a tournament" detail="to follow" onPress={() => router.push('/find')} label="Find a public tournament to follow, by name or code" />
        {mine.some((t) => t.myRoles.includes('creator')) && (
          <Text style={[type.caption, { color: theme.muted, marginTop: space.sm }]}>Press and hold one you created to delete it.</Text>
        )}
      </View>
    </View>
  );

  // The glass home ("N · Home"): round glass buttons along the top, the big title, the sports on a
  // glass switch, the counts in one frosted panel spread evenly, then the tournaments. Joining a team
  // follows the list; finding one and starting one float at the bottom, in the thumb zone.
  const header = light ? (
    lightHeader
  ) : (
    <View style={{ gap: space.lg, marginBottom: space.sm }}>
      <View style={styles.glassTop}>
        <PressableScale
          onPress={() => router.push('/server')}
          feel="glass"
          glowRadius={22}
          style={styles.glassChip}
          accessibilityLabel={`Server ${online ? 'connected' : 'not connected'}, ${baseUrl || 'not set'}. ${SERVER_ACTION_LABEL}`}
        >
          <Glass pointerEvents="none" radius={22} interactive style={StyleSheet.absoluteFill} />
          <View style={[styles.dot, { backgroundColor: online ? theme.successInk : theme.danger }]} />
          <Text style={[styles.serverText, { color: theme.onDark }]}>{online ? 'Online' : 'Server'}</Text>
        </PressableScale>
        <View style={{ flex: 1 }} />
        <NotificationBell />
        <PressableScale
          onPress={() => router.push('/profile')}
          feel="glass"
          glowRadius={22}
          style={styles.glassCircle}
          accessibilityLabel={`Your profile, signed in as ${session?.user.name ?? 'you'}`}
        >
          <Glass pointerEvents="none" radius={22} interactive style={StyleSheet.absoluteFill} />
          <Icon name="account-circle-outline" size={22} color={theme.onDark} />
        </PressableScale>
      </View>

      <Text style={[type.title, styles.glassTitle, { color: theme.onDark }]} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
        Your tournaments
      </Text>

      <UpdateBanner />

      <SegmentedControl
        accessibilityLabel="Sport"
        segments={SPORTS.map((s) => ({
          key: s.key,
          label: s.label,
          badge: list.data ? all.filter((t) => t.sport === s.key).length : undefined,
        }))}
        value={sport}
        onChange={onSport}
      />

      {list.data && (
        <Card style={styles.counts}>
          <Tile value={mine.length} label="Tournaments" />
          <Tile value={mine.filter((t) => t.status === 'Live').length} label="In play" />
          <Tile value={mine.filter((t) => t.status === 'Upcoming').length} label="Upcoming" />
        </Card>
      )}

      <ErrorBanner
        message={error?.message}
        actionLabel={error instanceof NetworkError ? SERVER_ACTION_LABEL : 'Try again'}
        onAction={error instanceof NetworkError ? () => router.push('/server') : list.refresh}
      />
    </View>
  );

  const glassFooter = light ? null : (
    <View style={{ gap: space.sm, marginTop: space.md }}>
      {/* Playing rather than organising: the team's code links you to your place in it. */}
      <PressableScale
        onPress={() => router.push('/join')}
        style={[styles.joinRow, { backgroundColor: theme.cream }]}
        accessibilityRole="button"
        accessibilityLabel="Join a team with a code from its organiser"
      >
        <Icon name="account-group-outline" size={22} color={theme.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.lead, { color: theme.onDark }]}>Join a team</Text>
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>Got a code from an organiser?</Text>
        </View>
        <Icon name="chevron-right" size={20} color={theme.onDarkSoft} />
      </PressableScale>
      {mine.some((t) => t.myRoles.includes('creator')) && (
        <Text style={[type.caption, { color: theme.onDarkSoft, paddingHorizontal: space.xs }]}>Press and hold one you created to delete it.</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* iOS: the KeyboardAvoidingView. Android: this (see useKeyboardRoom). */}
      <View ref={keyboardRootRef} style={{ flex: 1, paddingBottom: keyboardRoom }}>
        <Wallpaper />
        <FlatList
          ref={keyboardScrollRef}
          onScroll={onKeyboardScroll}
          scrollEventThrottle={16}
          data={mine}
          keyExtractor={(t) => String(t.id)}
          ListHeaderComponent={header}
          ListFooterComponent={glassFooter}
          contentContainerStyle={{
            paddingTop: insets.top + (light ? space.md : space.sm),
            // Glass: the list ends clear of the floating find / new bar.
            paddingBottom: insets.bottom + (light ? space.xxl : 110),
            paddingHorizontal: light ? space.xl : space.lg,
            gap: light ? 0 : space.sm,
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={theme.accent} colors={[theme.deep]} />
          }
          ListEmptyComponent={
            list.loading ? (
              <Skeleton rows={3} height={112} />
            ) : list.data ? (
              <EmptyState
                icon={sport === 'Cricket' ? 'cricket' : 'soccer'}
                title={`No ${theme.label.toLowerCase()} tournaments`}
                message="Name one above to start, join a team with its code — or ask an organiser to add you using the email you signed in with."
              />
            ) : null
          }
          renderItem={({ item, index }) => (
            <>
              {(index === 0 || sectionOf(mine[index - 1]) !== sectionOf(item)) &&
                (light ? (
                  <Text
                    style={[type.eyebrow, { color: theme.muted, marginTop: index === 0 ? space.md : space.xl, marginBottom: space.xs }]}
                    accessibilityRole="header"
                  >
                    {SECTION_TITLE[sectionOf(item)]}
                  </Text>
                ) : (
                  <Text
                    style={[type.bodyStrong, { color: theme.onDarkSoft, marginTop: index === 0 ? space.xs : space.md, marginLeft: space.lg }]}
                    accessibilityRole="header"
                  >
                    {SECTION_TITLE[sectionOf(item)]}
                  </Text>
                ))}
              <TournamentCard item={item} onOpen={() => open(item)} onDelete={item.myRoles.includes('creator') ? () => remove(item) : undefined} />
            </>
          )}
        />

        {!light && (
          <View style={[styles.dock, { bottom: insets.bottom + space.md }]} pointerEvents="box-none">
            <PressableScale
              onPress={() => router.push('/find')}
              feel="glass"
              glowRadius={27}
              style={styles.findCapsule}
              accessibilityRole="button"
              accessibilityLabel="Find a public tournament to follow, by name or code"
            >
              <Glass floating pointerEvents="none" radius={27} interactive style={StyleSheet.absoluteFill} />
              <Icon name="magnify" size={22} color={theme.onDarkSoft} />
              <Text style={[type.body, { color: theme.onDarkSoft, flex: 1 }]}>Find a tournament</Text>
            </PressableScale>
            <PressableScale
              onPress={() => setCreating(true)}
              feel="glass"
              glowRadius={27}
              style={styles.newButton}
              accessibilityRole="button"
              accessibilityLabel={`New ${theme.label.toLowerCase()} tournament`}
            >
              <Glass tinted pointerEvents="none" radius={27} interactive style={StyleSheet.absoluteFill} />
              <Icon name="plus" size={28} color={theme.accentInk} />
            </PressableScale>
          </View>
        )}
      </View>

      {!light && (
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
          <Text style={[type.label, { color: theme.onDarkSoft }]} nativeID="new-tournament-label">
            Name
          </Text>
          {nameInput}
          {!!nameError && <Text style={[type.caption, { color: theme.warnInk }]}>{nameError}</Text>}
          <ErrorBanner message={action.error?.message} />
        </Sheet>
      )}
    </KeyboardAvoidingView>
  );
}

/** A row on the light home: icon, what it is, a muted word of context, a chevron. */
function LinkRow({ icon, title, detail, onPress, label }: { icon: IconName; title: string; detail: string; onPress: () => void; label: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.lightLink, { borderBottomColor: theme.cardDivider }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon name={icon} size={22} color={theme.deep} />
      <Text style={[type.body, { flex: 1, fontSize: 16, color: theme.ink }]}>
        {title} <Text style={{ color: theme.muted }}>{detail}</Text>
      </Text>
      <Icon name="chevron-right" size={20} color={theme.muted} />
    </PressableScale>
  );
}

function Tile({ value, label, accent, divided }: { value: number; label: string; accent?: boolean; divided?: boolean }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  if (theme.mode === 'light') {
    return (
      <View
        style={[styles.lightTile, divided && { borderLeftWidth: 1, borderRightWidth: 1, borderColor: theme.cardDivider }]}
        accessible
        accessibilityLabel={`${value} ${label}`}
      >
        <Text style={[type.figure, { color: accent ? theme.deep : theme.ink, fontSize: 34, lineHeight: 40 }]}>{value}</Text>
        <Text style={[type.caption, { color: theme.muted }]}>{label}</Text>
      </View>
    );
  }
  // Glass: one of three equal columns in the counts panel.
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[type.figure, { color: theme.onDark, fontSize: 26, lineHeight: 32 }]}>{value}</Text>
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>{label}</Text>
    </View>
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
    const context = [status.label, dateRange(item) ?? `created ${relativeDate(item.createdAt)}`, roleOf(item)].filter(Boolean).join(', ');
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
      <View style={{ flex: 1, gap: 3 }}>
        <StatusChip label={status.label} tone={status.tone} />
        <Text style={[type.lead, { color: theme.ink }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]}>
          {dateRange(item) ?? `Created ${relativeDate(item.createdAt)}`}
          {roleOf(item) ? `, ${roleOf(item)}` : ''}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color={theme.muted} />
    </PressableScale>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  // The glass home.
  glassTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.xs },
  glassChip: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 44, borderRadius: 22, paddingHorizontal: space.md },
  glassCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  glassTitle: { fontSize: 34, lineHeight: 41, marginTop: space.xs, marginLeft: space.xs },
  counts: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: space.sm, gap: 0 },
  joinRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, borderRadius: radius.glass, borderCurve: 'continuous', paddingHorizontal: space.lg, paddingVertical: space.sm },
  dock: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  findCapsule: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 54, borderRadius: 27, paddingHorizontal: 18 },
  newButton: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  serverText: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  tile: { flex: 1, alignItems: 'center', gap: 2 },
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
  lightTop: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  lightOnline: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, alignSelf: 'flex-start' },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 0, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  lightTitle: { fontSize: 36, lineHeight: 42, letterSpacing: -0.6 },
  lightTiles: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1 },
  lightTile: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  lightField: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: 1, paddingBottom: space.sm },
  lightInput: { flex: 1, minWidth: 0, minHeight: 44, fontFamily: fonts.body, fontSize: 18, paddingHorizontal: 0 },
  lightCreate: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  lightLink: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, borderBottomWidth: 1 },
  lightRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
  lightMarker: { width: 10, height: 10, borderRadius: 5 },
  lightMarkerRing: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginHorizontal: -5 },
});
