import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, lip, radius, space, type } from '@/theme/theme';

// A team's squad: who's in it, sorted by shirt number, with a line-count summary on top and a
// filter by position (football) or role (cricket). Tap a player to edit; add from the footer.

type Filter = 'ALL' | Line | string;

export default function TeamScreen() {
  const { teamId } = useLocalSearchParams<{ teamId: string }>();
  const { id: tournamentId, name: tournamentName, sport } = useTournament();
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

  const t = team.data;
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
      footer={t ? <Button label="Add player" icon="account-plus" size="lg" onPress={() => openPlayer(null)} /> : undefined}
    >
      {!t ? (
        team.loading ? <Skeleton rows={6} /> : null
      ) : (
        <>
          <SectionHeader
            eyebrow={tournamentName}
            title={t.name}
            large
            right={
              <PressableScale
                onPress={() => setRename((r) => ({ open: true, key: r.key + 1 }))}
                accessibilityLabel={`Rename ${t.name}`}
                style={[styles.iconBtn, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}
              >
                <Icon name="pencil" size={20} color={theme.accent} />
              </PressableScale>
            }
          />

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
              message="Add the squad. Shirt numbers make scoring faster — pickers show them first."
              actionLabel="Add player"
              onAction={() => openPlayer(null)}
            />
          ) : (
            shown.map((p) => {
              const captain = t.defaultCaptainPlayerId === p.id;
              const tag = groupOf(p);
              return (
                <PressableScale
                  key={p.id}
                  onPress={() => openPlayer(p)}
                  accessibilityLabel={`${p.jerseyNumber != null ? `Number ${p.jerseyNumber}, ` : ''}${p.name}${captain ? ', captain' : ''}`}
                  accessibilityHint="Edit player"
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
                    </View>
                    <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                      {isCricket ? describeCricketer(p.cricket) || 'Role not set' : p.position || 'No position set'}
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
});
