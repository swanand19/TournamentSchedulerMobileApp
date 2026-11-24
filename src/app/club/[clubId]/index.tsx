import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Club, ClubPlayer, ClubSquadQuestion, ClubTournament } from '@/api/types';
import { JerseyBadge, PhotoBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import HeaderButton from '@/components/HeaderButton';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import UnderlineTabs from '@/components/UnderlineTabs';
import Wallpaper from '@/components/Wallpaper';
import ClubPlayerSheet from '@/features/clubs/ClubPlayerSheet';
import ClubSquadSheet from '@/features/clubs/ClubSquadSheet';
import { useAction } from '@/hooks/useAction';
import { useQuery, type Query } from '@/hooks/useQuery';
import { describeCricketer } from '@/lib/cricketLabels';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { SportThemeProvider, useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { lip, radius, space, type Typography } from '@/theme/theme';

// A lasting team's page (step 2 of docs/reusable-teams-plan.md; people see "team", the API says club). Boards
// Club-Page and Club-Page-Players: the logo, name, who runs it and its totals, then two tabs (C-12) — Tournaments
// (being played, still to play, played, each with its own result) and Players (with the team's join code for its
// admins). "Add player" stays pinned at the bottom while the list scrolls under it (C-19). Anyone signed in may look
// (C-15); only its admins change it, and the server says who they are (`canManage`). "Enter a tournament" (step 3) is
// pinned on the Tournaments tab; a change that touches live squads comes back with `question` (step 4), asked in one
// sheet, as does the "joined" notification (`ask` = the club player).

type Tab = 'tournaments' | 'players';

export default function ClubScreen() {
  const { clubId, sport, tab, ask } = useLocalSearchParams<{ clubId: string; sport?: string; tab?: string; ask?: string }>();
  const fetcher = useCallback(() => api.call<Club>('CLUB_GET', { routeParams: { clubId: Number(clubId) } }), [clubId]);
  const club = useQuery(fetcher);
  return (
    <SportThemeProvider sport={club.data?.sport ?? sport ?? 'Cricket'}>
      <ClubView query={club} initialTab={tab === 'players' || ask ? 'players' : 'tournaments'} ask={ask ? Number(ask) : null} />
    </SportThemeProvider>
  );
}

function ClubView({ query, initialTab, ask }: { query: Query<Club>; initialTab: Tab; ask: number | null }) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const light = theme.mode === 'light';
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sheet, setSheet] = useState<{ open: boolean; player: ClubPlayer | null; key: number }>({ open: false, player: null, key: 0 });
  const codeAction = useAction();
  const leaveAction = useAction();
  // A change answers the whole team: put it on screen at once.
  const c = query.data;
  const [question, setQuestion] = useState<{ q: ClubSquadQuestion; key: number } | null>(null);
  const reloaded = (next: Club) => {
    query.setData(next);
    if (next.question && next.question.live.length > 0) setQuestion((s) => ({ q: next.question!, key: (s?.key ?? 0) + 1 }));
  };

  // From the "joined" notification: the live tournaments that player could join, once, for the team's admins.
  const asked = useRef(false);
  useEffect(() => {
    if (ask == null || asked.current || !c?.canManage) return;
    asked.current = true;
    api
      .call<ClubSquadQuestion>('CLUB_SQUADS_PREVIEW', { routeParams: { clubId: c.clubId, clubPlayerId: ask } })
      .then((q) => q.live.length > 0 && setQuestion({ q, key: 1 }))
      .catch(() => {});
  }, [ask, c?.canManage, c?.clubId]);

  const openPlayer = (player: ClubPlayer | null) => setSheet((s) => ({ open: true, player, key: s.key + 1 }));

  const me = c?.players.find((p) => p.isMe);
  const canSettings = !!c && (c.canManage || !!me);

  // The invite link when the server has one (2026-11-23): one tap joins, after signing in or up. Otherwise the code.
  const shareCode = (code: string) =>
    Share.share({
      message: c?.invite?.url
        ? `Join ${c.name} on KickCricket: ${c.invite.url}`
        : `Join ${c?.name} on KickCricket: open the app, tap "Join a team" and enter ${code}.`,
    });

  const newCode = async () => {
    if (!c) return;
    const ok = await confirm({
      title: 'Make a new invite link?',
      message: `The old link and code for ${c.name} stop working. Everyone already in the team stays.`,
      confirmLabel: 'New link',
    });
    if (!ok) return;
    const res = await codeAction.run(() => api.call<Club>('CLUB_JOIN_CODE_RESET', { routeParams: { clubId: c.clubId } }));
    if (res.ok) {
      haptic.success();
      reloaded(res.value);
    }
  };

  const leave = async (place: ClubPlayer) => {
    if (!c) return;
    const ok = await confirm({
      title: `Leave ${c.name}?`,
      message: 'Tournaments you have played for it stay as they were.',
      confirmLabel: 'Leave team',
      destructive: true,
    });
    if (!ok) return;
    const res = await leaveAction.run(() => api.call<Club>('CLUB_PLAYER_REMOVE', { routeParams: { clubId: c.clubId, clubPlayerId: place.clubPlayerId } }));
    if (res.ok) {
      haptic.heavy();
      reloaded(res.value);
    }
  };

  const openTournament = (t: ClubTournament) =>
    router.push({ pathname: '/tournament/[id]', params: { id: String(t.tournamentId), name: t.name, sport: t.sport } });

  const admins = c?.admins.map((a) => a.name) ?? [];
  const runBy = admins.length === 0 ? null : `Run by ${admins.length === 1 ? admins[0] : `${admins.slice(0, -1).join(', ')} and ${admins[admins.length - 1]}`}`;
  const sections: { key: ClubTournament['section']; title: string }[] = [
    { key: 'live', title: 'Being played' },
    { key: 'upcoming', title: 'Still to play' },
    { key: 'past', title: 'Played' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: light ? (c?.name ?? '') : '',
          headerStyle: { backgroundColor: light ? theme.deck : 'transparent' },
          headerTintColor: light ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: light ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          headerBackButtonDisplayMode: 'minimal',
          headerRight: canSettings
            ? () => (
                <HeaderButton
                  icon="dots-horizontal"
                  label="Team settings"
                  onPress={() => router.push({ pathname: '/club/[clubId]/settings', params: { clubId: String(c!.clubId), sport: c!.sport } })}
                />
              )
            : undefined,
        }}
      />
      <Wallpaper underHeader />
      <Screen
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        error={c ? null : query.error}
        onRetry={query.refresh}
        footer={
          c && c.canManage ? (
            tab === 'players' ? (
              <Button label="Add player" icon="account-plus" size="lg" onPress={() => openPlayer(null)} />
            ) : (
              <Button
                label="Enter a tournament"
                icon="trophy-outline"
                size="lg"
                onPress={() => router.push({ pathname: '/club/[clubId]/enter', params: { clubId: String(c.clubId), sport: c.sport } })}
              />
            )
          ) : undefined
        }
      >
        {!c ? (
          query.loading ? <Skeleton rows={5} height={72} /> : null
        ) : (
          <>
            <View style={styles.head}>
              <PhotoBadge link={c.logoUrl} name={c.name} size={64} square />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.eyebrow, { color: light ? theme.muted : theme.onDarkSoft }]}>
                  {[`${theme.label} team`, c.area].filter(Boolean).join(' · ')}
                </Text>
                <Text style={[styles.name, { color: theme.onDark }]} accessibilityRole="header" numberOfLines={2}>
                  {c.name}
                </Text>
              </View>
            </View>
            {runBy && <Text style={[type.body, { color: light ? theme.muted : theme.onDarkSoft, marginTop: -space.sm }]}>{runBy}</Text>}

            <Card style={styles.tiles}>
              <Tile value={c.totals.tournaments} label={c.totals.tournaments === 1 ? 'Tournament' : 'Tournaments'} wide />
              <Tile value={c.totals.matches} label={c.totals.matches === 1 ? 'Match' : 'Matches'} />
              <Tile value={c.totals.won} label="Won" />
              <Tile value={c.totals.titles} label={c.totals.titles === 1 ? 'Title' : 'Titles'} />
            </Card>

            <UnderlineTabs
              tabs={[
                { key: 'tournaments', label: `Tournaments · ${c.tournaments.length}` },
                { key: 'players', label: `Players · ${c.players.length}` },
              ]}
              value={tab}
              onChange={(next: Tab) => {
                haptic.select();
                setTab(next);
              }}
            />

            {tab === 'tournaments' ? (
              c.tournaments.length === 0 ? (
                <EmptyState
                  icon="trophy-outline"
                  title="No tournaments yet"
                  message={
                    c.canManage
                      ? `Ask an organiser for their tournament's entry code, then tap Enter a tournament.`
                      : `When ${c.name} plays in a tournament, it shows here with its result.`
                  }
                />
              ) : (
                sections.map((s) => {
                  const rows = c.tournaments.filter((t) => t.section === s.key);
                  if (rows.length === 0) return null;
                  return (
                    <View key={s.key} style={{ gap: space.sm }}>
                      <Text style={[type.eyebrow, { color: light ? theme.muted : theme.onDarkSoft }]} accessibilityRole="header">
                        {s.title} · {rows.length}
                      </Text>
                      {rows.map((t) => (
                        <TournamentRow
                          key={`${t.tournamentId}-${t.entryId ?? 0}`}
                          t={t}
                          onPress={
                            t.entryId != null
                              ? () => router.push({ pathname: '/club/[clubId]/enter', params: { clubId: String(c.clubId), sport: c.sport, entryId: String(t.entryId) } })
                              : t.canOpen
                                ? () => openTournament(t)
                                : undefined
                          }
                        />
                      ))}
                    </View>
                  );
                })
              )
            ) : (
              <>
                {me && !c.canManage && (
                  <Card>
                    <ErrorBanner message={leaveAction.error?.message} />
                    <Text style={[type.headline, { color: theme.ink }]}>You play for {c.name}</Text>
                    <Text style={[type.caption, { color: theme.muted }]}>Not playing for it any more? Leave the team; its past tournaments keep your name.</Text>
                    <Button label="Leave team" variant="secondary" icon="account-remove-outline" onPress={() => leave(me)} busy={leaveAction.busy} />
                  </Card>
                )}
                {c.players.length === 0 ? (
                  <EmptyState
                    icon="account-multiple-plus"
                    title="No players yet"
                    message={c.canManage ? 'Add the players, or share the join code below so they add themselves.' : 'Its admins haven’t added anyone yet.'}
                  />
                ) : (
                  c.players.map((p) => (
                    <PlayerRow key={p.clubPlayerId} p={p} sport={c.sport} onPress={c.canManage ? () => openPlayer(p) : undefined} />
                  ))
                )}
                {c.canManage && c.joinCode && (
                  <Card style={light ? [styles.lightCodePanel, { borderColor: theme.ring }] : undefined}>
                    <ErrorBanner message={codeAction.error?.message} />
                    <Text style={[type.label, { color: theme.muted }]}>Players join with</Text>
                    <Text style={[styles.code, { color: theme.ink }]} selectable accessibilityLabel={`Join code ${c.joinCode.split('').join(' ')}`}>
                      {c.joinCode}
                    </Text>
                    <Text style={[type.caption, { color: theme.muted }]}>
                      {c.invite?.url
                        ? 'Share the invite link: whoever opens it joins. Or they enter the code under “Join a team”.'
                        : 'They enter it under “Join a team”, then pick their name — or join as new.'}
                    </Text>
                    {c.invite && <Text style={[type.caption, { color: theme.muted }]}>{c.invite.note}</Text>}
                    <View style={styles.codeActions}>
                      <Button label={c.invite?.url ? 'Share invite link' : 'Share'} icon="share-variant" onPress={() => shareCode(c.joinCode!)} style={{ flex: 2 }} />
                      <Button label={c.invite?.url ? 'New link' : 'New code'} variant="secondary" onPress={newCode} busy={codeAction.busy} style={{ flex: 1 }} />
                    </View>
                  </Card>
                )}
              </>
            )}

            <ClubPlayerSheet
              key={`player-${sheet.key}`}
              visible={sheet.open}
              onClose={() => setSheet((s) => ({ ...s, open: false }))}
              onSaved={reloaded}
              club={c}
              player={sheet.player}
            />
            <ClubSquadSheet key={`squad-${question?.key ?? 0}`} club={c} question={question?.q ?? null} onClose={() => setQuestion(null)} onSaved={(next) => query.setData(next)} />
          </>
        )}
      </Screen>
    </View>
  );
}

