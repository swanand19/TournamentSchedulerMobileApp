import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketActions, CricketMatchAwards, CricketMatchState, CricketScorecard, RecordBallRequest } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import ScoringBanner, { isScoringLocked } from '@/components/ScoringBanner';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import { CreaseCard, CricketScoreboard, DlsStrip, OverStrip } from '@/features/cricket/ConsoleParts';
import { MoreSheet, PickPlayerSheet, ReduceOversSheet, WicketSheet, type MoreAction, type WicketDetails } from '@/features/cricket/CricketSheets';
import MatchAwards from '@/features/cricket/MatchAwards';
import RunPad, { type Extra, type RunsFrom } from '@/features/cricket/RunPad';
import StartInnings from '@/features/cricket/StartInnings';
import { useCricketMatch } from '@/features/cricket/useCricketMatch';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type } from '@/theme/theme';

// The cricket scoring console. Every call answers with the whole match state — including what's
// legal next — so this screen never decides a rule: it draws the scoreboard, the keypad when a
// ball can be bowled, and a blocking picker when the match needs a new batter or bowler.

type Open = { kind: 'wicket' | 'more' | 'reduce' | null; open: boolean; key: number };

export default function CricketLive() {
  const router = useRouter();
  const theme = useSportTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { id: tournamentId } = useTournament();
  const match = useCricketMatch(Number(matchId), { pollMs: 5000 });
  const action = useAction();

  const [extra, setExtra] = useState<Extra>('none');
  const [runsFrom, setRunsFrom] = useState<RunsFrom>('bat');
  const [sheet, setSheet] = useState<Open>({ kind: null, open: false, key: 0 });

  const state = match.data;
  const live = state?.current ?? null;
  const needsSetup = state ? !state.isSetUp : false;

  useEffect(() => {
    if (needsSetup) {
      router.replace({ pathname: '/tournament/[id]/cricket/[matchId]/setup', params: { id: String(tournamentId), matchId: String(matchId) } });
    }
  }, [needsSetup, router, tournamentId, matchId]);

  // The bowler picker shows each bowler's figures so far, which live on the scorecard.
  const needsBowler = !!state && state.actions.needsBowler && !state.actions.needsBatter;
  const cardFetcher = useCallback(() => api.call<CricketScorecard>('CRICKET_SCORECARD', { routeParams: { matchId } }), [matchId]);
  const card = useQuery(cardFetcher, { enabled: needsBowler });

  // Once the match is signed off, its honours fill the space the keypad left.
  const signedOff = state?.status === 'Completed';
  const awardsFetcher = useCallback(() => api.call<CricketMatchAwards>('CRICKET_AWARDS', { routeParams: { matchId } }), [matchId]);
  const awards = useQuery(awardsFetcher, { enabled: signedOff });

  const openSheet = (kind: Open['kind']) => setSheet((s) => ({ kind, open: true, key: s.key + 1 }));
  const closeSheet = () => setSheet((s) => ({ ...s, open: false }));

  /** Every engine call returns the new state: keep it, clear the one-ball modifiers. */
  const act = async (fn: () => Promise<CricketMatchState>, feel: () => void = () => {}) => {
    const res = await action.run(fn);
    if (!res.ok) return false;
    match.setData(res.value);
    setExtra('none');
    setRunsFrom('bat');
    feel();
    return true;
  };

  const call = (id: Parameters<typeof api.call>[0], body?: unknown) =>
    api.call<CricketMatchState>(id, { routeParams: { matchId }, body });

  /** The delivery the modifiers describe, with the runs put where the scorer said. */
  const buildBall = (runs: number, more: Partial<RecordBallRequest> = {}): RecordBallRequest => {
    const base: RecordBallRequest = {
      runsOffBat: 0,
      isWide: extra === 'wide',
      isNoBall: extra === 'noBall',
      wideExtraRuns: 0,
      byes: 0,
      legByes: 0,
      penaltyRuns: 0,
      ...more,
    };
    if (extra === 'wide') return { ...base, wideExtraRuns: runs };
    if (runsFrom === 'byes') return { ...base, byes: runs };
    if (runsFrom === 'legByes') return { ...base, legByes: runs };
    return { ...base, runsOffBat: runs };
  };

  if (!state) {
    return <Screen error={match.error} onRetry={match.refresh}>{match.loading && <Skeleton rows={4} height={140} />}</Screen>;
  }

  const finished = state.status === 'Completed' || state.status === 'Abandoned';
  // Someone else is scoring (or the tournament is closed): every "can…" is off, so the console
  // shows the match without a single scoring control — the banner says who has it.
  const locked = isScoringLocked(state.scoring, finished);
  const a = locked ? allOff(state.actions) : state.actions;
  const errorText = action.error?.message;

  const recordRuns = (runs: number) => act(() => call('CRICKET_BALL_RECORD', buildBall(runs)), runs >= 4 ? haptic.success : () => {});
  const recordWicket = async (w: WicketDetails) => {
    const { runsCompleted, ...rest } = w;
    const ok = await act(() => call('CRICKET_BALL_RECORD', buildBall(runsCompleted, rest)), haptic.heavy);
    if (ok) closeSheet();
  };

  const more = async (m: MoreAction) => {
    closeSheet();
    switch (m) {
      case 'scorecard':
        router.push({ pathname: '/tournament/[id]/cricket/[matchId]/scorecard', params: { id: String(tournamentId), matchId: String(matchId) } });
        return;
      case 'penalty':
        await act(() => call('CRICKET_BALL_RECORD', buildBall(0, { penaltyRuns: 5 })), haptic.tap);
        return;
      case 'reduce':
        setTimeout(() => openSheet('reduce'), 250); // after the menu has left
        return;
      case 'followOn':
        await act(() => call('CRICKET_FOLLOW_ON'), haptic.success);
        return;
      case 'superOver':
        await act(() => call('CRICKET_SUPER_OVER_START'), haptic.success);
        return;
      case 'declare':
        if (await confirm({ title: 'Declare?', message: `${live?.battingTeamName ?? 'The batting side'} declare at ${live?.scoreLine ?? 'this score'}.`, confirmLabel: 'Declare' })) {
          await act(() => call('CRICKET_INNINGS_END', { reason: 'Declared' }), haptic.success);
        }
        return;
      case 'endInnings': {
        const dlsChase = state.dls && live?.inningsNumber === 2;
        const ok = await confirm({
          title: dlsChase ? 'Stop play for good?' : 'End this innings?',
          message: dlsChase
            ? `The match will be decided on the DLS par score (${state.dls?.parScore ?? 'not yet set'}).`
            : 'The innings is closed where it stands.',
          confirmLabel: 'End innings',
          destructive: true,
        });
        if (ok) await act(() => call('CRICKET_INNINGS_END', { reason: 'Abandoned' }), haptic.heavy);
        return;
      }
      case 'signOff':
        if (await confirm({ title: 'Sign off the match?', message: 'The result is recorded as it stands.', confirmLabel: 'Sign off' })) {
          await act(() => call('CRICKET_COMPLETE', { force: true }), haptic.success);
        }
        return;
      case 'noResult':
        if (await confirm({ title: 'No result?', message: 'The match is recorded as abandoned — a point each.', confirmLabel: 'Record no result', destructive: true })) {
          await act(() => call('CRICKET_COMPLETE', { noResult: true }), haptic.heavy);
        }
    }
  };

  // Bowlers with their figures so far, and how many overs each has left under the cap.
  const bowlingCard = card.data?.innings.find((i) => i.inningsNumber === live?.inningsNumber);
  const survivor = live?.striker ?? live?.nonStriker ?? null;
  const bowlerSub = (playerId: number) => {
    const row = bowlingCard?.bowling.find((b) => b.playerId === playerId);
    const cap = state.rules.maxOversPerBowler;
    if (!row) return cap ? `0 of ${cap} overs` : 'Yet to bowl';
    return `${row.overs}-${row.maidens}-${row.runs}-${row.wickets}${cap ? ` · ${cap - Math.floor(row.legalBalls / state.rules.ballsPerOver)} left` : ''}`;
  };

  const footer = finished ? (
    <View style={styles.row}>
      <Button label="Back" icon="arrow-left" variant="deck" size="lg" onPress={() => router.back()} style={{ flex: 1 }} />
      <Button label="Scorecard" icon="table-large" size="lg" onPress={() => more('scorecard')} style={{ flex: 2 }} />
    </View>
  ) : a.canRecordBall ? (
    <RunPad
      rules={state.rules}
      extra={extra}
      runsFrom={runsFrom}
      onExtra={(e) => {
        setExtra(e);
        if (e === 'wide') setRunsFrom('bat');
      }}
      onRunsFrom={setRunsFrom}
      onRuns={recordRuns}
      onWicket={() => openSheet('wicket')}
      onUndo={() => act(() => call('CRICKET_BALL_UNDO'), haptic.tap)}
      canUndo={a.canUndo}
      busy={action.busy}
    />
  ) : undefined;

  return (
    <>
      <Stack.Screen
        options={{
          title: `${state.homeTeamName} v ${state.awayTeamName}`,
          headerRight: () =>
            locked ? (
              <PressableScale onPress={() => more('scorecard')} accessibilityLabel="Scorecard" style={styles.headerBtn}>
                <Icon name="table-large" size={24} color={theme.accent} />
              </PressableScale>
            ) : (
              <PressableScale onPress={() => openSheet('more')} accessibilityLabel="Match actions" style={styles.headerBtn}>
                <Icon name="dots-vertical" size={24} color={theme.accent} />
              </PressableScale>
            ),
        }}
      />
      <Screen footer={footer} onRefresh={match.refresh} refreshing={match.refreshing} error={action.error ?? match.error} onRetry={match.refresh}>
        <CricketScoreboard state={state} />
        <ScoringBanner sport="cricket" matchId={matchId} scoring={state.scoring} onChanged={match.reload} />
        {/* The batters come straight after the score: the scorer checks them every ball, and the
            keypad covers whatever sits lower on a short phone. */}
        {live && <CreaseCard live={live} />}
        {live && <OverStrip key={live.inningsNumber} live={live} ballsPerOver={state.rules.ballsPerOver} />}

        {a.canStartInnings && <StartInnings state={state} busy={action.busy} onStart={(body) => act(() => call('CRICKET_INNINGS_START', body), haptic.success)} />}

        {!a.canStartInnings && (a.canEnforceFollowOn || a.canStartSuperOver) && (
          <Card>
            <SectionHeader onCard title={a.canEnforceFollowOn ? 'Follow-on available' : 'Scores level'} />
            <Text style={[type.body, { color: theme.muted }]}>
              {a.canEnforceFollowOn
                ? 'The lead is big enough to make the other side bat again straight away.'
                : 'The rules settle a tie with a super over.'}
            </Text>
            {a.canEnforceFollowOn && <Button label="Enforce the follow-on" icon="repeat" onPress={() => more('followOn')} busy={action.busy} />}
            {a.canStartSuperOver && <Button label="Start a super over" icon="bullseye-arrow" onPress={() => more('superOver')} busy={action.busy} />}
          </Card>
        )}

        {!finished && !live && a.canComplete && !a.canStartInnings && (
          <Card>
            <SectionHeader onCard title="Innings complete" />
            <Text style={[type.body, { color: theme.muted }]}>Sign the match off to record the result.</Text>
            <Button label="Sign off the match" icon="flag-checkered" variant="success" onPress={() => more('signOff')} busy={action.busy} />
          </Card>
        )}

        {live && a.canRecordBall && extra !== 'none' && (
          <View style={[styles.modNote, { borderColor: theme.accent }]} accessibilityLiveRegion="polite">
            <Icon name="information-outline" size={18} color={theme.accent} />
            <Text style={[type.bodyStrong, { color: theme.accent, flex: 1 }]}>
              {extra === 'wide' ? 'Wide: the number is extra runs taken on it.' : 'No ball: the number is runs off the bat (or byes).'}
            </Text>
          </View>
        )}

        <DlsStrip state={state} />

        {signedOff && awards.data && <MatchAwards awards={awards.data} />}
      </Screen>

      {live && sheet.kind === 'wicket' && (
        <WicketSheet
          key={sheet.key}
          visible={sheet.open}
          onClose={closeSheet}
          onConfirm={recordWicket}
          state={state}
          busy={action.busy}
          error={errorText}
          extraLabel={extra === 'wide' ? 'Wide' : extra === 'noBall' ? 'No ball' : undefined}
        />
      )}
      {sheet.kind === 'more' && <MoreSheet key={sheet.key} visible={sheet.open} onClose={closeSheet} state={state} onAction={more} />}
      {live && sheet.kind === 'reduce' && (
        <ReduceOversSheet
          key={sheet.key}
          visible={sheet.open}
          onClose={closeSheet}
          state={state}
          busy={action.busy}
          error={errorText}
          onConfirm={async (overs) => {
            if (await act(() => call('CRICKET_REDUCE_OVERS', { newOversLimit: overs }), haptic.success)) closeSheet();
          }}
        />
      )}

      {/* The match can't go on without these, so they can't be dismissed. */}
      {live && (
        <PickPlayerSheet
          key={`bat-${live.inningsNumber}-${live.wickets}`}
          visible={a.needsBatter}
          title="Next batter in"
          subtitle={`${live.battingTeamName} ${live.scoreLine}`}
          players={a.availableBatters.map((p) => ({ id: p.playerId, name: p.playerName, sub: p.battingOrder ? `Bats #${p.battingOrder}` : undefined }))}
          cta="Send in"
          busy={action.busy}
          error={a.needsBatter ? errorText : undefined}
          onClose={() => {}}
          onUndo={a.canUndo ? () => act(() => call('CRICKET_BALL_UNDO'), haptic.tap) : undefined}
          onPick={(playerId, onStrike) => act(() => call('CRICKET_BATTER_SET', { playerId, onStrike }), haptic.tap)}
          // The empty end is where the engine sends the newcomer; the scorer can overrule it.
          strike={survivor ? { survivorName: survivor.playerName, newOnStrike: !live.striker } : undefined}
        />
      )}
      {live && (
        <PickPlayerSheet
          key={`bowl-${live.inningsNumber}-${live.overs}`}
          visible={needsBowler && !locked}
          title="Next over"
          subtitle={`End of the over · ${live.battingTeamName} ${live.scoreLine}`}
          players={a.availableBowlers.map((p) => ({ id: p.playerId, name: p.playerName, sub: bowlerSub(p.playerId) }))}
          cta="Bring on"
          busy={action.busy}
          error={needsBowler ? errorText : undefined}
          onClose={() => {}}
          onUndo={a.canUndo ? () => act(() => call('CRICKET_BALL_UNDO'), haptic.tap) : undefined}
          onPick={(playerId) => act(() => call('CRICKET_BOWLER_SET', { playerId }), haptic.tap)}
        />
      )}
    </>
  );
}

/** The engine's actions with every switch off — what a follower (not the scorer) may do. */
function allOff(actions: CricketActions): CricketActions {
  return Object.fromEntries(
    Object.entries(actions).map(([key, value]) => [key, typeof value === 'boolean' ? false : value]),
  ) as CricketActions;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  modNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 1.5, padding: space.sm },
});
