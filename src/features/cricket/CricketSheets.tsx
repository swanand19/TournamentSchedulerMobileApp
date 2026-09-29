import { useState } from 'react';
import { Text, View } from 'react-native';

import type { CricketMatchState, CricketSquadMember, RecordBallRequest } from '@/api/types';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import PlayerGrid, { type GridPlayer } from '@/components/PlayerGrid';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import { dismissalCanTakeNonStriker, dismissalLabel, dismissalTakesFielder } from '@/lib/cricketLabels';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// The cricket console's pickers. The dismissal list comes from the engine's possibleDismissals —
// so a free hit or a wide offers only what can actually happen off that ball — and the batter and
// bowler lists come from availableBatters / availableBowlers. Nothing here re-decides the laws.

export type WicketDetails = Pick<RecordBallRequest, 'wicketType' | 'dismissedPlayerId' | 'fielderId' | 'isDirectHit' | 'runOutReceiverId'> & {
  runsCompleted: number;
};

const member = (m: CricketSquadMember, sub?: string): GridPlayer => ({
  id: m.playerId,
  name: m.playerName,
  sub: sub ?? ([m.isCaptain ? 'Captain' : null, m.isWicketKeeper ? 'Keeper' : null].filter(Boolean).join(' · ') || undefined),
});

export function WicketSheet({
  visible,
  onClose,
  onConfirm,
  state,
  busy,
  error,
  extraLabel,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (w: WicketDetails) => void;
  state: CricketMatchState;
  busy: boolean;
  error?: string;
  /** "Wide" / "No ball" when a modifier is on, so the scorer sees what ball this is. */
  extraLabel?: string;
}) {
  const theme = useSportTheme();
  const live = state.current!;
  const dismissals = state.actions.possibleDismissals;
  const [how, setHow] = useState<string>(dismissals[0] ?? 'Bowled');
  const [out, setOut] = useState<number | null | undefined>(live.striker?.playerId);
  const [fielder, setFielder] = useState<number | null | undefined>(undefined);
  const [directHit, setDirectHit] = useState<'direct' | 'relay'>('direct');
  const [receiver, setReceiver] = useState<number | null | undefined>(undefined);
  const [runs, setRuns] = useState(0);

  const fielders = state.squad.filter((p) => p.teamId === live.bowlingTeamId && p.squadStatus === 'Playing');
  const needsFielder = dismissalTakesFielder(how);
  const runOut = how === 'RunOut';
  const relay = runOut && directHit === 'relay';
  // Caught, bowled, LBW, stumped… only ever the batter facing, so there's nothing to ask.
  const eitherEnd = dismissalCanTakeNonStriker(how);
  const striker = live.striker;
  const batters = eitherEnd ? [live.striker, live.nonStriker].filter((b): b is NonNullable<typeof b> => !!b) : [];
  const outId = eitherEnd ? out : striker?.playerId;
  const ready = !!outId && (!needsFielder || !!fielder) && (!relay || !!receiver);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="Wicket"
      subtitle={extraLabel ? `Off a ${extraLabel.toLowerCase()}` : `${live.bowler?.playerName ?? 'Bowler'} to ${live.striker?.playerName ?? 'striker'}`}
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={`Confirm (${live.runs + runs}/${live.wickets + 1})`}
            icon="alert-octagon"
            variant="danger"
            disabled={!ready}
            busy={busy}
            style={{ flex: 2 }}
            onPress={() =>
              onConfirm({
                wicketType: how,
                dismissedPlayerId: outId ?? null,
                fielderId: needsFielder ? fielder ?? null : null,
                isDirectHit: runOut && directHit === 'direct',
                runOutReceiverId: relay ? receiver ?? null : null,
                runsCompleted: runs,
              })
            }
          />
        </>
      }
    >
      <ErrorBanner message={error} />
      <Text style={[type.label, { color: theme.onDarkSoft }]}>How out</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {dismissals.map((d) => (
          <Chip
            key={d}
            label={dismissalLabel(d)}
            tone="danger"
            selected={how === d}
            onPress={() => {
              setHow(d);
              setFielder(undefined);
              setReceiver(undefined);
            }}
          />
        ))}
      </View>

      <Text style={[type.label, { color: theme.onDarkSoft }]}>Who’s out</Text>
      {eitherEnd ? (
        <PlayerGrid
          dark
          label="Batter out"
          players={batters.map((b) => ({ id: b.playerId, name: b.playerName, sub: `${b.onStrike ? 'Striker' : 'Non-striker'} · ${b.runs} (${b.ballsFaced})` }))}
          selected={out}
          onSelect={setOut}
        />
      ) : striker ? (
        <Text style={[type.bodyStrong, { color: theme.onDark }]}>
          {striker.playerName} <Text style={[type.body, { color: theme.onDarkSoft }]}>· striker · {striker.runs} ({striker.ballsFaced})</Text>
        </Text>
      ) : null}

      {runOut && (
        <SegmentedControl
          segments={[
            { key: 'direct', label: 'Direct hit' },
            { key: 'relay', label: 'Two fielders' },
          ]}
          value={directHit}
          onChange={(v) => {
            setDirectHit(v);
            setReceiver(undefined);
          }}
          accessibilityLabel="How the run-out happened"
        />
      )}

      {needsFielder && (
        <>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>
            {how === 'Caught' ? 'Caught by' : how === 'Stumped' ? 'Stumped by' : relay ? 'Thrown by' : 'Hit the stumps'}
          </Text>
          <PlayerGrid dark label="Fielder" players={fielders.map((f) => member(f))} selected={fielder} onSelect={setFielder} />
        </>
      )}
      {relay && (
        <>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>Took the throw</Text>
          <PlayerGrid
            dark
            label="Receiver"
            players={fielders.filter((f) => f.playerId !== fielder).map((f) => member(f))}
            selected={receiver}
            onSelect={setReceiver}
          />
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>The thrower gets the run-out; the receiver is named on the scorecard.</Text>
        </>
      )}

      {(runOut || how === 'Stumped' || how === 'HitWicket' || how === 'ObstructingTheField') && (
        <Stepper label="Runs completed" hint="Before the wicket fell" value={runs} min={0} max={6} onChange={setRuns} onDark />
      )}
    </Sheet>
  );
}

