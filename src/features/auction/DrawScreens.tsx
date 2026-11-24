import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { api } from '@/api/client';
import type { ServiceRequestId } from '@/api/services';
import type { DrawPick, DrawState } from '@/api/types';
import Button from '@/components/Button';
import { Card, Deck, Panel } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import LiveDot from '@/components/LiveDot';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import { Avatar } from '@/features/auction/AuctionParts';
import { DrawMoveSheet, DrawTeamCard, isFresh, LandedCard, PotPanel, SpinWindow } from '@/features/auction/DrawParts';
import PressableScale from '@/components/PressableScale';
import { useAction } from '@/hooks/useAction';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { CSS_EASE_OUT } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// The team draw's three screens: setting it up (how names are drawn, what it gives, the pace), the
// live draw (the stage, the teams, the pot; controls only for whoever draws), and the teams drawn
// (move or swap, start again, confirm). The server decides every button through `actions`.

type Props = { state: DrawState; tournamentId: number; tournamentName: string; onState: (s: DrawState) => void; offset: number };

const call = (id: number, service: ServiceRequestId, body?: object) => api.call<DrawState>(service, { routeParams: { id }, body: body ?? {} });

const AUTO = 8;

// -----------------------------------------------------------------
// Setting it up
// -----------------------------------------------------------------

export function DrawSetup({ state, tournamentId, tournamentName, onState }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const a = state.actions;
  const p = state.preview;

  const act = async (service: ServiceRequestId, body?: object) => {
    const res = await action.run(() => call(tournamentId, service, body));
    if (!res.ok) return false;
    onState(res.value);
    return true;
  };

  const useDrawInstead = async () => {
    const res = await action.run(() => api.call('POOL_METHOD_SET', { routeParams: { id: tournamentId }, body: { method: 'Draw' } }));
    if (!res.ok) return;
    haptic.select();
    const again = await action.run(() => api.call<DrawState>('DRAW_GET', { routeParams: { id: tournamentId } }));
    if (again.ok) onState(again.value);
  };

  const start = async () => {
    const ok = await confirm({
      title: 'Start the live draw?',
      message: 'Everyone in the pool, the teams’ players, owners and scorers are told it has started. From here it stays a draw.',
      confirmLabel: 'Start the draw',
    });
    if (ok && (await act('DRAW_START'))) haptic.success();
  };

  const quick = async () => {
    const ok = await confirm({
      title: 'Draw every name at once?',
      message: 'The whole draw happens in one go and everyone sees the result. You can shuffle again or move players before confirming.',
      confirmLabel: 'Quick draw',
    });
    if (ok && (await act('DRAW_QUICK'))) haptic.success();
  };

  return (
    <Screen
      footer={
        a.canStart || a.canQuickDraw ? (
          <View style={styles.row}>
            <Button label="Quick draw" icon="shuffle-variant" variant="secondary" size="lg" onPress={quick} disabled={!a.canQuickDraw} busy={action.busy} style={{ flex: 1 }} />
            <Button label="Start the draw" icon="play" size="lg" onPress={start} disabled={!a.canStart} busy={action.busy} style={{ flex: 1.4 }} />
          </View>
        ) : undefined
      }
    >
      <SectionHeader eyebrow={tournamentName} title="Set up the draw" large />
      <ErrorBanner message={action.error?.message} />

      {state.method === 'Auction' && (
        <Card>
          <Text style={[type.bodyStrong, { color: theme.ink }]}>This pool is set to fill the teams by auction.</Text>
          {a.canChooseMethod && <Button label="Draw the teams instead" icon="shuffle-variant" variant="secondary" onPress={useDrawInstead} busy={action.busy} />}
        </Card>
      )}

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>How names are drawn</Text>
        <SegmentedControl
          segments={[{ key: 'ByTier', label: 'Tier by tier' }, { key: 'Random', label: 'All at random' }]}
          value={state.kind}
          onChange={(kind) => a.canEditKind && kind !== state.kind && act('DRAW_SETTINGS', { kind })}
          accessibilityLabel="How names are drawn"
        />
        <Text style={[type.caption, { color: theme.muted }]}>
          {state.kind === 'ByTier'
            ? 'The top tier first, then the next. Every team gets a fair share of each tier.'
            : 'Any name, any time. Tiers are ignored.'}
        </Text>
      </Card>

      {p && p.teams.length > 0 && (
        <Deck>
          <Text style={[type.headline, { color: theme.onDark }]}>How it comes out</Text>
          <Text style={[type.body, { color: theme.onDark }]}>{p.line}</Text>
          {p.teams.map((t) => (
            <View key={t.teamId} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: theme.onDark }]}>{t.name}</Text>
                <Text style={[type.caption, { color: theme.onDarkSoft }]}>Has {t.has}</Text>
              </View>
              <Text style={[type.caption, styles.num, { color: theme.onDarkSoft }]}>
                {t.orOneMore ? `gets ${t.gets}–${t.gets + 1} · ends ${t.endsWith} or ${t.endsWith + 1}` : `gets ${t.gets} · ends ${t.endsWith}`}
              </Text>
            </View>
          ))}
          {p.note ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{p.note}</Text> : null}
          {state.kind === 'ByTier' && p.tiers.length > 0 && (
            <Text style={[type.caption, { color: theme.onDarkSoft }]}>{p.tiers.map((t) => `${t.name} · ${t.players}`).join('   ')}</Text>
          )}
        </Deck>
      )}

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>Pace</Text>
        <SegmentedControl
          segments={[{ key: 'tap', label: 'I tap for each name' }, { key: 'auto', label: `Every ${AUTO} s` }]}
          value={state.autoSeconds ? 'auto' : 'tap'}
          onChange={(k) => a.canEditPace && act('DRAW_SETTINGS', { setPace: true, autoSeconds: k === 'auto' ? AUTO : null })}
          accessibilityLabel="Pace"
        />
        <Text style={[type.caption, { color: theme.muted }]}>
          Each turn: the team is named, the names in the pot spin, one lands. Nobody, you included, picks or sees it first.
        </Text>
      </Card>

      {state.startProblem ? <Text style={[type.body, { color: theme.warnInk }]}>{state.startProblem}</Text> : null}
    </Screen>
  );
}

