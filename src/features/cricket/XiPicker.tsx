import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CricketSetupOptions } from '@/api/types';
import Chip from '@/components/Chip';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { roleKeeps } from '@/lib/cricketLabels';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// Picking one side's XI. Three lists: the XI in batting order, the bench, and anyone unavailable.
// In the XI each player has a captain (C) and keeper (WK) toggle; "Edit order" swaps those for
// up/down arrows, so no row ever carries more controls than a thumb can hit cleanly.

export type TeamPick = { playing: number[]; out: number[]; captain: number | null; keeper: number | null };
type SetupTeam = CricketSetupOptions['teams'][number];
type SetupPlayer = SetupTeam['players'][number];

export function seedPick(team: SetupTeam, size: number): TeamPick {
  const ordered = [...team.players].sort(
    (a, b) =>
      (a.cricket?.battingOrderPreference ?? 99) - (b.cricket?.battingOrderPreference ?? 99) || a.name.localeCompare(b.name),
  );
  const playing = ordered.slice(0, size).map((p) => p.id);
  const captain = team.defaultCaptainPlayerId && playing.includes(team.defaultCaptainPlayerId) ? team.defaultCaptainPlayerId : null;
  const keeper = ordered.find((p) => playing.includes(p.id) && roleKeeps(p.cricket?.role))?.id ?? null;
  return { playing, out: [], captain, keeper };
}

/** "Same as last time": the XI this side fielded in its previous match, in that batting order. */
export function pickFromLast(team: SetupTeam): TeamPick | null {
  if (!team.lastSquad) return null;
  const playing = team.lastSquad.players
    .filter((p) => p.playing)
    .sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99))
    .map((p) => p.playerId);
  return {
    playing,
    out: [],
    captain: team.lastSquad.players.find((p) => p.isCaptain)?.playerId ?? null,
    keeper: team.lastSquad.players.find((p) => p.isWicketKeeper)?.playerId ?? null,
  };
}

export function pickProblems(pick: TeamPick, size: number): string[] {
  const problems: string[] = [];
  if (pick.playing.length !== size) problems.push(`${pick.playing.length}/${size} picked`);
  if (!pick.captain || !pick.playing.includes(pick.captain)) problems.push('no captain');
  if (!pick.keeper || !pick.playing.includes(pick.keeper)) problems.push('no keeper');
  return problems;
}

type Props = { team: SetupTeam; pick: TeamPick; size: number; onChange: (p: TeamPick) => void };

