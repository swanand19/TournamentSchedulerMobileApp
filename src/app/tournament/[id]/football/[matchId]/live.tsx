import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { RecordEventResponse } from '@/api/types';
import Button from '@/components/Button';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import ScoringBanner, { isScoringLocked } from '@/components/ScoringBanner';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import {
  CardSheet,
  EndMatchSheet,
  GoalSheet,
  PenaltiesStartSheet,
  StoppageSheet,
  SubSheet,
} from '@/features/football/FootballSheets';
import { elapsedSeconds } from '@/features/football/MatchClock';
import Scoreboard from '@/features/football/Scoreboard';
import Timeline from '@/features/football/Timeline';
import { useFootballMatch } from '@/features/football/useFootballMatch';
import { useAction } from '@/hooks/useAction';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The football scoring console. Top: the scoreboard (observation). Bottom: the scoring pad in the
// thumb zone (action). Between them, the match controls — and only the ones the server's flags say
// are legal right now — and the timeline.
//
// Every action is followed by a reload of the match, and the match polls every 5s, so another
// phone following along stays within a few seconds.

type SheetKind = 'goal' | 'card' | 'sub' | 'stoppage' | 'penalties' | 'end';
type SheetState = { kind: SheetKind | null; open: boolean; key: number; side: 'home' | 'away'; colour: 'yellow' | 'red' };

export default function FootballLive() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
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

  const completed = match.status === 'Completed';
  // Someone else is scoring (or the tournament is closed): follow along, no scoring controls.
  const locked = isScoringLocked(match.scoring, completed);
  const live = match.isLiveOrPaused && !locked;
  const ended = match.periodState === 'Ended';
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
            caption={match.homeTeamName}
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
            caption={match.awayTeamName}
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
          <Button label="Yellow" icon="card" iconColor={theme.yellowCard} variant="secondary" display={theme.mode === 'dark'} onPress={() => open('card', { colour: 'yellow' })} style={{ flex: 1 }} />
          <Button label="Red" icon="card" variant="danger" onPress={() => open('card', { colour: 'red' })} style={{ flex: 1 }} />
          <Button label="Sub" icon="swap-horizontal" variant="secondary" display={theme.mode === 'dark'} onPress={() => open('sub')} style={{ flex: 1 }} />
        </View>
      </>
    );
  } else if (shootout) {
    footer = <Button label="Open penalty shootout" icon="bullseye-arrow" size="lg" onPress={goToPenalties} />;
  } else if (completed) {
    footer = <Button label="Back to matches" icon="arrow-left" size="lg" variant="deck" onPress={() => router.back()} />;
  }

  return (
    // While the ball's in play the footer is the scoring pad: keys, so the glass theme draws its pad.
    <Screen footer={footer} pad={live} onRefresh={data.refresh} refreshing={data.refreshing} error={action.error ?? data.error} onRetry={data.refresh}>
      <Scoreboard match={match} events={events} />
      <ScoringBanner
        sport="football"
        matchId={matchId}
        scoring={match.scoring}
        onChanged={data.reload}
        onWatch={() => router.push({ pathname: '/tournament/[id]/football/[matchId]/watch', params })}
      />

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

          {/* Glass: a bar of clear glass, the controls parted by hairlines. */}
          <View
            style={[
              styles.controls,
              theme.mode === 'light'
                ? [styles.lightControls, { borderColor: theme.fieldBorder }]
                : [styles.glassControls, { backgroundColor: theme.glassFill, borderColor: theme.glassBorder, boxShadow: `inset 0 1px 0 ${theme.glassRim}` }],
            ]}
          >
            {match.canEndPeriod &&
              (match.status === 'Paused' ? (
                <ClockControl first label="Resume" icon="play" busy={action.busy} onPress={() => act(() => api.call('MATCH_CLOCK_RESUME', { routeParams: { matchId } }))} />
              ) : (
                <ClockControl first label="Pause" icon="pause" busy={action.busy} onPress={() => act(() => api.call('MATCH_CLOCK_PAUSE', { routeParams: { matchId } }))} />
              ))}
            {match.canEndPeriod && match.stoppageRemainingThisPeriod > 0 && (
              <ClockControl label="Add time" icon="timer-plus-outline" onPress={() => open('stoppage')} />
            )}
            {match.canEndPeriod && (
              <ClockControl label="End half" icon="whistle" onPress={endPeriod} accessibilityLabel={`End the ${periodShort}`} />
            )}
            <ClockControl icon="dots-vertical" onPress={() => open('end')} accessibilityLabel="More: end match early" narrow first={!match.canEndPeriod} />
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

/**
 * One segment of the clock bar: icon over a one-line word, so the word gets the segment's whole
 * width (side by side, "Pause" broke across two lines on a ~400dp phone). Every segment but the
 * first draws a hairline on its left as the divider.
 */
function ClockControl({
  label,
  icon,
  onPress,
  busy,
  narrow,
  first,
  accessibilityLabel,
}: {
  label?: string;
  icon: IconName;
  onPress: () => void;
  busy?: boolean;
  narrow?: boolean;
  first?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: !!busy }}
      style={[styles.control, narrow && styles.controlNarrow, !first && { borderLeftWidth: StyleSheet.hairlineWidth, borderColor: theme.borderOnDark }]}
    >
      {busy ? <ActivityIndicator color={theme.onDark} /> : <Icon name={icon} size={22} color={theme.onDark} />}
      {label ? (
        <Text style={[styles.controlLabel, theme.mode === 'light' && styles.lightControlLabel, { color: theme.onDarkSoft }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {label}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  controls: { flexDirection: 'row', borderRadius: radius.xl, borderWidth: 1.5, overflow: 'hidden' },
  control: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: space.xs },
  controlNarrow: { flexGrow: 0, flexShrink: 0, flexBasis: 56, width: 56 },
  lightControls: { borderWidth: 1, backgroundColor: 'transparent' },
  glassControls: { borderWidth: 1, borderRadius: 24, borderCurve: 'continuous' },
  controlLabel: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 16, letterSpacing: 0.2 },
  lightControlLabel: { fontFamily: fonts.body, letterSpacing: 0 },
});