// -----------------------------------------------------------------
// The live draw
// -----------------------------------------------------------------

export function DrawLive({ state, tournamentId, tournamentName, onState, offset }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const a = state.actions;
  const spin = state.spin;
  const fresh = isFresh(state) ? state.last : null;
  const next = state.teams.find((t) => t.teamId === state.nextTeamId);
  const done = state.counts.players === 0 ? 0 : state.counts.drawn / state.counts.players;

  const act = async (service: ServiceRequestId, body?: object) => {
    if (service === 'DRAW_NEXT') haptic.tap();
    const res = await action.run(() => call(tournamentId, service, body));
    if (res.ok) onState(res.value);
  };

  const restart = async () => {
    const ok = await confirm({
      title: 'Start the draw again?',
      message: 'Every name drawn so far goes back in the pool. Everyone watching sees it start again.',
      confirmLabel: 'Start again',
      destructive: true,
    });
    if (ok) await act('DRAW_RESTART');
  };

  return (
    <Screen
      footer={
        state.me.isDrawer ? (
          <View style={styles.row}>
            {a.canDrawRestOfPot && <Button label={`Rest of ${state.pot?.name.replace('Tier ', '') ?? 'tier'}`} variant="secondary" size="lg" onPress={() => act('DRAW_REST', { all: false })} busy={action.busy} style={{ flex: 1 }} />}
            <Button label={spin ? 'Drawing…' : 'Draw next'} icon="shuffle-variant" size="lg" onPress={() => act('DRAW_NEXT')} disabled={!a.canDrawNext} busy={action.busy} style={{ flex: 1.4 }} />
          </View>
        ) : a.canTakeOver ? (
          <Button label="Take over the draw" icon="hand-back-right" variant="secondary" size="lg" onPress={() => act('DRAW_TAKE_OVER')} busy={action.busy} />
        ) : undefined
      }
    >
      <View style={styles.headRow}>
        <LiveDot color={theme.accent} glow />
        <Text style={[type.label, { color: theme.onDarkSoft, flex: 1 }]}>
          {tournamentName} · {state.drawer ? (state.me.isDrawer ? 'You are drawing' : `${state.drawer.name} is drawing`) : 'Team draw'}
        </Text>
        <Text style={[type.caption, styles.num, { color: theme.onDarkSoft }]}>
          {state.counts.drawn} of {state.counts.players} drawn
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.chip }]}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: theme.accent, transform: [{ scaleX: done }], transitionProperty: 'transform', transitionDuration: 300, transitionTimingFunction: CSS_EASE_OUT },
          ]}
        />
      </View>
      <ErrorBanner message={action.error?.message} />

      <Deck style={{ minHeight: 230, justifyContent: 'center', alignItems: 'center', gap: space.md }}>
        {spin ? (
          <View key={`spin-${spin.pickId}`} style={{ alignSelf: 'stretch', alignItems: 'center', gap: space.md }}>
            <Text style={[type.label, { color: theme.onDarkSoft }]}>Drawing for</Text>
            <Text style={[styles.spot, { color: theme.accent, textShadowColor: theme.glow }]} numberOfLines={1}>
              {spin.teamName}
            </Text>
            <SpinWindow spin={spin} offset={offset} />
            <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>{spin.potName}: {plural(spin.names.length, 'name')} in the pot</Text>
          </View>
        ) : fresh ? (
          <LandedCard key={`landed-${fresh.pickId}`} pick={fresh} />
        ) : next ? (
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Text style={[type.label, { color: theme.onDarkSoft }]}>Next to draw</Text>
            <Text style={[styles.spot, { color: theme.onDark }]}>{next.name}</Text>
            <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>
              {state.me.isDrawer ? (state.autoSeconds ? `A name is drawn every ${state.autoSeconds} seconds.` : 'Tap Draw next when the room is ready.') : 'Waiting for the next name.'}
            </Text>
          </View>
        ) : (
          <Text style={[type.body, { color: theme.onDarkSoft }]}>Everyone has been drawn.</Text>
        )}
      </Deck>

      {!spin && fresh && next ? <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>Next: {next.name} draw.</Text> : null}

      <View style={styles.grid}>
        {state.teams.map((t) => (
          <DrawTeamCard key={t.teamId} team={t} dim={!!spin && !t.isDrawing} newPickId={fresh?.pickId ?? null} />
        ))}
      </View>

      <PotPanel state={state} />

      {state.me.isDrawer && (
        <Card>
          <View style={styles.between}>
            <Text style={[type.bodyStrong, { color: theme.ink, flex: 1 }]}>Draw by itself every {AUTO} seconds</Text>
            <SegmentedControl
              segments={[{ key: 'off', label: 'Off' }, { key: 'on', label: 'On' }]}
              value={state.autoSeconds ? 'on' : 'off'}
              onChange={(k) => act('DRAW_SETTINGS', { setPace: true, autoSeconds: k === 'on' ? AUTO : null })}
              style={{ width: 130 }}
              accessibilityLabel="Draw by itself"
            />
          </View>
          {a.canDrawAll && <Button label="Draw everyone left at once" icon="fast-forward" variant="ghost" onPress={() => act('DRAW_REST', { all: true })} busy={action.busy} />}
          {a.canRestart && <Button label="Start again" icon="restart" variant="ghost" onPress={restart} />}
        </Card>
      )}
    </Screen>
  );
}

