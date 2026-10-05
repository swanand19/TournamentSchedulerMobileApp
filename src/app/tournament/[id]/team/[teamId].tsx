import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Player, Team } from '@/api/types';
import { JerseyBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Sheet from '@/components/Sheet';
import Skeleton from '@/components/Skeleton';
import TextField from '@/components/TextField';
import PlayerSheet from '@/features/teams/PlayerSheet';
import { lineOf, LINES, type Line } from '@/features/teams/positions';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { CRICKET_ROLES, describeCricketer, roleShort } from '@/lib/cricketLabels';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, lip, radius, space, type } from '@/theme/theme';

// A team's squad: who's in it, sorted by shirt number, with a line-count summary on top and a
// filter by position (football) or role (cricket). Owners tap a player to edit, add from the footer,
// and share the team's join code; everyone else sees the squad read-only, and a player can leave
// their own place in it.

type Filter = 'ALL' | Line | string;

export default function TeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const router = useRouter();
  const { id: tournamentId, name: tournamentName, sport, access, closed } = useTournament();
  const canEdit = access.canEdit;
  const theme = useSportTheme();
  const isCricket = sport === 'Cricket';

  const fetcher = useCallback(
    () => api.call<Team>('TEAM_GET', { routeParams: { id: tournamentId, teamId: Number(teamId) } }),
    [tournamentId, teamId],
  );
  const team = useQuery(fetcher);

  const [filter, setFilter] = useState<Filter>('ALL');
  const [sheet, setSheet] = useState<{ open: boolean; player: Player | null; key: number }>({ open: false, player: null, key: 0 });
  const [rename, setRename] = useState({ open: false, key: 0 });

  const openPlayer = (player: Player | null) => setSheet((s) => ({ open: true, player, key: s.key + 1 }));
  const codeAction = useAction();
  const leaveAction = useAction();

  const t = team.data;
  const mine = t?.players.find((p) => p.isMe);

  const shareCode = (code: string) =>
    Share.share({
      message: `Join ${t?.name} in ${tournamentName}: open Tournament Scheduler, tap "Join a team" and enter ${code}.`,
    });

  const newCode = async () => {
    if (!t) return;
    const ok = await confirm({
      title: 'Make a new join code?',
      message: `The old code for ${t.name} stops working. Anyone who already joined stays in the team.`,
      confirmLabel: 'New code',
    });
    if (!ok) return;
    const res = await codeAction.run(() => api.call<Team>('TEAM_JOIN_CODE_RESET', { routeParams: { id: tournamentId, teamId: t.id } }));
    if (res.ok) {
      haptic.success();
      team.reload();
    }
  };

  // A player who picked the wrong name, or no longer plays here. If that was all they were in the
  // tournament, it disappears for them — so go back to the home screen.
  const leaveTeam = async (place: Player) => {
    if (!t) return;
    const ok = await confirm({
      title: `Leave ${t.name}?`,
      message: "Your name stays on the team sheet, but it won't be linked to you any more.",
      confirmLabel: 'Leave team',
      destructive: true,
    });
    if (!ok) return;
    const res = await leaveAction.run(() =>
      api.call('PLAYER_UNLINK', { routeParams: { id: tournamentId, teamId: t.id, playerId: place.id } }),
    );
    if (!res.ok) return;
    haptic.heavy();
    if (access.myRoles.some((r) => r !== 'player')) team.reload();
    else router.dismissTo('/');
  };
  const players = [...(t?.players ?? [])].sort(
    (a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name),
  );

  const groupOf = (p: Player): string | null => (isCricket ? roleShort(p.cricket?.primaryRole) || null : lineOf(p.position));
  const buckets = isCricket
    ? [...new Set(CRICKET_ROLES.map((r) => r.short))]
    : LINES.map((l) => l.key);
  const shown = filter === 'ALL' ? players : players.filter((p) => groupOf(p) === filter);

  return (
    <Screen
      onRefresh={team.refresh}
      refreshing={team.refreshing}
      error={team.error}
      onRetry={team.refresh}
      footer={t && canEdit ? <Button label="Add player" icon="account-plus" size="lg" onPress={() => openPlayer(null)} /> : undefined}
    >
      {!t ? (
        team.loading ? <Skeleton rows={6} /> : null
      ) : (
        <>
          <SectionHeader
            eyebrow={tournamentName}
            title={t.name}
            large
            right={canEdit ? (
              <PressableScale
                onPress={() => setRename((r) => ({ open: true, key: r.key + 1 }))}
                accessibilityLabel={`Rename ${t.name}`}
                style={[styles.iconBtn, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}
              >
                <Icon name="pencil" size={20} color={theme.accent} />
              </PressableScale>
            ) : undefined}
          />

          {/* Owners share this; players type it under "Join a team" and pick their name. */}
          {canEdit && t.joinCode && !closed && (
            <Card>
              <ErrorBanner message={codeAction.error?.message} />
              <Text style={[type.label, { color: theme.muted }]}>Join code</Text>
              <Text
                style={[styles.code, { color: theme.ink }]}
                accessibilityLabel={`Join code ${t.joinCode.split('').join(' ')}`}
                selectable
              >
                {t.joinCode}
              </Text>
              <Text style={[type.caption, { color: theme.muted }]}>
                Players enter it under “Join a team”, then pick their name — or join as a new player.
              </Text>
              <View style={styles.codeActions}>
                <Button label="Share" icon="share-variant" onPress={() => shareCode(t.joinCode!)} style={{ flex: 2 }} />
                <Button label="New code" variant="secondary" onPress={newCode} busy={codeAction.busy} style={{ flex: 1 }} />
              </View>
            </Card>
          )}

          {mine && !canEdit && (
            <Card>
              <ErrorBanner message={leaveAction.error?.message} />
              <Text style={[type.headline, { color: theme.ink }]}>You play for {t.name}</Text>
              <Text style={[type.caption, { color: theme.muted }]}>
                Picked the wrong name, or not playing any more? Leave the team; your name stays on its team sheet.
              </Text>
              {!closed && (
                <Button label="Leave team" variant="secondary" icon="account-remove-outline" onPress={() => leaveTeam(mine)} busy={leaveAction.busy} />
              )}
            </Card>
          )}

          <Card>
            <Text style={[type.label, { color: theme.muted }]}>
              {plural(players.length, 'player')}
              {t.defaultCaptainPlayerId
                ? `, captained by ${players.find((p) => p.id === t.defaultCaptainPlayerId)?.name ?? ''}`
                : ''}
            </Text>
            <View style={styles.counts}>
              {buckets.map((b) => (
                <View key={b} style={[styles.count, { backgroundColor: theme.chip }]} accessible accessibilityLabel={`${players.filter((p) => groupOf(p) === b).length} ${b}`}>
                  <Text style={[type.figure, { color: theme.ink, fontSize: 24, lineHeight: 28 }]}>
                    {players.filter((p) => groupOf(p) === b).length}
                  </Text>
                  <Text style={[type.label, { color: theme.muted }]}>{b}</Text>
                </View>
              ))}
            </View>
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label="All" count={players.length} selected={filter === 'ALL'} onPress={() => setFilter('ALL')} />
            {buckets.map((b) => (
              <Chip key={b} label={b} count={players.filter((p) => groupOf(p) === b).length} selected={filter === b} onPress={() => setFilter(b)} />
            ))}
          </ScrollView>

          {players.length === 0 ? (
            <EmptyState
              icon="account-multiple-plus"
              title="No players yet"
              message={canEdit ? "Add the squad. Shirt numbers make scoring faster — pickers show them first." : "The organisers haven't added anyone yet."}
              actionLabel={canEdit ? "Add player" : undefined}
              onAction={canEdit ? () => openPlayer(null) : undefined}
            />
          ) : (
            shown.map((p) => {
              const captain = t.defaultCaptainPlayerId === p.id;
              const tag = groupOf(p);
              return (
                <PressableScale
                  key={p.id}
                  onPress={() => openPlayer(p)}
                  disabled={!canEdit}
                  accessibilityLabel={`${p.jerseyNumber != null ? `Number ${p.jerseyNumber}, ` : ''}${p.name}${captain ? ', captain' : ''}`}
                  accessibilityHint={canEdit ? "Edit player" : undefined}
                  style={[styles.row, { backgroundColor: theme.cream }, lip(theme), captain && { borderWidth: 2, borderColor: theme.accent }]}
                >
                  <JerseyBadge number={p.jerseyNumber} highlight={captain} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
                        {p.name}
                      </Text>
                      {captain && (
                        <View style={[styles.capt, { backgroundColor: theme.deep }]}>
                          <Text style={[type.label, { color: theme.accent }]}>Captain</Text>
                        </View>
                      )}
                      {p.isMe ? (
                        <View style={[styles.capt, { backgroundColor: theme.accent }]}>
                          <Text style={[type.label, { color: theme.accentInk }]}>You</Text>
                        </View>
                      ) : p.isLinked ? (
                        <Icon name="account-check" size={18} color={theme.successInk} label="Linked to their account" />
                      ) : null}
                    </View>
                    <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                      {isCricket ? describeCricketer(p.cricket) || 'Role not set' : p.position || 'No position set'}
                      {canEdit && p.email && !p.isLinked ? ' · waiting for sign-up' : ''}
                    </Text>
                  </View>
                  {tag && (
                    <View style={[styles.tag, { backgroundColor: theme.chip }]}>
                      <Text style={[styles.tagText, { color: theme.ink }]}>{tag}</Text>
                    </View>
                  )}
                </PressableScale>
              );
            })
          )}

          <PlayerSheet
            key={sheet.key}
            visible={sheet.open}
            onClose={() => setSheet((s) => ({ ...s, open: false }))}
            onSaved={team.reload}
            tournamentId={tournamentId}
            team={t}
            player={sheet.player}
            sport={sport}
          />
          <RenameSheet
            key={`rename-${rename.key}`}
            visible={rename.open}
            onClose={() => setRename((r) => ({ ...r, open: false }))}
            team={t}
            tournamentId={tournamentId}
            onSaved={team.reload}
          />
        </>
      )}
    </Screen>
  );
}

function RenameSheet({ visible, onClose, team, tournamentId, onSaved }: { visible: boolean; onClose: () => void; team: Team; tournamentId: number; onSaved: () => void }) {
  const action = useAction();
  const [name, setName] = useState(team.name);
  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === team.name) return onClose();
    const res = await action.run(() =>
      api.call('TEAM_UPDATE', { routeParams: { id: tournamentId, teamId: team.id }, body: { name: trimmed, setCaptain: false } }),
    );
    if (res.ok) {
      haptic.success();
      onSaved();
      onClose();
    }
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Rename team"
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Save" icon="check" onPress={save} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <TextField label="Team name" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="done" onSubmitEditing={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 48, height: 48, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  counts: { flexDirection: 'row', gap: space.sm },
  count: { flex: 1, borderRadius: radius.md, alignItems: 'center', paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.md, minHeight: 72 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21, flexShrink: 1 },
  capt: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 1 },
  tag: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs, minWidth: 44, alignItems: 'center' },
  tagText: { fontFamily: fonts.display, fontSize: 15 },
  code: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48, letterSpacing: 6 },
  codeActions: { flexDirection: 'row', gap: space.sm },
});