/** Next batter in, or who bowls the next over. Blocking: the match can't go on without an answer. */
export function PickPlayerSheet({
  visible,
  title,
  subtitle,
  players,
  cta,
  onPick,
  busy,
  error,
  onClose,
  onUndo,
  strike,
}: {
  visible: boolean;
  title: string;
  subtitle: string;
  players: GridPlayer[];
  cta: string;
  onPick: (id: number, onStrike?: boolean) => void;
  busy: boolean;
  error?: string;
  onClose: () => void;
  /** The sheet can't be dismissed, so a mis-scored last ball has to be undoable from here. */
  onUndo?: () => void;
  /** Next batter only: the batter still in, and whether the newcomer faces by default. */
  strike?: { survivorName: string; newOnStrike: boolean };
}) {
  const theme = useSportTheme();
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  const [facing, setFacing] = useState<'new' | 'survivor'>(strike?.newOnStrike === false ? 'survivor' : 'new');
  const name = players.find((p) => p.id === chosen)?.name;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dismissible={false}
      dark
      title={title}
      subtitle={subtitle}
      footer={
        <>
          {onUndo && <Button label="Undo" icon="undo" variant="deck" onPress={onUndo} disabled={busy} style={{ flex: 1 }} accessibilityLabel="Undo last ball" />}
          <Button
            label={name ? `${cta}: ${name}` : cta}
            icon="check"
            disabled={!chosen}
            busy={busy}
            onPress={() => chosen && onPick(chosen, strike ? facing === 'new' : undefined)}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <ErrorBanner message={error} />
      {players.length === 0 ? (
        <Text style={[type.body, { color: theme.onDarkSoft }]}>Nobody is available. End the innings from the menu.</Text>
      ) : (
        <>
          {strike && (
            <>
              <Text style={[type.label, { color: theme.onDarkSoft }]}>Faces the next ball</Text>
              <SegmentedControl
                segments={[
                  { key: 'new', label: name ?? 'New batter' },
                  { key: 'survivor', label: strike.survivorName },
                ]}
                value={facing}
                onChange={setFacing}
                accessibilityLabel="Who faces the next ball"
              />
              <Text style={[type.label, { color: theme.onDarkSoft }]}>Coming in</Text>
            </>
          )}
          <PlayerGrid dark label={title} players={players} selected={chosen} onSelect={setChosen} />
        </>
      )}
    </Sheet>
  );
}

