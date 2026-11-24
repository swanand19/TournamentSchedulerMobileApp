import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { api } from '@/api/client';
import type { DrawPick, DrawSpin, DrawState, DrawTeam } from '@/api/types';
import Bump from '@/components/Bump';
import Button from '@/components/Button';
import { Deck } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import { Avatar } from '@/features/auction/AuctionParts';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { parseUtc, plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { CSS_EASE_OUT, EASE_OUT, materialize } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The team draw's pieces. Each turn has three beats, the same on every phone (plan 9.3):
//  1. the team whose turn it is lights up ("Drawing for Tigers"), the other teams dim;
//  2. the names in the pot spin in a window and slow down (the server keeps the name to itself);
//  3. at the moment it lands everyone fetches it: the name drops in as a card, glowing, and settles
//     into its team, whose count bumps.
//
// Motion (animate-expo rules, on the UI thread):
//  - The spin is the delight moment (rare: once a turn, watched by everyone). One long timing on
//    `translateY` with a cubic ease-out, so it starts fast and is still moving when the name lands —
//    it never comes to rest on a name that wasn't drawn. Reduce Motion: no spin, a still line.
//  - The landed card materializes (glass scaling up with one soft overshoot); the new row in its
//    team arrives with FadeInDown (220 ms, strong ease-out); the count bumps.
//  - The spotlight moves with a 200 ms colour/opacity transition. Tiles reorder with a layout
//    transition once, when the teams are drawn into their order.
//  - Haptics: a light tap for the drawer's own tap, success for the person drawn; nothing for
//    anyone else (they didn't cause it).

type Timed = DrawState & { clockOffset: number };

/** The server's clock minus the phone's, at the moment the answer arrives: the spin lands on the server's time. */
const timed = (state: DrawState): Timed => ({ ...state, clockOffset: (parseUtc(state.serverNow)?.getTime() ?? Date.now()) - Date.now() });

/** The draw, live: reloaded on every nudge, and once more the moment a spinning name lands. */
export function useDraw(tournamentId: number) {
  const fetcher = useCallback(
    async () => timed(await api.call<DrawState>('DRAW_GET', { routeParams: { id: tournamentId } })),
    [tournamentId],
  );
  const query = useQuery(fetcher, { pollMs: 3000, live: { kind: 'tournament', tournamentId }, bunchMs: 80 });
  const { setData, reload } = query;
  const show = useCallback((state: DrawState) => setData(timed(state)), [setData]);

  const landsAt = query.data?.spin?.landsAt ?? null;
  const offset = query.data?.clockOffset ?? 0;
  useEffect(() => {
    if (!landsAt) return undefined;
    const at = (parseUtc(landsAt)?.getTime() ?? 0) - offset;
    const timer = setTimeout(() => void reload(), Math.max(0, at - Date.now()) + 120);
    return () => clearTimeout(timer);
  }, [landsAt, offset, reload]);

  return { ...query, setData: show, offset };
}

/** A name landed within the last few seconds (server time), so it's shown as the moment it is. */
export function isFresh(state: DrawState): boolean {
  if (!state.last) return false;
  const landed = parseUtc(state.last.landedAt)?.getTime() ?? 0;
  const now = parseUtc(state.serverNow)?.getTime() ?? 0;
  return now - landed < 8000;
}

/** Tells the person drawn (a buzz) and anyone using a screen reader, as each name lands. Nothing on the first load. */
export function useDrawMoments(state: DrawState | undefined) {
  const seen = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (!state) return;
    const last = state.last;
    const id = last?.pickId ?? null;
    if (seen.current !== undefined && id !== null && id !== seen.current && last) {
      if (last.isMe) haptic.success();
      AccessibilityInfo.announceForAccessibility(last.isMe ? `You're in ${last.teamName}` : `${last.name} to ${last.teamName}`);
    }
    seen.current = id;
  }, [state]);
}

// -----------------------------------------------------------------
// The stage: the spin, and the name landing
// -----------------------------------------------------------------

const ROW = 60;

