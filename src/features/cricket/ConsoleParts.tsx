import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { BallSummary, CricketMatchState, CreaseBatter, InningsLiveState } from '@/api/types';
import Bump from '@/components/Bump';
import { Card, Deck } from '@/components/Card';
import Icon from '@/components/Icon';
import StatusChip from '@/components/StatusChip';
import { humanize } from '@/lib/format';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// The read-only half of the cricket console: the scoreboard, the two batters and the bowler, and
// the over in progress.

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
/** A new ball in the over strip settling into place — the confirmation that the tap landed. */
const BALL_IN = {
  from: { opacity: 0, transform: [{ scale: 0.8 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
};

function inningsLabel(state: CricketMatchState, live: InningsLiveState | null) {
  if (state.status === 'SuperOver') return 'SUPER OVER';
  if (!live) return state.status === 'NotStarted' ? 'BEFORE THE FIRST BALL' : humanize(state.status).toUpperCase();
  const n = live.inningsNumber;
  return `${n}${n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH'} INNINGS`;
}

export function CricketScoreboard({ state }: { state: CricketMatchState }) {
  const theme = useSportTheme();
  const live = state.current;
  const finished = state.status === 'Completed' || state.status === 'Abandoned';
  const opponent = live ? (live.battingTeamId === state.homeTeamId ? state.awayTeamName : state.homeTeamName) : null;
  const done = state.innings.filter((i) => i.status === 'Completed');
  // On a shorter phone the keypad takes a bigger share of the screen, so the score gives way to
  // keep both batters in view above it.
  const { height } = useWindowDimensions();
  const scoreType = height < 760 ? type.score : type.scoreLarge;

  return (
    <Deck style={{ gap: space.sm }}>
      <View style={styles.topRow}>
        <Text style={[type.board, { color: theme.accent, flex: 1 }]} numberOfLines={1}>
          {inningsLabel(state, live)}
        </Text>
        <StatusChip
          label={finished ? 'Result' : live ? 'Live' : state.status === 'InningsBreak' ? 'Break' : 'Not started'}
          tone={finished ? 'ready' : live ? 'live' : 'setup'}
          onDark
        />
      </View>

      {live ? (
        <>
          <View style={styles.battingRow}>
            <Text style={[styles.team, { color: theme.onDark }]} numberOfLines={1}>
              {live.battingTeamName.toUpperCase()}
            </Text>
            {opponent && <Text style={[type.label, { color: theme.onDarkSoft }]}>V {opponent.toUpperCase()}</Text>}
          </View>
          <View
            style={styles.scoreRow}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${live.battingTeamName} ${live.runs} for ${live.wickets}, ${live.overs} overs`}
          >
            <Text style={[scoreType, { color: theme.onDark }]}>
              {live.runs}
              <Text style={{ color: theme.accent }}>/</Text>
            </Text>
            {/* Runs tick every ball, so they don't animate; a wicket is rare enough to mark. */}
            <Bump value={live.wickets} style={[scoreType, { color: theme.accent }]} />
            <View style={{ flex: 1 }} />
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[type.figure, { color: theme.onDark, fontSize: 30, lineHeight: 34 }]}>
                {live.overs}
                {live.oversLimit ? <Text style={{ color: theme.onDarkSoft, fontSize: 18 }}> / {live.oversLimit}</Text> : null}
              </Text>
              <Text style={[type.label, { color: theme.onDarkSoft }]}>OVERS · CRR {live.runRate.toFixed(2)}</Text>
            </View>
          </View>

          {live.target != null && (
            <View style={[styles.chase, { backgroundColor: theme.accent }]}>
              <Icon name="target" size={18} color={theme.accentInk} />
              <Text style={[type.bodyStrong, { color: theme.accentInk, flex: 1 }]}>
                {live.runsRequired != null && live.runsRequired > 0
                  ? `Need ${live.runsRequired}${live.ballsRemaining != null ? ` off ${live.ballsRemaining}` : ''}`
                  : `Target ${live.target}`}
              </Text>
              {live.requiredRunRate != null && (
                <Text style={[type.bodyStrong, { color: theme.accentInk }]}>RRR {live.requiredRunRate.toFixed(2)}</Text>
              )}
            </View>
          )}

          {live.freeHitPending && (
            <View style={[styles.freeHit, { borderColor: theme.accent }]} accessibilityRole="alert">
              <Icon name="lightning-bolt" size={18} color={theme.accent} />
              <Text style={[type.bodyStrong, { color: theme.accent }]}>FREE HIT — next ball</Text>
            </View>
          )}
        </>
      ) : (
        <Text style={[type.title, { color: theme.onDark }]}>
          {state.homeTeamName.toUpperCase()} <Text style={{ color: theme.accent }}>V</Text> {state.awayTeamName.toUpperCase()}
        </Text>
      )}

      {done.length > 0 && (
        <View style={{ gap: 2 }}>
          {done.map((i) => (
            <Text key={i.id} style={[type.caption, { color: theme.onDarkSoft }]}>
              {i.isSuperOver ? 'Super over · ' : ''}
              {i.battingTeamName}: {i.scoreLine}
              {i.endReason ? ` · ${i.endReason.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}` : ''}
            </Text>
          ))}
        </View>
      )}
      {!live && state.tossSummary && <Text style={[type.caption, { color: theme.onDarkSoft }]}>{state.tossSummary}.</Text>}
      {state.resultSummary && <Text style={[type.heading, { color: theme.accent }]}>{state.resultSummary.toUpperCase()}</Text>}
    </Deck>
  );
}

export function DlsStrip({ state }: { state: CricketMatchState }) {
  const theme = useSportTheme();
  const dls = state.dls;
  if (!dls) return null;
  const chasing = state.current?.inningsNumber === 2;
  const ahead = dls.runsAheadOfPar;
  const verdict = ahead == null ? null : ahead > 0 ? `ahead by ${ahead}` : ahead < 0 ? `behind by ${-ahead}` : 'level';
  // One compact line: it's reference, and on a short phone it sits under the keypad's shadow.
  const line =
    chasing && dls.parScore != null
      ? [
          `Par ${dls.parScore}${verdict ? ` (${verdict})` : ''}`,
          dls.target != null ? `Target ${dls.target}${dls.targetRevised ? ' revised' : ''}` : null,
          !dls.resultPossibleNow ? `Result needs ${dls.minimumOversForResult} ov` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;
  return (
    <View
      style={[styles.dls, { backgroundColor: theme.surfaceOnDark, borderColor: theme.borderOnDark }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`DLS, ${dls.edition}. ${line ?? 'Reduce overs if rain takes overs; the chase target is revised automatically.'}`}
    >
      <Text style={[type.label, { color: theme.accent }]}>DLS</Text>
      {line ? (
        <Text style={[type.bodyStrong, { color: theme.onDark, flex: 1 }]} numberOfLines={2}>
          {line}
        </Text>
      ) : (
        <Text style={[type.caption, { color: theme.onDarkSoft, flex: 1 }]} numberOfLines={2}>
          Rain? Reduce overs and the target is revised.
        </Text>
      )}
    </View>
  );
}

function BatterLine({ b, striker }: { b: CreaseBatter; striker: boolean }) {
  const theme = useSportTheme();
  const sr = b.ballsFaced ? ((b.runs * 100) / b.ballsFaced).toFixed(1) : '0.0';
  return (
    <View
      style={[styles.line, striker && { backgroundColor: theme.chip }]}
      accessible
      accessibilityLabel={`${b.playerName}${striker ? ', on strike' : ''}: ${b.runs} off ${b.ballsFaced}, ${b.fours} fours, ${b.sixes} sixes`}
    >
      <View style={[styles.strikeDot, { backgroundColor: striker ? theme.accent : 'transparent', borderColor: striker ? theme.accent : theme.muted }]} />
      <View style={{ flex: 1 }}>
        <Text style={[type.lead, { color: theme.ink }]} numberOfLines={1}>
          {b.playerName}
          {striker ? ' *' : ''}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]}>
          {b.ballsFaced}b · {b.fours}×4 · {b.sixes}×6 · SR {sr}
        </Text>
      </View>
      <Text style={[styles.runs, { color: theme.ink }]}>{b.runs}</Text>
    </View>
  );
}

export function CreaseCard({ live, bowlerStyle }: { live: InningsLiveState; bowlerStyle?: string | null }) {
  const theme = useSportTheme();
  const b = live.bowler;
  return (
    <Card style={{ gap: space.xs, padding: space.md }}>
      {live.striker && <BatterLine b={live.striker} striker />}
      {live.nonStriker && <BatterLine b={live.nonStriker} striker={false} />}
      {b && (
        <View style={[styles.line, { borderTopWidth: 1, borderTopColor: theme.cardDivider, marginTop: space.xs, paddingTop: space.sm }]} accessible accessibilityLabel={`Bowling: ${b.playerName}, ${b.overs} overs, ${b.maidens} maidens, ${b.runs} runs, ${b.wickets} wickets`}>
          <Icon name="baseball" size={20} color={theme.successInk} />
          <View style={{ flex: 1 }}>
            <Text style={[type.lead, { color: theme.ink }]} numberOfLines={1}>
              {b.playerName}
            </Text>
            {bowlerStyle ? <Text style={[type.caption, { color: theme.successInk }]}>{bowlerStyle}</Text> : null}
          </View>
          <Text style={[type.figure, { color: theme.ink }]}>
            {b.overs}-{b.maidens}-{b.runs}-{b.wickets}
          </Text>
        </View>
      )}
      {live.partnershipBalls > 0 && (
        <View style={[styles.partnership, { backgroundColor: theme.chip }]}>
          <Icon name="account-multiple" size={16} color={theme.muted} />
          <Text style={[type.caption, { color: theme.muted }]}>
            Partnership {live.partnershipRuns} ({live.partnershipBalls}b) · Extras {live.extrasTotal}
          </Text>
        </View>
      )}
    </Card>
  );
}

function BallChip({ ball, fresh }: { ball: BallSummary; fresh: boolean }) {
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  const bg = ball.isWicket ? theme.dangerSolid : ball.isBoundary ? theme.accent : ball.isExtra ? theme.deckRaised : theme.surfaceOnDark;
  const fg = ball.isBoundary ? theme.accentInk : theme.onDark;
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${ball.display}${ball.isFreeHit ? ', free hit' : ''}`}
      style={[
        styles.ball,
        { backgroundColor: bg, borderColor: ball.isFreeHit ? theme.accent : theme.borderOnDark },
        fresh && !reduced && { animationName: BALL_IN, animationDuration: 200, animationTimingFunction: EASE_OUT },
      ]}
    >
      <Text style={[styles.ballText, { color: fg, fontSize: ball.display.length > 2 ? 13 : 18 }]}>{ball.display}</Text>
    </Animated.View>
  );
}

export function OverStrip({ live, ballsPerOver }: { live: InningsLiveState; ballsPerOver: number }) {
  const theme = useSportTheme();
  // The newest ball seen when the console opened; later ones settle in.
  const [seenUpTo] = useState(() => live.thisOver.reduce((m, b) => Math.max(m, b.sequenceNumber), 0));
  const legal = live.thisOver.filter((b) => !b.display.startsWith('wd') && !b.display.startsWith('nb')).length;
  const runs = live.thisOver.reduce((n, b) => n + b.runs, 0);
  const remaining = Math.max(0, ballsPerOver - legal);
  const overNumber = Math.floor(parseFloat(live.overs)) + (legal < ballsPerOver ? 1 : 0);

  return (
    <View style={[styles.over, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}>
      <View style={styles.topRow}>
        <Text style={[type.board, { color: theme.onDark, flex: 1 }]}>THIS OVER ({overNumber})</Text>
        <Text style={[type.label, { color: theme.onDarkSoft }]}>{runs} runs</Text>
      </View>
      <View style={styles.balls}>
        {live.thisOver.map((b) => (
          <BallChip key={b.sequenceNumber} ball={b} fresh={b.sequenceNumber > seenUpTo} />
        ))}
        {Array.from({ length: remaining }, (_, i) => (
          <View key={`empty-${i}`} style={[styles.ball, { borderColor: theme.borderOnDark, borderStyle: 'dashed' }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  battingRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  team: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, flexShrink: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end' },
  chase: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, padding: space.sm, paddingHorizontal: space.md },
  freeHit: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, borderWidth: 1.5, padding: space.sm },
  dls: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, padding: space.sm },
  strikeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  runs: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, fontVariant: ['tabular-nums'] },
  partnership: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, padding: space.sm },
  over: { borderRadius: radius.lg, borderWidth: 1, padding: space.md, gap: space.sm },
  balls: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  ball: { minWidth: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  ballText: { fontFamily: fonts.display },
});
