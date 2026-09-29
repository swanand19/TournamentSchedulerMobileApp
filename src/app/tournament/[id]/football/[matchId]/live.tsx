import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { FootballMatch, MatchEvent, RecordEventResponse } from '@/api/types';
import Bump from '@/components/Bump';
import Button from '@/components/Button';
import { Deck } from '@/components/Card';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import {
  CardSheet,
  EndMatchSheet,
  GoalSheet,
  PenaltiesStartSheet,
  StoppageSheet,
  SubSheet,
} from '@/features/football/FootballSheets';
import MatchClock, { elapsedSeconds } from '@/features/football/MatchClock';
import Timeline from '@/features/football/Timeline';
import { playerIndex, useFootballMatch } from '@/features/football/useFootballMatch';
import { useAction } from '@/hooks/useAction';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// The football scoring console. Top: the scoreboard (observation). Bottom: the scoring pad in the
// thumb zone (action). Between them, the match controls — and only the ones the server's flags say
// are legal right now — and the timeline.
//
// Every action is followed by a reload of the match, and the match polls every 5s, so another
// phone following along stays within a few seconds.

type SheetKind = 'goal' | 'card' | 'sub' | 'stoppage' | 'penalties' | 'end';
type SheetState = { kind: SheetKind | null; open: boolean; key: number; side: 'home' | 'away'; colour: 'yellow' | 'red' };