/** The names in the pot whizzing past in a window, slowing down; never at rest on a name. */
export function SpinWindow({ spin, offset }: { spin: DrawSpin; offset: number }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);

  // A long strip of the pot's names, repeated; the server sends them sorted, so shuffle per pick.
  const [strip] = useState(() => {
    const names = spin.names.length > 0 ? spin.names : ['…'];
    const out: string[] = [];
    let seed = spin.pickId;
    while (out.length < 48) {
      seed = (seed * 9301 + 49297) % 233280;
      out.push(names[seed % names.length]);
    }
    return out;
  });

  useEffect(() => {
    const left = Math.max(600, (parseUtc(spin.landsAt)?.getTime() ?? 0) - offset - Date.now());
    // Run past the landing time, so it is still moving when the name arrives.
    y.set(withTiming(-(strip.length - 2) * ROW, { duration: left + 2200, easing: Easing.bezier(0.33, 1, 0.68, 1), reduceMotion: ReduceMotion.Never }));
  }, [spin.landsAt, offset, strip.length, y]);

  const moving = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  if (reduced) {
    return (
      <View style={[styles.window, { borderColor: theme.accent, justifyContent: 'center' }]} accessible accessibilityLabel="Drawing a name">
        <Text style={[type.lead, { color: theme.onDarkSoft, textAlign: 'center' }]}>Drawing from {plural(spin.names.length, 'name')}…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.window, { borderColor: theme.accent, boxShadow: `0 0 28px ${theme.glow}` }]} accessible accessibilityLabel={`Drawing from ${plural(spin.names.length, 'name')}`}>
      <Animated.View style={[styles.strip, moving]}>
        {strip.map((n, i) => (
          <View key={i} style={styles.slot}>
            <Text style={[styles.spinName, { color: theme.onDark }]} numberOfLines={1}>
              {n}
            </Text>
          </View>
        ))}
      </Animated.View>
      <View style={[styles.edge, { top: 0, backgroundColor: theme.glassSolid, opacity: 0.55 }]} />
      <View style={[styles.edge, { bottom: 0, backgroundColor: theme.glassSolid, opacity: 0.55 }]} />
    </View>
  );
}

/** The name that has just landed. Keyed by pick, so each new one materializes. */
export function LandedCard({ pick }: { pick: DrawPick }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const tone = pick.isMe ? theme.success : theme.accent;
  const what = [pick.role, pick.tierName ? `tier ${pick.tierName}` : null].filter(Boolean).join(' · ');
  return (
    <Animated.View entering={materialize} style={{ alignItems: 'center', gap: space.sm }} accessible accessibilityLabel={pick.isMe ? `You're in ${pick.teamName}` : `${pick.name} to ${pick.teamName}`}>
      <Text style={[type.label, { color: theme.onDarkSoft }]}>{pick.isMe ? "That's you" : `${pick.teamName} get`}</Text>
      <Avatar name={pick.name} size={72} tint />
      <Text style={[type.title, { color: theme.onDark, textAlign: 'center' }]} numberOfLines={2}>
        {pick.isMe ? `You're in ${pick.teamName}` : pick.name}
      </Text>
      {what ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{what}</Text> : null}
      <View style={{ height: 3, width: 64, borderRadius: 2, backgroundColor: tone }} />
    </Animated.View>
  );
}

// -----------------------------------------------------------------
// Teams
// -----------------------------------------------------------------

