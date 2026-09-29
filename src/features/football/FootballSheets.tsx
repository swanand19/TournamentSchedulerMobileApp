import { useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import type { FootballMatch, MatchEvent, Player, RecordEventResponse, SquadStatus } from '@/api/types';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import PlayerGrid, { type GridPlayer } from '@/components/PlayerGrid';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import { playerIndex } from '@/features/football/useFootballMatch';
import { useAction } from '@/hooks/useAction';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// The pickers behind the live console's buttons. Each asks only what the server needs for that
// event, offers only the players who can legally be chosen (on the pitch, on the bench), and
// leaves the final ruling — second yellows, sub limits, depleted sides — to the server, whose
// words come back in the banner if it refuses.
//
// Every sheet is given a fresh key by the console when opened, so its choices start empty.

type Side = 'home' | 'away';

type Base = {
  visible: boolean;
  onClose: () => void;
  /** Called after the server accepted; the console reloads. */
  onDone: (result?: RecordEventResponse) => void;
  match: FootballMatch;
};

function teamIdOf(match: FootballMatch, side: Side) {
  return (side === 'home' ? match.homeTeamId : match.awayTeamId) ?? 0;
}

function teamNameOf(match: FootballMatch, side: Side) {
  return side === 'home' ? match.homeTeamName : match.awayTeamName;
}

function squadOf(match: FootballMatch, side: Side, statuses: SquadStatus[]): Player[] {
  const index = playerIndex(match);
  const teamId = teamIdOf(match, side);
  return match.matchPlayers
    .filter((mp) => mp.teamId === teamId && statuses.includes(mp.squadStatus))
    .map((mp) => index.get(mp.playerId))
    .filter((p): p is Player => !!p)
    .sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name));
}

const toGrid = (p: Player, extra?: Partial<GridPlayer>): GridPlayer => ({
  id: p.id,
  number: p.jerseyNumber,
  name: p.name,
  sub: p.position ?? undefined,
  ...extra,
});

function record(matchId: number, body: object) {
  return api.call<RecordEventResponse>('MATCH_EVENT_RECORD', { routeParams: { matchId }, body });
}

// ---------------------------------------------------------------------------------------------