/** One total. `wide` gives "Tournaments" the room it needs beside three short words. */
function Tile({ value, label, wide }: { value: number; label: string; wide?: boolean }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return (
    <View style={{ flex: wide ? 1.5 : 1, alignItems: 'center', gap: 2, paddingVertical: space.sm }} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[type.figure, { color: theme.ink, fontSize: 24, lineHeight: 30 }]}>{value}</Text>
      <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TournamentRow({ t, onPress }: { t: ClubTournament; onPress?: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${t.name}${t.teamName !== '' ? `, as ${t.teamName}` : ''}. ${t.line}`}
      accessibilityHint={onPress ? (t.entryId != null ? 'Opens the entry' : 'Opens the tournament') : undefined}
      style={light ? [styles.lightRow, { borderBottomColor: theme.cardDivider }] : [styles.row, { backgroundColor: theme.cream }, lip(theme)]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={2}>
          {t.name}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]}>{t.line}</Text>
      </View>
      {t.entryId != null ? (
        <View style={[styles.tag, { backgroundColor: theme.tint }]}>
          <Icon name="clock-outline" size={14} color={light ? theme.deep : theme.accent} />
          <Text style={[type.label, { color: light ? theme.deep : theme.accent }]}>Waiting</Text>
        </View>
      ) : t.section === 'live' ? (
        <StatusChip label="In play" tone="live" />
      ) : t.champion ? (
        <View style={[styles.tag, { backgroundColor: theme.tint }]}>
          <Icon name="trophy" size={14} color={light ? theme.deep : theme.accent} />
          <Text style={[type.label, { color: light ? theme.deep : theme.accent }]}>Won</Text>
        </View>
      ) : null}
      {onPress && <Icon name="chevron-right" size={20} color={theme.muted} />}
    </PressableScale>
  );
}

function PlayerRow({ p, sport, onPress }: { p: ClubPlayer; sport: 'Football' | 'Cricket'; onPress?: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  const detail = sport === 'Cricket' ? describeCricketer(p.cricket) || 'Role not set' : p.position || 'No position set';
  return (
    <PressableScale
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${p.jerseyNumber != null ? `Number ${p.jerseyNumber}, ` : ''}${p.name}${p.isCaptain ? ', captain' : ''}${p.isAdmin ? ', runs the team' : ''}`}
      accessibilityHint={onPress ? 'Edit player' : undefined}
      style={light ? [styles.lightRow, { borderBottomColor: theme.cardDivider }] : [styles.row, { backgroundColor: theme.cream }, lip(theme)]}
    >
      {p.photoUrl ? <PhotoBadge link={p.photoUrl} name={p.name} size={40} /> : <JerseyBadge number={p.jerseyNumber} size={40} highlight={p.isCaptain} />}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.nameRow}>
          <Text style={[styles.player, { color: theme.ink }]} numberOfLines={1}>
            {p.name}
          </Text>
          {p.isMe ? (
            <View style={[styles.tag, { backgroundColor: theme.accent }]}>
              <Text style={[type.label, { color: theme.accentInk }]}>You</Text>
            </View>
          ) : p.isLinked ? (
            <Icon name="account-check" size={18} color={theme.successInk} label="On the app" />
          ) : null}
        </View>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
          {[p.jerseyNumber != null && p.photoUrl ? `#${p.jerseyNumber}` : null, detail, p.isWaiting ? 'waiting for sign-up' : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      {(p.isCaptain || p.isAdmin) && (
        <View style={[styles.tag, { backgroundColor: theme.tint }]}>
          <Text style={[type.label, { color: light ? theme.deep : theme.accent }]}>{p.isCaptain ? 'Captain' : 'Admin'}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33 },
  tiles: { flexDirection: 'row', paddingVertical: space.xs, paddingHorizontal: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 64 },
  lightRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, minHeight: 60, borderBottomWidth: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  player: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21, flexShrink: 1 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  code: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, letterSpacing: 5 },
  codeActions: { flexDirection: 'row', gap: space.sm },
  lightCodePanel: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, paddingHorizontal: space.lg, paddingBottom: space.lg },
});
