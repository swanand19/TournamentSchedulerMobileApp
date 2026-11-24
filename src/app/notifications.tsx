import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { AppNotification, NotificationCategory, NotificationKind, NotificationPage, UnreadCount } from '@/api/types';
import { FollowButton } from '@/features/people/PeopleParts';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import { SkeletonBlock } from '@/components/Skeleton';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { relativeDate } from '@/lib/format';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { lip, radius, space } from '@/theme/theme';

// The inbox (phase 6D): what happened that concerns you — scoring handovers, being added to a
// tournament or a team, invites taken up, a tournament ready to complete or reaching its end date.
// Newest first, a page at a time. Tapping one marks it read and opens what it's about. Chips (2026-11-23): All ·
// Social · Scoring · Tournaments · Teams, each with its unread count; Social is following news — someone followed you
// (Follow back) or someone you follow is playing a match you can watch (Watch live).

type Chip = 'All' | NotificationCategory;
const CHIPS: Chip[] = ['All', 'Social', 'Scoring', 'Tournaments', 'Teams'];

const ICONS: Record<NotificationKind, IconName> = {
  ScoringRequested: 'hand-back-right-outline',
  ScoringAllowed: 'check-circle-outline',
  ScoringDeclined: 'close-circle-outline',
  ScoringTakenOver: 'account-switch-outline',
  AddedToTournament: 'account-plus-outline',
  InviteAccepted: 'email-check-outline',
  LinkedToTeam: 'tshirt-crew-outline',
  AllMatchesPlayed: 'flag-checkered',
  EndDateReminder: 'calendar-clock',
  Auction: 'gavel',
  Draw: 'shuffle-variant',
  Club: 'account-group-outline',
  Social: 'account-heart-outline',
  League: 'trophy-outline',
};

/** Where a match's viewer is: someone you follow playing opens it to watch, never to score. */
const watchRoute = (n: AppNotification) => ({
  pathname: n.sport === 'Cricket' ? ('/tournament/[id]/cricket/[matchId]/watch' as const) : ('/tournament/[id]/football/[matchId]/watch' as const),
  params: { id: String(n.tournamentId), matchId: String(n.matchId), sport: n.sport ?? 'Football' },
});

export default function NotificationsScreen() {
  const router = useRouter();
  const action = useAction();

  const [chip, setChip] = useState<Chip>('All');
  const category = chip === 'All' ? undefined : chip;
  const fetcher = useCallback(() => api.call<NotificationPage>('NOTIFICATION_LIST', { query: { category } }), [category]);
  const first = useQuery(fetcher);
  // Older pages, loaded on request; a reload of the first page starts the list again.
  const [older, setOlder] = useState<{ after: number; items: AppNotification[]; hasMore: boolean } | null>(null);
  // Marked read here before the server answers, so a row dims the moment it's tapped.
  const [readHere, setReadHere] = useState<Set<number>>(new Set());

  const page = first.data;
  const firstLast = page?.items.at(-1)?.notificationId;
  const extra = older && older.after === firstLast ? older : null;
  const items = page ? [...page.items, ...(extra?.items ?? [])] : [];
  const hasMore = extra ? extra.hasMore : !!page?.hasMore;
  const isRead = (n: AppNotification) => n.isRead || readHere.has(n.notificationId);
  const unread = items.filter((n) => !isRead(n)).length;

  const loadOlder = async () => {
    const before = items.at(-1)?.notificationId;
    if (before == null || firstLast == null) return;
    const res = await action.run(() => api.call<NotificationPage>('NOTIFICATION_LIST', { query: { before, category } }));
    if (res.ok)
      setOlder({ after: firstLast, items: [...(extra?.items ?? []), ...res.value.items], hasMore: res.value.hasMore });
  };

  const readAll = async () => {
    const res = await action.run(() => api.call<UnreadCount>('NOTIFICATION_READ_ALL'));
    if (res.ok) setReadHere(new Set(items.map((n) => n.notificationId)));
  };

  const open = (n: AppNotification) => {
    if (!isRead(n)) {
      setReadHere((s) => new Set(s).add(n.notificationId));
      // Not waited for: opening shouldn't hang on it, and the bell recounts when Home is back.
      api.call('NOTIFICATION_READ', { routeParams: { notificationId: n.notificationId } }).catch(() => {});
    }
    // Someone followed you: their profile.
    if (n.profileUserId != null) {
      router.push({ pathname: '/profile', params: { userId: String(n.profileUserId) } });
      return;
    }
    // Someone you follow is playing: the match, to watch.
    if (n.kind === 'Social' && n.matchId != null && n.tournamentId != null) {
      router.push(watchRoute(n));
      return;
    }
    // A league you were made an organiser of: its page.
    if (n.leagueId != null) {
      router.push({ pathname: '/league/[leagueId]', params: { leagueId: String(n.leagueId) } });
      return;
    }
    // A lasting team (people see "team"): its page.
    if (n.clubId != null) {
      // Someone joined with the code: the page opens on the question about live tournaments for them.
      const params = n.clubPlayerId != null ? { clubId: String(n.clubId), ask: String(n.clubPlayerId) } : { clubId: String(n.clubId) };
      router.push({ pathname: '/club/[clubId]', params });
      return;
    }
    if (n.tournamentId == null) return;
    const id = String(n.tournamentId);
    // A lasting team asks to enter: the tournament's teams, where the entries wait.
    if (n.kind === 'Club' && n.teamId == null) {
      router.push({ pathname: '/tournament/[id]/teams', params: n.sport ? { id, sport: n.sport } : { id } });
      return;
    }
    // "Keep this team?": the team's page in its tournament, with the question open.
    if (n.teamId != null) {
      router.push({ pathname: '/tournament/[id]/team/[teamId]', params: { id, teamId: String(n.teamId), keep: '1' } });
      return;
    }
    if (n.matchId != null && n.sport === 'Cricket')
      router.push({ pathname: '/tournament/[id]/cricket/[matchId]/live', params: { id, matchId: String(n.matchId), sport: n.sport } });
    else if (n.matchId != null && n.sport === 'Football')
      router.push({ pathname: '/tournament/[id]/football/[matchId]/live', params: { id, matchId: String(n.matchId), sport: n.sport } });
    else router.push({ pathname: '/tournament/[id]', params: n.sport ? { id, sport: n.sport } : { id } });
  };

  const counts = page?.unreadByCategory;
  return (
    <Screen onRefresh={first.refresh} refreshing={first.refreshing} error={first.error} onRetry={first.refresh}>
      <Chips value={chip} onChange={setChip} counts={counts ? { All: page!.unreadCount, ...counts } : null} />
      <ErrorBanner message={action.error?.message} />

      {!page ? (
        first.error ? null : (
          <View style={{ gap: space.sm }}>
            <SkeletonBlock />
            <SkeletonBlock />
            <SkeletonBlock />
          </View>
        )
      ) : items.length === 0 ? (
        <EmptyState
          icon="bell-outline"
          title="Nothing yet"
          message={
            chip === 'Social'
              ? 'When someone follows you, or someone you follow starts a match you can watch, it shows up here.'
              : "You'll hear here when someone asks to take over your scoring, adds you to a tournament or a team, or a tournament of yours needs finishing."
          }
        />
      ) : (
        <>
          {unread > 0 && (
            <Button label="Mark all as read" icon="check-all" variant="ghost" size="sm" busy={action.busy} onPress={readAll} />
          )}
          <View style={{ gap: space.sm }}>
            {items.map((n) => (
              <Row key={n.notificationId} item={n} read={isRead(n)} showCategory={chip === 'All'} onPress={() => open(n)} onWatch={() => open(n)} />
            ))}
          </View>
          {hasMore && <Button label="Show older" variant="ghost" busy={action.busy} onPress={loadOlder} />}
        </>
      )}
    </Screen>
  );
}