/** A team in the draw: everyone in it so far; lit while a name is drawn for it, dim while another team's is. */
export function DrawTeamCard({ team, dim, newPickId, onPick }: { team: DrawTeam; dim: boolean; newPickId: number | null; onPick?: (pick: DrawPick) => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const lit = team.isDrawing;
  return (
    <Animated.View
      layout={LinearTransition.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}
      style={[
        styles.team,
        {
          backgroundColor: lit ? theme.accentSoft : theme.cream,
          borderColor: lit ? theme.accent : theme.glassBorder,
          opacity: dim ? 0.55 : 1,
          boxShadow: lit ? `0 0 26px ${theme.glow}` : 'none',
          transitionProperty: ['backgroundColor', 'borderColor', 'opacity'],
          transitionDuration: 200,
          transitionTimingFunction: CSS_EASE_OUT,
        },
      ]}
    >
      <View style={styles.between}>
        <Text style={[type.bodyStrong, { color: theme.onDark, flex: 1 }]} numberOfLines={1}>
          {team.name}
        </Text>
        <Bump value={team.players} style={[styles.count, { color: theme.onDark }]} />
      </View>
      {team.kept.map((n, i) => (
        <Text key={`k${i}`} style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
          {n}
        </Text>
      ))}
      {team.drawn.map((p) => {
        const row = (
          <Animated.View key={p.pickId} entering={p.pickId === newPickId ? FadeInDown.duration(220).easing(EASE_OUT).reduceMotion(ReduceMotion.System) : undefined}>
            <Text style={[type.caption, { color: p.pickId === newPickId ? theme.accent : theme.extraInk }]} numberOfLines={1}>
              {p.name}
              {p.isMe ? ' (you)' : ''}
              {p.movedFromTeamName ? ' · moved' : ''}
            </Text>
          </Animated.View>
        );
        return onPick ? (
          <PressableScale key={p.pickId} onPress={() => onPick(p)} accessibilityRole="button" accessibilityLabel={`${p.name}. Move or swap`}>
            {row}
          </PressableScale>
        ) : (
          row
        );
      })}
      {lit && <Text style={[type.caption, { color: theme.accent }]}>drawing…</Text>}
    </Animated.View>
  );
}

// -----------------------------------------------------------------
// Moving and swapping after the draw
// -----------------------------------------------------------------

export function DrawMoveSheet({ state, pick, tournamentId, onState, onClose }: {
  state: DrawState;
  pick: DrawPick;
  tournamentId: number;
  onState: (s: DrawState) => void;
  onClose: () => void;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const [mode, setMode] = useState<'move' | 'swap'>('move');
  const [teamId, setTeamId] = useState<number | null>(null);
  const [otherId, setOtherId] = useState<number | null>(null);
  const from = state.teams.find((t) => t.teamId === pick.teamId);
  const others = state.teams.filter((t) => t.teamId !== pick.teamId);
  const target = others.find((t) => t.teamId === teamId);
  const swapWith = others.flatMap((t) => t.drawn).find((p) => p.poolPlayerId === otherId);

  const save = async () => {
    const res = await action.run(() =>
      mode === 'move'
        ? api.call<DrawState>('DRAW_MOVE', { routeParams: { id: tournamentId }, body: { poolPlayerId: pick.poolPlayerId, teamId } })
        : api.call<DrawState>('DRAW_SWAP', { routeParams: { id: tournamentId }, body: { poolPlayerId: pick.poolPlayerId, otherPoolPlayerId: otherId } }),
    );
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
    onClose();
  };

  const choice = (key: string, on: boolean, onPress: () => void, title: string, detail: string) => (
    <PressableScale key={key} onPress={() => { haptic.select(); onPress(); }} accessibilityRole="radio" accessibilityState={{ checked: on }}>
      <View style={[styles.choice, { borderColor: on ? theme.accent : theme.cardDivider, backgroundColor: on ? theme.accentSoft : 'transparent' }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: theme.ink }]}>{title}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{detail}</Text>
        </View>
        {on && <Icon name="check-circle" size={22} color={theme.accent} />}
      </View>
    </PressableScale>
  );

  return (
    <Sheet
      visible
      onClose={onClose}
      title={pick.name}
      subtitle={[from?.name, pick.tierName ? `tier ${pick.tierName}` : null].filter(Boolean).join(' · ')}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={mode === 'move' ? (target ? `Move to ${target.name}` : 'Pick a team') : swapWith ? `Swap with ${swapWith.name}` : 'Pick a player'}
            icon={mode === 'move' ? 'arrow-right' : 'swap-horizontal'}
            onPress={save}
            busy={action.busy}
            disabled={mode === 'move' ? !target : !swapWith}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <SegmentedControl
        segments={[{ key: 'move', label: 'Move to' }, { key: 'swap', label: 'Swap with' }]}
        value={mode}
        onChange={setMode}
        accessibilityLabel="Move or swap"
      />
      {mode === 'move'
        ? others.map((t) => choice(`t${t.teamId}`, t.teamId === teamId, () => setTeamId(t.teamId), t.name, `${t.players} → ${t.players + 1} players`))
        : others.flatMap((t) => t.drawn.map((p) => choice(`p${p.poolPlayerId}`, p.poolPlayerId === otherId, () => setOtherId(p.poolPlayerId), p.name, `${t.name}${p.tierName ? ` · tier ${p.tierName}` : ''}`)))}
      {mode === 'move' && target && from && (
        <Text style={[type.caption, { color: theme.warnInk }]}>
          {from.name} will have {from.players - 1}, {target.name} {target.players + 1}. That&apos;s allowed; the move is shown to everyone.
        </Text>
      )}
    </Sheet>
  );
}

// -----------------------------------------------------------------
// The pot
// -----------------------------------------------------------------

export function PotPanel({ state }: { state: DrawState }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const pot = state.pot;
  if (!pot) return null;
  return (
    <Deck>
      <View style={styles.between}>
        <Text style={[type.bodyStrong, { color: theme.onDark }]}>{pot.name}</Text>
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>{plural(pot.players.length, 'name')} in the pot</Text>
      </View>
      <View style={styles.wrap}>
        {pot.players.map((p) => (
          <View key={p.poolPlayerId} style={[styles.potName, { backgroundColor: theme.chip }]}>
            <Text style={[type.caption, { color: theme.extraInk }]}>{p.name}</Text>
          </View>
        ))}
      </View>
      {pot.nextName ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>Then {pot.nextName}: {plural(pot.nextCount, 'player')}</Text> : null}
    </Deck>
  );
}

const makeStyles = ({ fonts, figures }: Typography) =>
  StyleSheet.create({
    window: { height: ROW, borderRadius: radius.lg, borderWidth: 1.5, overflow: 'hidden', alignSelf: 'stretch' },
    strip: { position: 'absolute', left: 0, right: 0, top: 0 },
    slot: { height: ROW, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
    spinName: { fontFamily: fonts.bodyBold, fontSize: 24, letterSpacing: -0.3 },
    edge: { position: 'absolute', left: 0, right: 0, height: 10 },
    team: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1.5, padding: space.md, gap: 2, flexBasis: '48%', flexGrow: 1 },
    count: { fontFamily: fonts.display, fontSize: 20, fontVariant: figures },
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    potName: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, minHeight: 56 },
  });