export default function XiPicker({ team, pick, size, onChange }: Props) {
  const theme = useSportTheme();
  const [ordering, setOrdering] = useState(false);
  const byId = new Map(team.players.map((p) => [p.id, p]));
  const bench = team.players.filter((p) => !pick.playing.includes(p.id) && !pick.out.includes(p.id));
  const out = team.players.filter((p) => pick.out.includes(p.id));
  const full = pick.playing.length >= size;

  const change = (next: TeamPick) => {
    haptic.select();
    onChange(next);
  };
  const toXi = (id: number) => change({ ...pick, playing: [...pick.playing, id], out: pick.out.filter((x) => x !== id) });
  const toBench = (id: number) =>
    change({
      ...pick,
      playing: pick.playing.filter((x) => x !== id),
      out: pick.out.filter((x) => x !== id),
      captain: pick.captain === id ? null : pick.captain,
      keeper: pick.keeper === id ? null : pick.keeper,
    });
  const toOut = (id: number) => change({ ...pick, out: [...pick.out, id] });
  const move = (index: number, by: -1 | 1) => {
    const next = [...pick.playing];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    change({ ...pick, playing: next });
  };

  const sub = (p: SetupPlayer) => [p.cricket?.roleLabel, p.cricket?.bowlingStyleLabel].filter(Boolean).join(' · ') || 'Role not set';

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.headRow}>
        <Text style={[type.label, { color: theme.onDarkSoft, flex: 1 }]}>
          {pick.playing.length} of {size} playing, {bench.length} on the bench{out.length ? `, ${out.length} out` : ''}
        </Text>
        <Chip label={ordering ? 'Done' : 'Edit order'} icon="swap-vertical" selected={ordering} onPress={() => setOrdering(!ordering)} />
      </View>

      {pick.playing.map((id, i) => {
        const p = byId.get(id);
        if (!p) return null;
        const isC = pick.captain === id;
        const isWk = pick.keeper === id;
        return (
          <View key={id} style={[styles.row, { backgroundColor: theme.deck, borderColor: theme.accentSoft }]}>
            <View style={[styles.order, { backgroundColor: theme.accent }]}>
              <Text style={[styles.orderText, { color: theme.accentInk }]}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: theme.onDark }]} numberOfLines={1}>
                {p.name}
              </Text>
              <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
                {sub(p)}
              </Text>
            </View>
            {ordering ? (
              <>
                <Square icon="chevron-up" label={`Move ${p.name} up`} onPress={() => move(i, -1)} disabled={i === 0} />
                <Square icon="chevron-down" label={`Move ${p.name} down`} onPress={() => move(i, 1)} disabled={i === pick.playing.length - 1} />
              </>
            ) : (
              <>
                <Toggle text="C" on={isC} label={`Captain: ${p.name}`} onPress={() => change({ ...pick, captain: isC ? null : id })} />
                <Toggle text="WK" on={isWk} label={`Wicket-keeper: ${p.name}`} onPress={() => change({ ...pick, keeper: isWk ? null : id })} />
                <Square icon="close" label={`Move ${p.name} to the bench`} onPress={() => toBench(id)} />
              </>
            )}
          </View>
        );
      })}

      {bench.length > 0 && <Text style={[type.label, { color: theme.onDarkSoft }]}>Bench</Text>}
      {bench.map((p) => (
        <View key={p.id} style={[styles.row, { backgroundColor: theme.surfaceOnDark, borderColor: theme.borderOnDark }]}>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: theme.onDark }]} numberOfLines={1}>
              {p.name}
            </Text>
            <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
              {sub(p)}
            </Text>
          </View>
          <Square icon="account-off-outline" label={`Mark ${p.name} unavailable`} onPress={() => toOut(p.id)} />
          <Square icon="plus" label={`Add ${p.name} to the XI`} onPress={() => toXi(p.id)} disabled={full} accent />
        </View>
      ))}

      {out.length > 0 && <Text style={[type.label, { color: theme.onDarkSoft }]}>Unavailable</Text>}
      {out.map((p) => (
        <View key={p.id} style={[styles.row, { borderColor: theme.borderOnDark }]}>
          <Text style={[type.body, { color: theme.onDarkSoft, flex: 1, textDecorationLine: 'line-through' }]} numberOfLines={1}>
            {p.name}
          </Text>
          <Square icon="undo" label={`Bring ${p.name} back`} onPress={() => toBench(p.id)} />
        </View>
      ))}
    </View>
  );
}

function Toggle({ text, on, label, onPress }: { text: string; on: boolean; label: string; onPress: () => void }) {
  const theme = useSportTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      hitSlop={4}
      style={[styles.square, { backgroundColor: on ? theme.accent : theme.deckRaised, borderColor: on ? theme.accent : theme.borderOnDark }]}
    >
      <Text style={[styles.toggleText, { color: on ? theme.accentInk : theme.onDarkSoft }]}>{text}</Text>
    </PressableScale>
  );
}

function Square({
  icon,
  label,
  onPress,
  disabled,
  accent,
}: {
  icon: 'chevron-up' | 'chevron-down' | 'close' | 'plus' | 'undo' | 'account-off-outline';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const theme = useSportTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={4}
      style={[styles.square, { backgroundColor: accent ? theme.accent : theme.deckRaised, borderColor: theme.borderOnDark }]}
    >
      <Icon name={icon} size={20} color={accent ? theme.accentInk : theme.onDark} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, borderWidth: 1, padding: space.sm, paddingLeft: space.md, minHeight: 60 },
  order: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  orderText: { fontFamily: fonts.display, fontSize: 16 },
  square: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  toggleText: { fontFamily: fonts.display, fontSize: 15 },
});
