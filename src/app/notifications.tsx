import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { AppNotification, NotificationKind, NotificationPage, UnreadCount } from '@/api/types';
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
// Newest first, a page at a time. Tapping one marks it read and opens what it's about.

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
};

export default function NotificationsScreen() {
  const router = useRouter();
  const action = useAction();

  const fetcher = useCallback(() => api.call<NotificationPage>('NOTIFICATION_LIST'), []);
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
    const res = await action.run(() => api.call<NotificationPage>('NOTIFICATION_LIST', { query: { before } }));
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
    if (n.tournamentId == null) return;
    const id = String(n.tournamentId);
    if (n.matchId != null && n.sport === 'Cricket')
      router.push({ pathname: '/tournament/[id]/cricket/[matchId]/live', params: { id, matchId: String(n.matchId), sport: n.sport } });
    else if (n.matchId != null && n.sport === 'Football')
      router.push({ pathname: '/tournament/[id]/football/[matchId]/live', params: { id, matchId: String(n.matchId), sport: n.sport } });
    else router.push({ pathname: '/tournament/[id]', params: n.sport ? { id, sport: n.sport } : { id } });
  };

  return (
    <Screen onRefresh={first.refresh} refreshing={first.refreshing} error={first.error} onRetry={first.refresh}>
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
          message="You'll hear here when someone asks to take over your scoring, adds you to a tournament or a team, or a tournament of yours needs finishing."
        />
      ) : (
        <>
          {unread > 0 && (
            <Button label="Mark all as read" icon="check-all" variant="ghost" size="sm" busy={action.busy} onPress={readAll} />
          )}
          <View style={{ gap: space.sm }}>
            {items.map((n) => (
              <Row key={n.notificationId} item={n} read={isRead(n)} onPress={() => open(n)} />
            ))}
          </View>
          {hasMore && <Button label="Show older" variant="ghost" busy={action.busy} onPress={loadOlder} />}
        </>
      )}
    </Screen>
  );
}

function Row({ item, read, onPress }: { item: AppNotification; read: boolean; onPress: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const opens = item.tournamentId != null;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${read ? '' : 'Unread. '}${item.title}. ${item.body} ${relativeDate(item.createdAt)}`}
      accessibilityHint={opens ? (item.matchId != null ? 'Opens the match' : 'Opens the tournament') : undefined}
      style={[styles.row, { backgroundColor: read ? theme.chip : theme.cream }, lip(theme)]}
    >
      <View style={[styles.icon, { backgroundColor: read ? theme.cream : theme.tint }]}>
        <Icon name={ICONS[item.kind] ?? 'bell-outline'} size={20} color={theme.deep} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[read ? type.body : type.bodyStrong, { color: theme.ink }]}>{item.title}</Text>
        <Text style={[type.caption, { color: theme.muted }]}>{item.body}</Text>
        <Text style={[type.caption, { color: theme.muted }]}>{relativeDate(item.createdAt)}</Text>
      </View>
      {!read && <View style={[styles.dot, { backgroundColor: theme.accent }]} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, borderRadius: radius.lg, padding: space.md, minHeight: 56 },
  icon: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
});