/** The chips, scrolling sideways on a narrow phone; each says how many unread it holds. */
function Chips({ value, onChange, counts }: { value: Chip; onChange: (c: Chip) => void; counts: Record<Chip, number> | null }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
      {CHIPS.map((c) => {
        const on = c === value;
        const n = counts?.[c] ?? 0;
        return (
          <PressableScale
            key={c}
            onPress={() => onChange(c)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${c}${n ? `, ${n} unread` : ''}`}
            style={[styles.chip, { backgroundColor: on ? theme.tint : theme.chip, borderColor: on ? theme.accent : theme.borderOnDark }]}
          >
            <Text style={[on ? type.bodyStrong : type.body, { color: theme.ink }]}>{c}</Text>
            {n > 0 && (
              <View style={[styles.badge, { backgroundColor: on ? theme.accent : theme.cream }]}>
                <Text style={[type.caption, { color: on ? theme.accentInk : theme.ink, fontVariant: ['tabular-nums'] }]}>{n}</Text>
              </View>
            )}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function Row({ item, read, showCategory, onPress, onWatch }: { item: AppNotification; read: boolean; showCategory: boolean; onPress: () => void; onWatch: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const opens = item.tournamentId != null || item.clubId != null || item.profileUserId != null || item.leagueId != null;
  const playing = item.kind === 'Social' && item.matchId != null;
  // The card is the row to tap, with Watch live / Follow back beside it, never inside it (a button can't hold a button).
  return (
    <View style={[styles.card, { backgroundColor: read ? theme.chip : theme.cream }, lip(theme)]}>
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${read ? '' : 'Unread. '}${item.title}. ${item.body} ${relativeDate(item.createdAt)}`}
      accessibilityHint={opens ? (item.leagueId != null ? 'Opens the league' : item.profileUserId != null ? 'Opens their profile' : item.clubId != null || item.teamId != null ? 'Opens the team' : item.matchId != null ? 'Opens the match' : 'Opens the tournament') : undefined}
      style={styles.row}
    >
      <View style={[styles.icon, { backgroundColor: read ? theme.cream : theme.tint }]}>
        <Icon name={playing ? 'run' : (ICONS[item.kind] ?? 'bell-outline')} size={20} color={theme.deep} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        {showCategory && <Text style={[type.label, { color: theme.deep }]}>{item.category}</Text>}
        <Text style={[read ? type.body : type.bodyStrong, { color: theme.ink }]}>{item.title}</Text>
        <Text style={[type.caption, { color: theme.muted }]}>{item.body}</Text>
        <Text style={[type.caption, { color: theme.muted }]}>{relativeDate(item.createdAt)}</Text>
      </View>
      {!read && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
    </PressableScale>
    {(playing || item.profileUserId != null) && (
      <View style={styles.actions}>
        {playing ? (
          <Button label="Watch live" icon="play-circle-outline" size="sm" onPress={onWatch} />
        ) : (
          <FollowButton userId={item.profileUserId!} name={item.title.replace(/ started following you$/, '')} state={{ isFollowing: false, followsMe: true }} />
        )}
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, borderRadius: radius.lg, padding: space.md, minHeight: 56 },
  actions: { flexDirection: 'row', paddingLeft: space.md + 36 + space.md, paddingRight: space.md, paddingBottom: space.md, marginTop: -space.xs },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