export default function FootballLive() {
  const router = useRouter();
  const theme = useSportTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { id: tournamentId } = useTournament();
  const data = useFootballMatch(Number(matchId), { pollMs: 5000 });
  const action = useAction();
  const [sheet, setSheet] = useState<SheetState>({ kind: null, open: false, key: 0, side: 'home', colour: 'yellow' });

  const match = data.data?.match;
  const events = data.data?.events ?? [];
  const status = match?.status;
  const params = { id: String(tournamentId), matchId: String(matchId) };

  // Not kicked off yet: that's the setup screen's job.
  useEffect(() => {
    if (status === 'NotStarted') {
      router.replace({ pathname: '/tournament/[id]/football/[matchId]/setup', params: { id: String(tournamentId), matchId: String(matchId) } });
    }
  }, [status, router, tournamentId, matchId]);

  if (!match) {
    return <Screen error={data.error} onRetry={data.refresh}>{data.loading && <Skeleton rows={4} height={160} />}</Screen>;
  }

  const open = (kind: SheetKind, extra: Partial<SheetState> = {}) =>
    setSheet((s) => ({ ...s, ...extra, kind, open: true, key: s.key + 1 }));
  const close = () => setSheet((s) => ({ ...s, open: false }));
  const done = (result?: RecordEventResponse) => {
    close();
    data.reload();
    if (result?.matchAbandoned) {
      haptic.heavy();
      Alert.alert('Match abandoned', 'A side has fewer players than the minimum allowed, so the match has been ended.');
    }
  };

  const act = async (fn: () => Promise<unknown>, feel: () => void = haptic.tap) => {
    const res = await action.run(fn);
    if (res.ok) {
      feel();
      data.reload();
    }
  };

  const live = match.isLiveOrPaused;
  const ended = match.periodState === 'Ended';
  const completed = match.status === 'Completed';
  const shootout = match.status === 'PenaltyShootout';
  const periodShort = match.currentPeriodLabel;

  const endPeriod = async () => {
    const early = elapsedSeconds(match, Date.now()) < (match.currentPeriodMinutes + match.extraMinutesAddedThisHalf) * 60;
    const ok = await confirm({
      title: `End the ${periodShort}?`,
      message: early
        ? `There's still time left in the ${periodShort}. ${match.isFinalPeriod ? 'This is the last period, so the result will then need settling.' : 'The clock stops until the next period kicks off.'}`
        : match.isFinalPeriod
          ? 'This is the last period — the result will then need settling.'
          : 'The clock stops until the next period kicks off.',
      confirmLabel: 'Blow the whistle',
    });
    if (ok) act(() => api.call('MATCH_PERIOD_END', { routeParams: { matchId } }), haptic.success);
  };

  const fullTime = async () => {
    const ok = await confirm({
      title: 'Full time?',
      message: `Sign off the result: ${match.homeTeamName} ${match.homeScore}–${match.awayScore} ${match.awayTeamName}.`,
      confirmLabel: 'Confirm result',
    });
    if (ok) act(() => api.call('MATCH_COMPLETE', { routeParams: { matchId }, body: { force: false } }), haptic.success);
  };

  const goToPenalties = () => router.replace({ pathname: '/tournament/[id]/football/[matchId]/penalties', params });

  // --- Footer: the scoring pad, or what to do next when there's nothing to score ---
  let footer;
  if (live) {
    footer = (
      <>
        {ended && (
          <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>
            Ball out of play — cards and subs are allowed; goals wait for the next kick-off.
          </Text>
        )}
        <View style={styles.row}>
          <Button
            label="+1 Goal"
            caption={match.homeTeamName.toUpperCase()}
            icon="soccer"
            size="xl"
            display
            disabled={ended}
            onPress={() => open('goal', { side: 'home' })}
            style={{ flex: 1 }}
            accessibilityLabel={`Goal for ${match.homeTeamName}`}
          />
          <Button
            label="+1 Goal"
            caption={match.awayTeamName.toUpperCase()}
            icon="soccer"
            size="xl"
            display
            disabled={ended}
            onPress={() => open('goal', { side: 'away' })}
            style={{ flex: 1 }}
            accessibilityLabel={`Goal for ${match.awayTeamName}`}
          />
        </View>
        <View style={styles.row}>
          <Button label="Yellow" icon="card" iconColor={theme.yellowCard} variant="secondary" onPress={() => open('card', { colour: 'yellow' })} style={{ flex: 1 }} />
          <Button label="Red" icon="card" variant="danger" onPress={() => open('card', { colour: 'red' })} style={{ flex: 1 }} />
          <Button label="Sub" icon="swap-horizontal" variant="secondary" onPress={() => open('sub')} style={{ flex: 1 }} />
        </View>
      </>
    );
  } else if (shootout) {
    footer = <Button label="Open penalty shootout" icon="bullseye-arrow" size="lg" onPress={goToPenalties} />;
  } else if (completed) {
    footer = <Button label="Back to matches" icon="arrow-left" size="lg" variant="deck" onPress={() => router.back()} />;
  }

  return (
    <Screen footer={footer} onRefresh={data.refresh} refreshing={data.refreshing} error={action.error ?? data.error} onRetry={data.refresh}>
      <Scoreboard match={match} events={events} />

      {live && (
        <View style={{ gap: space.sm }}>
          {/* The one thing the referee is waiting on, big — then the everyday clock controls. */}
          {match.canStartNextPeriod && (
            <Button
              label={`Kick off ${match.nextPeriodLabel ?? 'next period'}`}
              icon="whistle"
              size="lg"
              busy={action.busy}
              onPress={() => act(() => api.call('MATCH_PERIOD_NEXT', { routeParams: { matchId } }), haptic.success)}
            />
          )}
          {match.canStartPenalties && (
            <Button label="Go to penalties" icon="bullseye-arrow" size="lg" onPress={() => open('penalties')} />
          )}
          {match.canCompleteNormally && (
            <Button label="Full time" icon="flag-checkered" variant="success" size="lg" busy={action.busy} onPress={fullTime} />
          )}

          <View style={styles.row}>
            {match.canEndPeriod &&
              (match.status === 'Paused' ? (
                <Button label="Resume" icon="play" variant="deck" busy={action.busy} onPress={() => act(() => api.call('MATCH_CLOCK_RESUME', { routeParams: { matchId } }))} style={{ flex: 1 }} />
              ) : (
                <Button label="Pause" icon="pause" variant="deck" busy={action.busy} onPress={() => act(() => api.call('MATCH_CLOCK_PAUSE', { routeParams: { matchId } }))} style={{ flex: 1 }} />
              ))}
            {match.canEndPeriod && match.stoppageRemainingThisPeriod > 0 && (
              <Button label="+ Time" icon="timer-plus-outline" variant="deck" onPress={() => open('stoppage')} style={{ flex: 1 }} />
            )}
            {match.canEndPeriod && (
              <Button label="End half" icon="whistle" variant="deck" onPress={endPeriod} style={{ flex: 1 }} accessibilityLabel={`End the ${periodShort}`} />
            )}
            <PressableScale
              onPress={() => open('end')}
              accessibilityLabel="More: end match early"
              style={[styles.more, { backgroundColor: theme.deckRaised, borderColor: theme.borderOnDark }]}
            >
              <Icon name="dots-vertical" size={24} color={theme.onDark} />
            </PressableScale>
          </View>
        </View>
      )}

      <SectionHeader
        eyebrow={plural(events.filter((e) => ['Goal', 'YellowCard', 'RedCard', 'SubstitutionIn'].includes(e.eventType)).length, 'event')}
        title="Match timeline"
      />
      <Timeline match={match} events={events} />

      {sheet.kind === 'goal' && <GoalSheet key={sheet.key} visible={sheet.open} onClose={close} onDone={done} match={match} side={sheet.side} />}
      {sheet.kind === 'card' && <CardSheet key={sheet.key} visible={sheet.open} onClose={close} onDone={done} match={match} events={events} colour={sheet.colour} />}
      {sheet.kind === 'sub' && <SubSheet key={sheet.key} visible={sheet.open} onClose={close} onDone={done} match={match} events={events} />}
      {sheet.kind === 'stoppage' && <StoppageSheet key={sheet.key} visible={sheet.open} onClose={close} onDone={done} match={match} />}
      {sheet.kind === 'penalties' && (
        <PenaltiesStartSheet
          key={sheet.key}
          visible={sheet.open}
          onClose={close}
          onDone={() => {
            close();
            goToPenalties();
          }}
          match={match}
        />
      )}
      {sheet.kind === 'end' && <EndMatchSheet key={sheet.key} visible={sheet.open} onClose={close} onDone={done} match={match} />}
    </Screen>
  );
}