// -----------------------------------------------------------------
// The teams drawn
// -----------------------------------------------------------------

export function DrawResults({ state, tournamentId, tournamentName, onState }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const [moving, setMoving] = useState<DrawPick | null>(null);
  const a = state.actions;
  const confirmed = state.status === 'Confirmed';
  const sizes = [...new Set(state.teams.map((t) => t.players))].sort((x, y) => y - x);
  const title = confirmed ? 'Teams confirmed' : sizes.length === 1 ? `Every team has ${sizes[0]}` : `Teams of ${sizes.join(' and ')}`;
  const times = state.times <= 1 ? 'Drawn once' : `Drawn ${state.times} times`;

  const act = async (service: ServiceRequestId, body?: object) => {
    const res = await action.run(() => call(tournamentId, service, body));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
  };

  const confirmTeams = async () => {
    const ok = await confirm({
      title: 'Confirm the teams?',
      message: 'Every name drawn becomes a place in its team’s squad. The draw can’t be changed afterwards.',
      confirmLabel: 'Confirm teams',
    });
    if (ok) await act('DRAW_CONFIRM');
  };

  const shuffle = async () => {
    const ok = await confirm({
      title: 'Shuffle again?',
      message: 'A whole new draw, in one go. Everyone sees it, and the count of draws goes up.',
      confirmLabel: 'Shuffle again',
      destructive: true,
    });
    if (ok) await act('DRAW_QUICK');
  };

  const restart = async () => {
    const ok = await confirm({
      title: 'Start the draw again?',
      message: 'Everyone goes back in the pool, and you can choose the auction instead.',
      confirmLabel: 'Start again',
      destructive: true,
    });
    if (ok) await act('DRAW_RESTART');
  };

  return (
    <Screen
      footer={
        !confirmed && state.me.isDrawer ? (
          <View style={styles.row}>
            <Button label="Start again" variant="secondary" size="lg" onPress={restart} disabled={!a.canRestart} style={{ flex: 1 }} />
            <Button label="Confirm teams" icon="check-decagram" size="lg" onPress={confirmTeams} disabled={!a.canConfirm} busy={action.busy} style={{ flex: 1.4 }} />
          </View>
        ) : !confirmed && a.canTakeOver ? (
          <Button label="Take over the draw" icon="hand-back-right" variant="secondary" size="lg" onPress={() => act('DRAW_TAKE_OVER')} busy={action.busy} />
        ) : undefined
      }
    >
      <SectionHeader eyebrow={tournamentName} title={title} large />
      <Text style={[type.body, { color: theme.onDarkSoft }]}>
        {plural(state.counts.drawn, 'player')} drawn · {times}.{' '}
        {confirmed
          ? 'The squads are made: changes are now done on the teams, as usual.'
          : a.canMove
            ? 'Tap a player to move or swap them; moves are shown to everyone.'
            : 'The organiser is checking the teams before confirming them.'}
      </Text>
      <ErrorBanner message={moving ? null : action.error?.message} />
      {a.confirmProblem ? <Text style={[type.body, { color: theme.warnInk }]}>{a.confirmProblem}</Text> : null}

      {state.teams.map((t) => (
        <Panel key={t.teamId}>
          <View style={styles.between}>
            <Text style={[type.headline, { color: theme.onDark }]}>{t.name}</Text>
            <Text style={[type.caption, styles.num, { color: theme.onDarkSoft }]}>{plural(t.players, 'player')}</Text>
          </View>
          {t.kept.map((n, i) => (
            <View key={`k${i}`} style={styles.line}>
              <Avatar name={n} size={32} />
              <Text style={[type.body, { color: theme.onDarkSoft, flex: 1 }]} numberOfLines={1}>
                {n}
              </Text>
              <Text style={[type.caption, { color: theme.onDarkSoft }]}>already in</Text>
            </View>
          ))}
          {t.drawn.map((p) => {
            const row = (
              <View style={styles.line}>
                <Avatar name={p.name} size={32} tint={p.isMe} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.bodyStrong, { color: theme.onDark }]} numberOfLines={1}>
                    {p.name}
                    {p.isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={[type.caption, { color: p.movedFromTeamName ? theme.warnInk : theme.onDarkSoft }]} numberOfLines={1}>
                    {p.movedFromTeamName ? `Moved from ${p.movedFromTeamName}` : [p.role, p.tierName ? `tier ${p.tierName}` : null].filter(Boolean).join(' · ') || `Drawn ${p.order}`}
                  </Text>
                </View>
              </View>
            );
            return a.canMove ? (
              <PressableScale key={p.pickId} onPress={() => setMoving(p)} accessibilityRole="button" accessibilityLabel={`${p.name}, ${t.name}. Move or swap`}>
                {row}
              </PressableScale>
            ) : (
              <View key={p.pickId}>{row}</View>
            );
          })}
        </Panel>
      ))}

      {!confirmed && a.canQuickDraw && <Button label="Shuffle again" icon="shuffle-variant" variant="ghost" onPress={shuffle} />}

      {moving && <DrawMoveSheet state={state} pick={moving} tournamentId={tournamentId} onState={onState} onClose={() => setMoving(null)} />}
    </Screen>
  );
}

const makeStyles = ({ fonts, figures }: Typography) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space.sm },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
    num: { fontVariant: figures },
    track: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: 3, transformOrigin: 'left' },
    spot: { fontFamily: fonts.bodyBold, fontSize: 40, lineHeight: 46, letterSpacing: -0.8, textShadowRadius: 24, textShadowOffset: { width: 0, height: 0 } },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  });
