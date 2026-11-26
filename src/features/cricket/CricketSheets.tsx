import { useState } from 'react';
import { Text } from 'react-native';

import type { CricketMatchState, CricketRules, CricketSquadMember, RecordBallRequest } from '@/api/types';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import PlayerGrid, { type GridPlayer } from '@/components/PlayerGrid';
import SegmentedControl from '@/components/SegmentedControl';
import GlassMenu from '@/components/GlassMenu';
import type { IconName } from '@/components/Icon';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import DismissalGrid, { orderDismissals } from '@/features/cricket/DismissalGrid';
import { FROM_LABEL, runSources, type Extra, type RunsFrom } from '@/features/cricket/RunPad';
import { dismissalCanTakeNonStriker, dismissalTakesFielder } from '@/lib/cricketLabels';
import { useSportTheme, useTypography } from '@/theme/SportTheme';

// The cricket console's pickers. The dismissal list comes from the engine's possibleDismissals —
// so a free hit or a wide offers only what can actually happen off that ball — and the batter and
// bowler lists come from availableBatters / availableBowlers. Nothing here re-decides the laws.

export type WicketDetails = Pick<RecordBallRequest, 'wicketType' | 'dismissedPlayerId' | 'fielderId' | 'isDirectHit' | 'runOutReceiverId' | 'countsAsBall'> & {
  runsCompleted: number;
  /** Where the runs completed came from (a run-out off byes, say); the pad's choice unless changed here. */
  runsFrom: RunsFrom;
};

/** The engine's list for this kind of ball: off a wide or a no-ball fewer ways out are possible. */
function dismissalsFor(state: CricketMatchState, extra: Extra) {
  const a = state.actions;
  if (extra === 'wide') return a.possibleDismissalsOffWide ?? a.possibleDismissals;
  if (extra === 'noBall') return a.possibleDismissalsOffNoBall ?? a.possibleDismissals;
  return a.possibleDismissals;
}