export function GoalSheet({ visible, onClose, onDone, match, side }: Base & { side: Side }) {
  const action = useAction();
  const [scorer, setScorer] = useState<number | null | undefined>(undefined); // undefined = not chosen
  const [assist, setAssist] = useState<number | null>(null);
  const onPitch = squadOf(match, side, ['Starting']);
  const name = teamNameOf(match, side);
  const next = side === 'home' ? `${match.homeScore + 1}–${match.awayScore}` : `${match.homeScore}–${match.awayScore + 1}`;

  const save = async () => {
    const res = await action.run(() =>
      record(match.id, {
        eventType: 'Goal',
        teamId: teamIdOf(match, side),
        playerId: scorer ?? null,
        relatedPlayerId: scorer ? assist : null,
      }),
    );
    if (res.ok) {
      haptic.success();
      onDone(res.value);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title={`Goal · ${name}`}
      subtitle="Who scored?"
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={`Save goal (${next})`}
            icon="lightning-bolt"
            onPress={save}
            busy={action.busy}
            disabled={scorer === undefined}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <PlayerGrid
        dark
        label="Scorer"
        players={[...onPitch.map((p) => toGrid(p)), { id: null, name: 'Unknown / own goal', sub: 'Credited to the team only' }]}
        selected={scorer}
        onSelect={(id) => {
          setScorer(id);
          if (id === null || id === assist) setAssist(null);
        }}
      />
      {scorer ? (
        <AssistPicker players={onPitch.filter((p) => p.id !== scorer)} value={assist} onChange={setAssist} />
      ) : null}
    </Sheet>
  );
}

function AssistPicker({ players, value, onChange }: { players: Player[]; value: number | null; onChange: (id: number | null) => void }) {
  const theme = useSportTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.label, { color: theme.onDarkSoft }]}>Assist (optional)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        <Chip label="No assist" selected={value === null} onPress={() => onChange(null)} />
        {players.map((p) => (
          <Chip
            key={p.id}
            label={`${p.jerseyNumber != null ? `#${p.jerseyNumber} ` : ''}${p.name}`}
            selected={value === p.id}
            onPress={() => onChange(p.id)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

export function CardSheet({
  visible,
  onClose,
  onDone,
  match,
  events,
  colour,
}: Base & { events: MatchEvent[]; colour: 'yellow' | 'red' }) {
  const theme = useSportTheme();
  const action = useAction();
  const [side, setSide] = useState<Side>('home');
  const [player, setPlayer] = useState<number | null | undefined>(undefined);
  const yellow = colour === 'yellow';

  const booked = new Map<number, number>();
  events.filter((e) => e.eventType === 'YellowCard' && e.playerId).forEach((e) => booked.set(e.playerId!, (booked.get(e.playerId!) ?? 0) + 1));

  // A yellow can go to anyone still involved (the bench included); a red only to someone on the pitch.
  const eligible = squadOf(match, side, yellow ? ['Starting', 'Bench'] : ['Starting']);
  const chosen = eligible.find((p) => p.id === player);
  const secondYellow = yellow && chosen && (booked.get(chosen.id) ?? 0) >= 1;

  const save = async () => {
    if (!chosen) return;
    const res = await action.run(() =>
      record(match.id, { eventType: yellow ? 'YellowCard' : 'RedCard', teamId: teamIdOf(match, side), playerId: chosen.id }),
    );
    if (res.ok) {
      haptic.heavy();
      onDone(res.value);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title={yellow ? 'Yellow card' : 'Red card'}
      subtitle="Who's being booked?"
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={secondYellow ? 'Book & send off' : yellow ? 'Book player' : 'Send off'}
            variant={yellow && !secondYellow ? 'primary' : 'danger'}
            icon="card"
            onPress={save}
            busy={action.busy}
            disabled={!chosen}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <SegmentedControl
        segments={[
          { key: 'home', label: match.homeTeamName },
          { key: 'away', label: match.awayTeamName },
        ]}
        value={side}
        onChange={(s) => {
          setSide(s);
          setPlayer(undefined);
        }}
        accessibilityLabel="Team"
      />
      {secondYellow && (
        <Text style={[type.bodyStrong, { color: theme.accent }]} accessibilityRole="alert">
          {chosen?.name} is already booked — a second yellow sends them off.
        </Text>
      )}
      <PlayerGrid
        dark
        label="Player"
        players={eligible.map((p) =>
          toGrid(p, {
            badge: booked.get(p.id) ? { icon: 'card', color: theme.yellowCard, label: 'Already booked' } : undefined,
            sub: match.matchPlayers.find((mp) => mp.playerId === p.id)?.squadStatus === 'Bench' ? 'On the bench' : p.position ?? undefined,
          }),
        )}
        selected={player}
        onSelect={(id) => setPlayer(id)}
      />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------

export function SubSheet({ visible, onClose, onDone, match, events }: Base & { events: MatchEvent[] }) {
  const theme = useSportTheme();
  const action = useAction();
  const [side, setSide] = useState<Side>('home');
  const [off, setOff] = useState<number | null | undefined>(undefined);
  const [on, setOn] = useState<number | null | undefined>(undefined);
  const teamId = teamIdOf(match, side);
  const used = events.filter((e) => e.eventType === 'SubstitutionIn' && e.teamId === teamId).length;
  const max = match.maxSubstitutions ?? 0;

  const save = async () => {
    const res = await action.run(() =>
      record(match.id, { eventType: 'SubstitutionIn', teamId, playerId: off, relatedPlayerId: on }),
    );
    if (res.ok) {
      haptic.tap();
      onDone(res.value);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="Substitution"
      subtitle={`${teamNameOf(match, side)}: ${used} of ${max} used${match.rollingSubsAllowed ? ' · rolling' : ''}`}
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Make substitution" icon="swap-horizontal" onPress={save} busy={action.busy} disabled={!off || !on} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <SegmentedControl
        segments={[
          { key: 'home', label: match.homeTeamName },
          { key: 'away', label: match.awayTeamName },
        ]}
        value={side}
        onChange={(s) => {
          setSide(s);
          setOff(undefined);
          setOn(undefined);
        }}
        accessibilityLabel="Team"
      />
      {used >= max && (
        <Text style={[type.bodyStrong, { color: theme.accent }]}>All {max} substitutions have been used.</Text>
      )}
      <Text style={[type.label, { color: theme.onDarkSoft }]}>Coming off</Text>
      <PlayerGrid dark label="Coming off" players={squadOf(match, side, ['Starting']).map((p) => toGrid(p))} selected={off} onSelect={setOff} />
      <Text style={[type.label, { color: theme.onDarkSoft }]}>Coming on</Text>
      {squadOf(match, side, ['Bench']).length === 0 ? (
        <Text style={[type.body, { color: theme.onDarkSoft }]}>Nobody is on the bench.</Text>
      ) : (
        <PlayerGrid dark label="Coming on" players={squadOf(match, side, ['Bench']).map((p) => toGrid(p))} selected={on} onSelect={setOn} />
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------

export function StoppageSheet({ visible, onClose, onDone, match }: Base) {
  const action = useAction();
  const remaining = Math.max(1, match.stoppageRemainingThisPeriod);
  const [minutes, setMinutes] = useState(1);

  const save = async () => {
    const res = await action.run(() => api.call('MATCH_CLOCK_ADD_TIME', { routeParams: { matchId: match.id }, body: { minutes } }));
    if (res.ok) {
      haptic.tap();
      onDone();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="Add stoppage time"
      subtitle={`Up to ${match.stoppageRemainingThisPeriod} more minute(s) this period — capped at half its length.`}
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button label={`Add ${minutes} min`} icon="timer-plus-outline" onPress={save} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <Stepper label="Minutes" value={minutes} min={1} max={remaining} onChange={setMinutes} onDark />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------

export function PenaltiesStartSheet({ visible, onClose, onDone, match }: Base) {
  const action = useAction();
  const onPitch = Math.min(squadOf(match, 'home', ['Starting']).length, squadOf(match, 'away', ['Starting']).length);
  const maxTakers = Math.max(1, onPitch);
  const [takers, setTakers] = useState(Math.min(5, maxTakers));

  const start = async () => {
    const res = await action.run(() =>
      api.call('MATCH_PENALTIES_START', { routeParams: { matchId: match.id }, body: { takersPerSide: takers } }),
    );
    if (res.ok) {
      haptic.success();
      onDone();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="Penalty shootout"
      subtitle={`Level at ${match.homeScore}–${match.awayScore}. Kicks alternate; sudden death if still level.`}
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Start shootout" icon="bullseye-arrow" onPress={start} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <Stepper label="Takers per side" hint={`${onPitch} on the pitch for the smaller side`} value={takers} min={1} max={maxTakers} onChange={setTakers} onDark />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------------------------

/** Force-completing: an abandonment, or a forfeit awarded to one side. Behind the overflow. */
export function EndMatchSheet({ visible, onClose, onDone, match }: Base) {
  const theme = useSportTheme();
  const action = useAction();

  const finish = async (winner: number | null) => {
    const who = winner === match.homeTeamId ? match.homeTeamName : winner === match.awayTeamId ? match.awayTeamName : null;
    const ok = await confirm({
      title: who ? `Award the match to ${who}?` : 'End the match as it stands?',
      message: who
        ? 'The match is closed and recorded as won by forfeit.'
        : `The match is closed at ${match.homeScore}–${match.awayScore}, even though the rules say it isn't finished.`,
      confirmLabel: who ? 'Award match' : 'End match',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() =>
      api.call('MATCH_COMPLETE', { routeParams: { matchId: match.id }, body: { force: true, awardWinnerTeamId: winner } }),
    );
    if (res.ok) {
      haptic.heavy();
      onDone();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} dark title="End match early" subtitle="For abandonments and referee decisions. Normal endings use the match controls.">
      <ErrorBanner message={action.error?.message} />
      <Button label="End as it stands" icon="flag-checkered" variant="deck" onPress={() => finish(null)} disabled={action.busy} />
      <Button label={`Award to ${match.homeTeamName}`} icon="trophy-outline" variant="deck" onPress={() => finish(match.homeTeamId)} disabled={action.busy} />
      <Button label={`Award to ${match.awayTeamName}`} icon="trophy-outline" variant="deck" onPress={() => finish(match.awayTeamId)} disabled={action.busy} />
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>These can’t be undone.</Text>
    </Sheet>
  );
}