export function ReduceOversSheet({
  visible,
  onClose,
  onConfirm,
  state,
  busy,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (overs: number) => void;
  state: CricketMatchState;
  busy: boolean;
  error?: string;
}) {
  const theme = useSportTheme();
  const live = state.current!;
  const limit = live.oversLimit ?? 20;
  const bowled = Math.ceil(parseFloat(live.overs) || 0);
  const [overs, setOvers] = useState(Math.max(bowled, limit - 1));
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="Reduce overs"
      subtitle={`${live.battingTeamName} are ${live.overs} into a ${limit}-over innings.`}
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button label={`Cut to ${overs} overs`} icon="weather-pouring" busy={busy} disabled={overs >= limit} onPress={() => onConfirm(overs)} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={error} />
      <Stepper label="New total for this innings" value={overs} min={Math.max(1, bowled)} max={limit - 1} onChange={setOvers} onDark />
      {state.dls && (
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>
          {live.inningsNumber === 2 ? 'DLS will revise the target.' : 'DLS will account for the lost overs when the chase target is set.'}
        </Text>
      )}
    </Sheet>
  );
}

export type MoreAction = 'scorecard' | 'reduce' | 'declare' | 'endInnings' | 'signOff' | 'noResult' | 'penalty' | 'followOn' | 'superOver';

/** Everything the scorer does rarely, in one menu — each only when the engine allows it. */
export function MoreSheet({
  visible,
  onClose,
  state,
  onAction,
}: {
  visible: boolean;
  onClose: () => void;
  state: CricketMatchState;
  onAction: (a: MoreAction) => void;
}) {
  const theme = useSportTheme();
  const a = state.actions;
  const items: { key: MoreAction; label: string; icon: Parameters<typeof Button>[0]['icon']; show: boolean; danger?: boolean }[] = [
    { key: 'scorecard', label: 'Full scorecard', icon: 'table-large', show: true },
    { key: 'penalty', label: '+5 penalty runs', icon: 'plus-box-outline', show: a.canRecordBall && state.rules.penaltyRunsAllowed },
    { key: 'reduce', label: 'Reduce overs (rain)', icon: 'weather-pouring', show: a.canReduceOvers },
    { key: 'followOn', label: 'Enforce the follow-on', icon: 'repeat', show: a.canEnforceFollowOn },
    { key: 'superOver', label: 'Start a super over', icon: 'bullseye-arrow', show: a.canStartSuperOver },
    { key: 'declare', label: 'Declare the innings', icon: 'flag-outline', show: a.canDeclare },
    { key: 'endInnings', label: 'End innings / stop play', icon: 'stop-circle-outline', show: a.canEndInnings, danger: true },
    { key: 'signOff', label: 'Sign off the match', icon: 'flag-checkered', show: a.canComplete },
    { key: 'noResult', label: 'Record no result', icon: 'weather-lightning-rainy', show: a.canComplete, danger: true },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} dark title="Match actions">
      {items
        .filter((i) => i.show)
        .map((i) => (
          <Button key={i.key} label={i.label} icon={i.icon} variant={i.danger ? 'ghost' : 'deck'} onPress={() => onAction(i.key)} />
        ))}
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>Only the actions the laws allow right now are shown.</Text>
    </Sheet>
  );
}