/** "The runs came from: Bat · Byes · Leg byes", only those the rules allow. Nothing to ask on a wide. */
function RunsFromChoice({ rules, extra, value, onChange }: { rules: CricketRules; extra: Extra; value: RunsFrom; onChange: (f: RunsFrom) => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const sources = runSources(rules);
  if (extra === 'wide' || sources.length < 2) return null;
  return (
    <>
      <Text style={[type.label, { color: theme.onDarkSoft }]}>The runs came from</Text>
      <SegmentedControl
        segments={sources.map((f) => ({ key: f, label: FROM_LABEL[f] }))}
        value={value}
        onChange={onChange}
        accessibilityLabel="Where the runs came from"
      />
    </>
  );
}

/**
 * 7+: more runs off one ball than the keys hold — usually overthrows. They go to the batter when
 * the ball came off the bat, otherwise they're byes or leg byes; on a wide they're all wides.
 */
export function MoreRunsSheet({
  visible,
  onClose,
  onConfirm,
  state,
  extra,
  runsFrom: startFrom,
  busy,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (runs: number, from: RunsFrom) => void;
  state: CricketMatchState;
  extra: Extra;
  runsFrom: RunsFrom;
  busy: boolean;
  error?: string;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const live = state.current!;
  const rules = state.rules;
  const [runs, setRuns] = useState(7);
  const [from, setFrom] = useState<RunsFrom>(extra === 'wide' ? 'bat' : startFrom);
  const striker = live.striker?.playerName ?? 'the batter';
  const ball = extra === 'wide' ? 'a wide' : extra === 'noBall' ? 'a no ball' : 'a legal ball';

  // The score after it, as the engine will fold it: the penalty run of a wide or no-ball on top.
  const penalty = extra === 'wide' ? rules.widePenaltyRuns : extra === 'noBall' ? rules.noBallPenaltyRuns : 0;
  const total = live.runs + runs + penalty;
  const says =
    extra === 'wide'
      ? `${runs + penalty} wides. Every run on a wide is a wide.`
      : from === 'bat'
        ? `${striker} gets ${runs}.${extra === 'noBall' ? ` Plus ${penalty} no ball.` : ''} Overthrows off the bat are the batter's.`
        : `Nothing to ${striker}: ${runs} ${from === 'byes' ? 'byes' : 'leg byes'}${extra === 'noBall' ? `, plus ${penalty} no ball` : ''}.`;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="More runs"
      subtitle={`${live.bowler?.playerName ?? 'Bowler'} to ${striker} · ${ball}`}
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button label={`Record ${runs} (${total}/${live.wickets})`} busy={busy} onPress={() => onConfirm(runs, from)} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={error} />
      <Stepper label="Runs off this ball" hint="Run, and overthrows" value={runs} min={1} max={15} onChange={setRuns} onDark />
      <RunsFromChoice rules={rules} extra={extra} value={from} onChange={setFrom} />
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>{says}</Text>
    </Sheet>
  );
}

const isRetirement = (how: string) => how === 'RetiredHurt' || how === 'RetiredOut';

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
  extra = 'none',
  runsFrom: padFrom = 'bat',
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (w: WicketDetails) => void;
  state: CricketMatchState;
  busy: boolean;
  error?: string;
  /** The pad's wide / no-ball modifier: what ball this is, and so which ways out are possible. */
  extra?: Extra;
  runsFrom?: RunsFrom;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const live = state.current!;
  const extraLabel = extra === 'wide' ? 'Wide' : extra === 'noBall' ? 'No ball' : undefined;
  const dismissals = dismissalsFor(state, extra);
  const ordered = orderDismissals(dismissals);
  const [how, setHow] = useState<string>(ordered.common[0] ?? ordered.rare[0] ?? 'Bowled');
  const [out, setOut] = useState<number | null | undefined>(live.striker?.playerId);
  const [fielder, setFielder] = useState<number | null | undefined>(undefined);
  const [directHit, setDirectHit] = useState<'direct' | 'relay'>('direct');
  const [receiver, setReceiver] = useState<number | null | undefined>(undefined);
  const [runs, setRuns] = useState(0);
  const [from, setFrom] = useState<RunsFrom>(extra === 'wide' ? 'bat' : padFrom);
  // A batter retires while the ball is dead (Law 25.4), so by default nothing is bowled. Some
  // scorers write it onto the ball it happened on; that's their choice.
  // One switch, "Counts as a ball", off by default (the user's choice, 2026-11-26; it was a two-way question).
  const [countsBall, setCountsBall] = useState(false);
  const retiring = isRetirement(how);
  // Timed out is always between balls (the server decides; the batter never faced).
  const timedOut = how === 'TimedOut';
  const betweenBalls = timedOut || (retiring && !countsBall);
  const costsAWicket = how !== 'RetiredHurt';
  // The wide's or no-ball's own run(s) go on the score too.
  const penalty = extra === 'wide' ? state.rules.widePenaltyRuns : extra === 'noBall' ? state.rules.noBallPenaltyRuns : 0;

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
      subtitle={
        betweenBalls
          ? 'Between balls · nothing bowled'
          : extraLabel
            ? `Off a ${extraLabel.toLowerCase()} · only these are possible`
            : `${live.bowler?.playerName ?? 'Bowler'} to ${live.striker?.playerName ?? 'striker'}`
      }
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button
            // Retired hurt costs no wicket, so the score after it keeps the same wickets, and it isn't red.
            label={`Confirm (${live.runs + (betweenBalls ? 0 : runs + penalty)}/${live.wickets + (costsAWicket ? 1 : 0)})`}
            icon={costsAWicket ? 'alert-octagon' : undefined}
            variant={costsAWicket ? 'danger' : 'primary'}
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
                runsCompleted: betweenBalls ? 0 : runs,
                runsFrom: from,
                ...(retiring || timedOut ? { countsAsBall: !betweenBalls } : {}),
              })
            }
          />
        </>
      }
    >
      <ErrorBanner message={error} />
      <Text style={[type.label, { color: theme.onDarkSoft }]}>How out</Text>
      <DismissalGrid
        allowed={dismissals}
        value={how}
        onChange={(d) => {
          setHow(d);
          setFielder(undefined);
          setReceiver(undefined);
        }}
      />

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

      {retiring && (
        <SwitchRow
          onDark
          label="Counts as a ball"
          hint={
            !countsBall
              ? 'Off: nothing is bowled, no ball for the bowler or the batter, and the over carries on.'
              : extraLabel
                ? `On: recorded on this ${extraLabel.toLowerCase()}, with the runs you chose for it.`
                : 'On: recorded on this ball, for the bowler and the batter, with any runs off it.'
          }
          value={countsBall}
          onChange={setCountsBall}
        />
      )}

      {timedOut && (
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>
          The new batter wasn’t ready in time. Nothing is bowled, and the bowler doesn’t get the wicket.
        </Text>
      )}

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
        <Stepper label="Runs completed" hint={extra === 'wide' ? 'Before the wicket fell · all wides' : 'Before the wicket fell'} value={runs} min={0} max={6} onChange={setRuns} onDark />
      )}
      {(runOut || how === 'ObstructingTheField') && runs > 0 && <RunsFromChoice rules={state.rules} extra={extra} value={from} onChange={setFrom} />}
      {retiring && !betweenBalls && (
        <Stepper label="Runs off this ball" hint="Before the batter retired" value={runs} min={0} max={6} onChange={setRuns} onDark />
      )}
      {retiring && !betweenBalls && runs > 0 && <RunsFromChoice rules={state.rules} extra={extra} value={from} onChange={setFrom} />}
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
  onEndInnings,
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
  /** Next batter only, when everyone left retired hurt (actions.canEndInningsNoBatters). */
  onEndInnings?: () => void;
}) {
  const { type } = useTypography();
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
          {onEndInnings && (
            <>
              <Text style={[type.caption, { color: theme.onDarkSoft }]}>
                Only batters who retired hurt are left. If none of them can come back, nobody is left to bat and the innings is over.
              </Text>
              <Button label="Nobody can come back: end the innings" variant="ghost" onPress={onEndInnings} disabled={busy} />
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/**
 * A player picked by mistake: who was recorded, then who it really was. A batter's whole stay in
 * this innings moves across; for the bowler, only this over. The engine says who may be chosen.
 */
export function ReplacePlayerSheet({
  visible,
  onClose,
  onConfirm,
  state,
  busy,
  error,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (playerId: number, replacementId: number) => void;
  state: CricketMatchState;
  busy: boolean;
  error?: string;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const a = state.actions;
  const wrongOnes = [
    ...a.replaceableBatters.map((p) => ({ ...p, bowler: false })),
    ...(a.replaceableBowler ? [{ ...a.replaceableBowler, bowler: true }] : []),
  ];
  const [wrongId, setWrongId] = useState<number | null>(wrongOnes.length === 1 ? wrongOnes[0].playerId : null);
  const [rightId, setRightId] = useState<number | null>(null);
  const wrong = wrongOnes.find((p) => p.playerId === wrongId);
  const choices = !wrong ? [] : wrong.bowler ? a.bowlerReplacements : a.batterReplacements;
  const right = choices.find((p) => p.playerId === rightId);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="Correct a player"
      subtitle="Picked the wrong name? Nothing that happened changes — only who it's credited to."
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={right ? `Make it ${right.playerName}` : 'Correct'}
            icon="account-convert"
            disabled={!wrong || !right}
            busy={busy}
            onPress={() => wrong && right && onConfirm(wrong.playerId, right.playerId)}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <ErrorBanner message={error} />
      <Text style={[type.label, { color: theme.onDarkSoft }]}>Recorded by mistake</Text>
      <PlayerGrid
        dark
        label="Recorded by mistake"
        players={wrongOnes.map((p) => ({ id: p.playerId, name: p.playerName, sub: p.bowler ? 'Bowling this over' : 'Batting' }))}
        selected={wrongId}
        onSelect={(id) => {
          setWrongId(id);
          setRightId(null);
        }}
      />
      {wrong && (
        <>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>It was really</Text>
          {choices.length === 0 ? (
            <Text style={[type.body, { color: theme.onDarkSoft }]}>
              {wrong.bowler ? 'Nobody else may bowl this over.' : 'Everyone else in the XI has batted already.'}
            </Text>
          ) : (
            <PlayerGrid dark label="It was really" players={choices.map((p) => member(p))} selected={rightId} onSelect={setRightId} />
          )}
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>
            {wrong.bowler
              ? `This over moves to the player you choose. Earlier overs stay with whoever bowled them.`
              : `${wrong.playerName}'s whole innings so far moves to the player you choose.`}
          </Text>
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
  const { type } = useTypography();
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

export type MoreAction =
  | 'scorecard' | 'reduce' | 'declare' | 'endInnings' | 'signOff' | 'noResult' | 'awardHome' | 'awardAway'
  | 'penalty' | 'followOn' | 'superOver' | 'replace';

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
  const { type } = useTypography();
  const theme = useSportTheme();
  const a = state.actions;
  const items: { key: MoreAction; label: string; icon: IconName; show: boolean; danger?: boolean }[] = [
    { key: 'scorecard', label: 'Full scorecard', icon: 'table-large', show: true },
    { key: 'penalty', label: '+5 penalty runs', icon: 'plus-box-outline', show: a.canRecordBall && state.rules.penaltyRunsAllowed },
    { key: 'reduce', label: 'Reduce overs (rain)', icon: 'weather-pouring', show: a.canReduceOvers },
    { key: 'replace', label: 'Correct a player', icon: 'account-convert', show: a.canRecordBall && (a.replaceableBatters.length > 0 || !!a.replaceableBowler) },
    { key: 'followOn', label: 'Enforce the follow-on', icon: 'repeat', show: a.canEnforceFollowOn },
    { key: 'superOver', label: 'Start a super over', icon: 'bullseye-arrow', show: a.canStartSuperOver },
    { key: 'declare', label: 'Declare the innings', icon: 'flag-outline', show: a.canDeclare },
    { key: 'endInnings', label: 'End innings / stop play', icon: 'stop-circle-outline', show: a.canEndInnings, danger: true },
    { key: 'signOff', label: 'Sign off the match', icon: 'flag-checkered', show: a.canComplete },
    { key: 'noResult', label: 'Record no result', icon: 'weather-lightning-rainy', show: a.canComplete && a.canRecordNoResult !== false, danger: true },
    // A knockout match can't end without a side going through: one that can't be finished is awarded.
    { key: 'awardHome', label: `Award to ${state.homeTeamName}`, icon: 'trophy-outline', show: a.canComplete && a.canRecordNoResult === false, danger: true },
    { key: 'awardAway', label: `Award to ${state.awayTeamName}`, icon: 'trophy-outline', show: a.canComplete && a.canRecordNoResult === false, danger: true },
  ];
  const note = 'Only the actions the laws allow right now are shown.';
  // Glass: a menu that springs from the ⋯ button rather than a sheet from the bottom edge.
  if (theme.mode === 'dark') {
    return (
      <GlassMenu
        visible={visible}
        onClose={onClose}
        title="Match actions"
        items={items.filter((i) => i.show).map((i) => ({ key: i.key, label: i.label, icon: i.icon, apart: i.danger }))}
        onPick={onAction}
        footnote={note}
      />
    );
  }
  return (
    <Sheet visible={visible} onClose={onClose} dark title="Match actions">
      {items
        .filter((i) => i.show)
        .map((i) => (
          <Button key={i.key} label={i.label} icon={i.icon} variant={i.danger ? 'ghost' : 'deck'} onPress={() => onAction(i.key)} />
        ))}
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>{note}</Text>
    </Sheet>
  );
}