function Scoreboard({ match, events }: { match: FootballMatch; events: MatchEvent[] }) {
  const theme = useSportTheme();
  const players = playerIndex(match);
  const subsUsed = (teamId: number | null) => events.filter((e) => e.eventType === 'SubstitutionIn' && e.teamId === teamId).length;

  // "M. Silva 24', 59'" under each side.
  const scorers = (teamId: number | null) => {
    const byPlayer = new Map<string, string[]>();
    events
      .filter((e) => e.eventType === 'Goal' && e.teamId === teamId)
      .forEach((e) => {
        const who = e.playerId ? players.get(e.playerId)?.name ?? 'Unknown' : 'OG';
        byPlayer.set(who, [...(byPlayer.get(who) ?? []), e.stoppageMinute ? `${e.minuteOfMatch}+${e.stoppageMinute}'` : `${e.minuteOfMatch}'`]);
      });
    return [...byPlayer.entries()].map(([who, mins]) => `${who} ${mins.join(', ')}`);
  };

  const state: { label: string; tone: 'live' | 'setup' | 'ready' | 'done' } =
    match.status === 'Completed'
      ? { label: match.forfeitWinnerTeamId ? 'Awarded' : 'Full time', tone: 'ready' }
      : match.status === 'PenaltyShootout'
        ? { label: 'Penalties', tone: 'live' }
        : match.periodState === 'Ended'
          ? { label: match.awaitingResolution ? 'Full time — settle result' : match.currentHalf === 1 ? 'Half-time' : 'Break', tone: 'setup' }
          : match.status === 'Paused'
            ? { label: 'Play stopped', tone: 'setup' }
            : { label: 'Live', tone: 'live' };

  const pens = match.penaltyHomeScore != null && match.penaltyAwayScore != null;

  return (
    <Deck>
      <View style={styles.boardTop}>
        <View style={{ flex: 1, gap: space.xs }}>
          <Text style={[type.board, { color: theme.accent }]}>{match.currentPeriodLabel.toUpperCase()}</Text>
          <StatusChip label={state.label} tone={state.tone} onDark />
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>
            Group {match.groupName} · Match {match.matchNumber}
          </Text>
        </View>
        {match.status !== 'Completed' && <MatchClock match={match} />}
      </View>

      <View style={styles.teams} accessible accessibilityLabel={`${match.homeTeamName} ${match.homeScore}, ${match.awayTeamName} ${match.awayScore}`} accessibilityLiveRegion="polite">
        <View style={styles.teamCol}>
          <Text style={[styles.teamName, { color: theme.onDark }]} numberOfLines={2}>
            {match.homeTeamName.toUpperCase()}
          </Text>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>
            HOME · SUBS {subsUsed(match.homeTeamId)}/{match.maxSubstitutions ?? 0}
          </Text>
        </View>
        <View style={[styles.score, { backgroundColor: theme.page }]}>
          <Bump value={match.homeScore} style={[type.scoreLarge, { color: theme.accent }]} />
          <Text style={[type.score, { color: theme.onDarkSoft }]}>:</Text>
          <Bump value={match.awayScore} style={[type.scoreLarge, { color: theme.onDark }]} />
        </View>
        <View style={[styles.teamCol, { alignItems: 'flex-end' }]}>
          <Text style={[styles.teamName, { color: theme.onDark, textAlign: 'right' }]} numberOfLines={2}>
            {match.awayTeamName.toUpperCase()}
          </Text>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>
            AWAY · SUBS {subsUsed(match.awayTeamId)}/{match.maxSubstitutions ?? 0}
          </Text>
        </View>
      </View>

      {pens && (
        <Text style={[type.bodyStrong, { color: theme.accent, textAlign: 'center' }]}>
          Penalties {match.penaltyHomeScore}–{match.penaltyAwayScore}
        </Text>
      )}

      {(scorers(match.homeTeamId).length > 0 || scorers(match.awayTeamId).length > 0) && (
        <View style={styles.scorers}>
          <View style={{ flex: 1, gap: 2 }}>
            {scorers(match.homeTeamId).map((s) => (
              <Text key={s} style={[type.caption, { color: theme.onDarkSoft }]}>
                ⚽ {s}
              </Text>
            ))}
          </View>
          <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
            {scorers(match.awayTeamId).map((s) => (
              <Text key={s} style={[type.caption, { color: theme.onDarkSoft, textAlign: 'right' }]}>
                {s} ⚽
              </Text>
            ))}
          </View>
        </View>
      )}
    </Deck>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  more: { width: 52, minHeight: 48, borderRadius: radius.xl, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  boardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  teams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  teamCol: { flex: 1, gap: 4 },
  teamName: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.lg, paddingHorizontal: space.md },
  scorers: { flexDirection: 'row', gap: space.md },
});
