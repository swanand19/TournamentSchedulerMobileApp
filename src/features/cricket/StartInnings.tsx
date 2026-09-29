import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CricketMatchState, CricketSquadMember } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import Icon from '@/components/Icon';
import PlayerGrid from '@/components/PlayerGrid';
import PressableScale from '@/components/PressableScale';
import SectionHeader from '@/components/SectionHeader';
import Sheet from '@/components/Sheet';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type } from '@/theme/theme';

// The top of every innings: the openers and the bowler for the first over. Three slots, each
// picked on its own screen-height sheet, one after another — the list is only ever one team's XI,
// so nothing needs scrolling past, and the striker never appears in the non-striker's list.
//
// Who bats next comes from the engine (nextBattingTeamId): the follow-on and super overs make it
// less obvious than "the other side".

type Role = 'striker' | 'nonStriker' | 'bowler';

const ROLES: { key: Role; label: string; empty: string }[] = [
  { key: 'striker', label: 'Striker', empty: 'Who faces the first ball?' },
  { key: 'nonStriker', label: 'Non-striker', empty: 'Who is at the other end?' },
  { key: 'bowler', label: 'Opening bowler', empty: 'Who bowls the first over?' },
];

type Props = {
  state: CricketMatchState;
  busy: boolean;
  onStart: (body: { strikerId: number; nonStrikerId: number; bowlerId: number }) => void;
};

export default function StartInnings({ state, busy, onStart }: Props) {
  const theme = useSportTheme();
  const battingId = state.actions.nextBattingTeamId;
  const bowlingId = state.actions.nextBowlingTeamId;
  const byOrder = (a: CricketSquadMember, b: CricketSquadMember) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99);
  const batting = state.squad.filter((p) => p.teamId === battingId && p.squadStatus === 'Playing').sort(byOrder);
  const bowling = state.squad.filter((p) => p.teamId === bowlingId && p.squadStatus === 'Playing');
  const teamName = battingId === state.homeTeamId ? state.homeTeamName : state.awayTeamName;
  const bowlingName = bowlingId === state.homeTeamId ? state.homeTeamName : state.awayTeamName;

  const [picked, setPicked] = useState<Record<Role, number | null>>({ striker: null, nonStriker: null, bowler: null });
  const [sheet, setSheet] = useState<{ role: Role | null; open: boolean; key: number }>({ role: null, open: false, key: 0 });
  const [queued, setQueued] = useState<Role | null>(null);

  const open = (role: Role) => setSheet((s) => ({ role, open: true, key: s.key + 1 }));
  const close = () => setSheet((s) => ({ ...s, open: false }));

  // The next slot opens once the previous sheet has slid away, so the two never overlap.
  useEffect(() => {
    if (!queued) return undefined;
    const timer = setTimeout(() => {
      setQueued(null);
      setSheet((s) => ({ role: queued, open: true, key: s.key + 1 }));
    }, 260);
    return () => clearTimeout(timer);
  }, [queued]);

  const choose = (role: Role, id: number) => {
    haptic.select();
    const next = { ...picked, [role]: id };
    if (role === 'striker' && next.nonStriker === id) next.nonStriker = null;
    setPicked(next);
    close();
    const nextEmpty = ROLES.find((r) => next[r.key] === null)?.key ?? null;
    if (nextEmpty) setQueued(nextEmpty);
  };

  const nameOf = (id: number | null) => state.squad.find((p) => p.playerId === id)?.playerName;
  const ready = picked.striker !== null && picked.nonStriker !== null && picked.bowler !== null;

  const listFor = (role: Role) => {
    if (role === 'bowler') return bowling.map((p) => ({ id: p.playerId, name: p.playerName, sub: p.isWicketKeeper ? 'Keeper' : undefined }));
    return batting
      .filter((p) => role !== 'nonStriker' || p.playerId !== picked.striker)
      .map((p) => ({ id: p.playerId, name: p.playerName, sub: p.battingOrder ? `Bats at ${p.battingOrder}` : undefined }));
  };
  const current = ROLES.find((r) => r.key === sheet.role);

  return (
    <Card>
      <SectionHeader
        onCard
        eyebrow={state.status === 'SuperOver' ? 'Super over — one over, two wickets' : `Innings ${state.innings.length + 1}`}
        title={`${teamName} to bat`}
      />

      <View style={{ gap: space.sm }}>
        {ROLES.map((r) => {
          const name = nameOf(picked[r.key]);
          return (
            <PressableScale
              key={r.key}
              onPress={() => open(r.key)}
              accessibilityLabel={`${r.label}: ${name ?? 'not chosen'}`}
              accessibilityHint="Opens the player list"
              style={[styles.slot, { backgroundColor: name ? theme.tint : theme.chip, borderColor: name ? theme.successSolid : theme.cardDivider }]}
            >
              <Icon name={r.key === 'bowler' ? 'baseball' : 'cricket'} size={20} color={name ? theme.successInk : theme.muted} />
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: theme.muted }]}>{r.label}</Text>
                <Text style={[type.lead, { color: name ? theme.ink : theme.muted }]} numberOfLines={1}>
                  {name ?? r.empty}
                </Text>
              </View>
              <Text style={[type.bodyStrong, { color: theme.successInk }]}>{name ? 'Change' : 'Choose'}</Text>
            </PressableScale>
          );
        })}
      </View>

      <Button
        label="Start the innings"
        icon="cricket"
        size="lg"
        disabled={!ready}
        busy={busy}
        onPress={() => ready && onStart({ strikerId: picked.striker!, nonStrikerId: picked.nonStriker!, bowlerId: picked.bowler! })}
      />

      {current && (
        <Sheet
          key={sheet.key}
          visible={sheet.open}
          onClose={close}
          dark
          title={`Choose ${current.label.toLowerCase()}`}
          subtitle={current.key === 'bowler' ? `${bowlingName} · playing XI` : `${teamName} · playing XI`}
        >
          <PlayerGrid
            dark
            label={current.label}
            players={listFor(current.key)}
            selected={picked[current.key]}
            onSelect={(id) => id !== null && choose(current.key, id)}
          />
        </Sheet>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: space.md,
  },
});
