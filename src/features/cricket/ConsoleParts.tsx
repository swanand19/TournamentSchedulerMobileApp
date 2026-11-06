import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import type { BallSummary, CricketMatchState, CreaseBatter, InningsLiveState } from '@/api/types';
import Bump from '@/components/Bump';
import { Card } from '@/components/Card';
import Glass from '@/components/Glass';
import StatusChip from '@/components/StatusChip';
import { humanize } from '@/lib/format';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

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

/** "2nd innings", "Super over", "Before the first ball" — the light theme's sentence-case label. */
function inningsLabelPlain(state: CricketMatchState, live: InningsLiveState | null) {
  const upper = inningsLabel(state, live);
  return upper.charAt(0) + upper.slice(1).toLowerCase();
}

export function CricketScoreboard({ state }: { state: CricketMatchState }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const live = state.current;
  const finished = state.status === 'Completed' || state.status === 'Abandoned';
  const opponent = live ? (live.battingTeamId === state.homeTeamId ? state.awayTeamName : state.homeTeamName) : null;
  const done = state.innings.filter((i) => i.status === 'Completed');
  // On a shorter phone the keypad takes a bigger share of the screen, so the score gives way to
  // keep both batters in view above it.
  const { height } = useWindowDimensions();
  const scoreType = height < 760 ? type.score : type.scoreLarge;
  const chip = (
    <StatusChip
      label={finished ? 'Result' : live ? 'Live' : state.status === 'InningsBreak' ? 'Break' : 'Not started'}
      tone={finished ? 'ready' : live ? 'live' : 'setup'}
      onDark
    />
  );

  // Light ("B · Sight-screen"): the score alone in the middle, drawn thin and large, with the
  // overs and the chase as quiet lines under it.
  if (theme.mode === 'light') {
    return (
      <View style={{ gap: space.sm }}>
        <View style={styles.topRow}>
          <Text style={[type.body, { color: theme.muted, flex: 1 }]} numberOfLines={1}>
            {inningsLabelPlain(state, live)}
            {live?.oversLimit ? `, ${live.oversLimit} overs` : ''}
          </Text>
          {chip}
        </View>
        {live ? (
          <View style={styles.lightCentre}>
            <Text style={[type.lead, { color: theme.ink }]} numberOfLines={1}>
              {live.battingTeamName}
              {opponent ? <Text style={[type.body, { color: theme.muted }]}> v {opponent}</Text> : null}
            </Text>
            <View
              style={styles.scoreRow}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${live.battingTeamName} ${live.runs} for ${live.wickets}, ${live.overs} overs`}
            >
              <Text style={[scoreType, { color: theme.ink }]}>
                {live.runs}
                <Text style={{ color: theme.placeholderInk }}>/</Text>
              </Text>
              <Bump value={live.wickets} style={[scoreType, { color: theme.ink }]} />
            </View>
            <Text style={[type.body, { color: theme.muted }]}>
              {live.overs}
              {live.oversLimit ? ` of ${live.oversLimit}` : ''} overs, run rate {live.runRate.toFixed(2)}
            </Text>
            {live.target != null && (
              <Text style={[type.bodyStrong, styles.lightPill, { backgroundColor: theme.tint, color: theme.deep }]}>
                {live.runsRequired != null && live.runsRequired > 0
                  ? `Need ${live.runsRequired}${live.ballsRemaining != null ? ` from ${live.ballsRemaining} balls` : ''}`
                  : `Target ${live.target}`}
                {live.requiredRunRate != null ? `, required ${live.requiredRunRate.toFixed(2)}` : ''}
              </Text>
            )}
            {live.freeHitPending && (
              <Text
                accessibilityRole="alert"
                style={[type.bodyStrong, styles.lightPill, { borderWidth: 1.5, borderColor: theme.accent, color: theme.deep }]}
              >
                Free hit, next ball
              </Text>
            )}
          </View>
        ) : (
          <Text style={[type.title, { color: theme.ink, textAlign: 'center' }]}>
            {state.homeTeamName} <Text style={{ color: theme.muted }}>v</Text> {state.awayTeamName}
          </Text>
        )}
        {done.length > 0 && (
          <View style={{ gap: 2, alignItems: 'center' }}>
            {done.map((i) => (
              <Text key={i.id} style={[type.caption, { color: theme.muted }]}>
                {i.isSuperOver ? 'Super over, ' : ''}
                {i.battingTeamName} {i.scoreLine}
                {i.endReason ? `, ${i.endReason.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}` : ''}
              </Text>
            ))}
          </View>
        )}
        {!live && state.tossSummary && <Text style={[type.caption, { color: theme.muted, textAlign: 'center' }]}>{state.tossSummary}.</Text>}
        {state.resultSummary && <Text style={[type.lead, { color: theme.deep, textAlign: 'center' }]}>{state.resultSummary}</Text>}
      </View>
    );
  }

  // Glass ("N · Live scoring"): straight on the wallpaper — who's batting and which innings, then the
  // score huge on the left with the overs on the right, and the chase as a capsule of glass.
  const status = finished ? 'Result' : live ? `Live, ${live.battingTeamName} batting` : state.status === 'InningsBreak' ? 'Innings break' : 'Not started';
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <StatusChip label={status} tone={finished ? 'ready' : live ? 'live' : 'setup'} />
        </View>
        <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
          {inningsLabelPlain(state, live)}
          {live?.oversLimit ? `, ${live.oversLimit} overs` : ''}
        </Text>
      </View>

      {live ? (
        <>
          <View
            style={styles.scoreRow}
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${live.battingTeamName} ${live.runs} for ${live.wickets}, ${live.overs} overs${opponent ? `, against ${opponent}` : ''}`}
          >
            <Text style={[scoreType, { color: theme.onDark }]}>{live.runs}</Text>
            {/* Runs tick every ball, so they don't animate; a wicket is rare enough to mark. */}
            <Text style={[scoreType, { color: theme.accent }]}>/</Text>
            <Bump value={live.wickets} style={[scoreType, { color: theme.accent }]} />
            <View style={{ flex: 1 }} />
            <View style={styles.overs}>
              <Text style={[styles.oversFigure, { color: theme.onDark }]}>{live.overs}</Text>
              <Text style={[type.caption, { color: theme.onDarkSoft }]}>
                {live.oversLimit ? `of ${live.oversLimit} overs` : 'overs'}
              </Text>
            </View>
          </View>

          {live.target != null && (
            <Glass radius={22} style={styles.chase}>
              <Text style={[type.bodyStrong, { color: theme.onDark }]}>
                {live.runsRequired != null && live.runsRequired > 0
                  ? `Need ${live.runsRequired}${live.ballsRemaining != null ? ` off ${live.ballsRemaining}` : ''}`
                  : `Target ${live.target}`}
              </Text>
              <Text style={[type.body, { color: theme.onDarkSoft }]} numberOfLines={1}>
                {live.requiredRunRate != null ? `Required ${live.requiredRunRate.toFixed(2)}, now ${live.runRate.toFixed(2)}` : `Run rate ${live.runRate.toFixed(2)}`}
              </Text>
            </Glass>
          )}

          {live.freeHitPending && (
            <Glass radius={22} style={styles.chase} accessibilityRole="alert">
              <Text style={[type.bodyStrong, { color: theme.accent }]}>Free hit, next ball</Text>
            </Glass>
          )}
        </>
      ) : (
        <Text style={[type.title, { color: theme.onDark }]}>
          {state.homeTeamName} <Text style={{ color: theme.onDarkSoft }}>v</Text> {state.awayTeamName}
        </Text>
      )}

      {done.length > 0 && (
        <View style={{ gap: 2 }}>
          {done.map((i) => (
            <Text key={i.id} style={[type.caption, { color: theme.onDarkSoft }]}>
              {i.isSuperOver ? 'Super over, ' : ''}
              {i.battingTeamName} {i.scoreLine}
              {i.endReason ? `, ${i.endReason.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}` : ''}
            </Text>
          ))}
        </View>
      )}
      {!live && state.tossSummary && <Text style={[type.caption, { color: theme.onDarkSoft }]}>{state.tossSummary}.</Text>}
      {state.resultSummary && <Text style={[type.lead, { color: theme.accent }]}>{state.resultSummary}</Text>}
    </View>
  );
}

export function DlsStrip({ state }: { state: CricketMatchState }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
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

/** "29 balls, four 4s, one 6, strike rate 141.4" — the line under a batter, in words. */
function batterLine(b: CreaseBatter) {
  const sr = b.ballsFaced ? ((b.runs * 100) / b.ballsFaced).toFixed(1) : '0.0';
  const count = (n: number, one: string, many: string) => (n === 0 ? null : `${n} ${n === 1 ? one : many}`);
  return [`${b.ballsFaced} ball${b.ballsFaced === 1 ? '' : 's'}`, count(b.fours, 'four', 'fours'), count(b.sixes, 'six', 'sixes'), `strike rate ${sr}`]
    .filter(Boolean)
    .join(', ');
}

function BatterLine({ b, striker }: { b: CreaseBatter; striker: boolean }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View
      style={styles.line}
      accessible
      accessibilityLabel={`${b.playerName}${striker ? ', on strike' : ''}: ${b.runs} off ${b.ballsFaced}, ${b.fours} fours, ${b.sixes} sixes`}
    >
      <View style={[styles.strikeDot, { backgroundColor: striker ? theme.accent : 'transparent' }]} />
      <View style={{ flex: 1 }}>
        <Text style={[type.lead, { color: theme.ink }]} numberOfLines={1}>
          {b.playerName}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
          {batterLine(b)}
        </Text>
      </View>
      <Text style={[styles.runs, { color: theme.ink }]}>{b.runs}</Text>
    </View>
  );
}

/** Light: the two batters and the bowler as a small table between hairlines. */
function LightCrease({ live, bowlerStyle }: { live: InningsLiveState; bowlerStyle?: string | null }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const b = live.bowler;
  const batter = (x: CreaseBatter, striker: boolean) => (
    <View
      key={x.playerId}
      style={styles.lightGrid}
      accessible
      accessibilityLabel={`${x.playerName}${striker ? ', on strike' : ''}: ${x.runs} off ${x.ballsFaced}, ${x.fours} fours, ${x.sixes} sixes`}
    >
      <Text style={[striker ? type.lead : type.body, { color: theme.ink, flex: 1, fontSize: 16 }]} numberOfLines={1}>
        {x.playerName}
        {striker ? <Text style={[type.caption, { color: theme.deep }]}> on strike</Text> : null}
      </Text>
      <Text style={[styles.lightCell, type.body, { color: theme.ink, fontSize: 18 }]}>{x.runs}</Text>
      <Text style={[styles.lightCell, type.body, { color: theme.muted }]}>{x.ballsFaced}</Text>
      <Text style={[styles.lightCell, type.body, { color: theme.muted }]}>
        {x.ballsFaced ? Math.round((x.runs * 100) / x.ballsFaced) : '–'}
      </Text>
    </View>
  );
  return (
    <View style={[styles.lightCrease, { borderTopColor: theme.cardDivider }]}>
      <View style={styles.lightGrid} importantForAccessibility="no-hide-descendants">
        <Text style={[type.caption, { color: theme.muted, flex: 1 }]}>Batting</Text>
        {['Runs', 'Balls', 'SR'].map((h) => (
          <Text key={h} style={[type.caption, styles.lightCell, { color: theme.muted }]}>
            {h}
          </Text>
        ))}
      </View>
      {live.striker && batter(live.striker, true)}
      {live.nonStriker && batter(live.nonStriker, false)}
      {b && (
        <View
          style={[styles.lightGrid, styles.lightBowler, { borderColor: theme.cardDivider }]}
          accessible
          accessibilityLabel={`Bowling: ${b.playerName}, ${b.overs} overs, ${b.maidens} maidens, ${b.runs} runs, ${b.wickets} wickets`}
        >
          <Text style={[type.body, { color: theme.ink, flex: 1, fontSize: 16 }]} numberOfLines={1}>
            {b.playerName}
            <Text style={[type.caption, { color: theme.muted }]}> bowling{bowlerStyle ? `, ${bowlerStyle.toLowerCase()}` : ''}</Text>
          </Text>
          <Text style={[type.body, { color: theme.ink, fontSize: 16 }]}>
            {b.overs}-{b.maidens}-{b.runs}-{b.wickets}
          </Text>
        </View>
      )}
      {live.partnershipBalls > 0 && (
        <Text style={[type.caption, { color: theme.muted, paddingTop: space.sm }]}>
          Partnership {live.partnershipRuns} ({live.partnershipBalls} balls), extras {live.extrasTotal}
        </Text>
      )}
    </View>
  );
}

export function CreaseCard({ live, bowlerStyle }: { live: InningsLiveState; bowlerStyle?: string | null }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const b = live.bowler;
  if (theme.mode === 'light') return <LightCrease live={live} bowlerStyle={bowlerStyle} />;
  // Glass: one frosted panel — the striker (marked by the lit dot), the other batter, the bowler —
  // rows parted by hairlines, as the design draws a grouped list.
  return (
    <Card style={styles.crease}>
      {live.striker && <BatterLine b={live.striker} striker />}
      {live.nonStriker && <BatterLine b={live.nonStriker} striker={false} />}
      {b && (
        <View
          style={[styles.line, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.cardDivider }]}
          accessible
          accessibilityLabel={`Bowling: ${b.playerName}, ${b.overs} overs, ${b.maidens} maidens, ${b.runs} runs, ${b.wickets} wickets`}
        >
          <View style={styles.strikeDot} />
          <View style={{ flex: 1 }}>
            <Text style={[type.lead, { color: theme.ink }]} numberOfLines={1}>
              {b.playerName}
            </Text>
            <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
              {bowlerStyle ?? 'Bowling'}
            </Text>
          </View>
          <Text style={[styles.bowling, { color: theme.ink }]}>
            {b.overs}–{b.maidens}–{b.runs}–{b.wickets}
          </Text>
        </View>
      )}
      {live.partnershipBalls > 0 && (
        <Text style={[type.caption, styles.partnership, { color: theme.muted, borderTopColor: theme.cardDivider }]}>
          Partnership {live.partnershipRuns} ({live.partnershipBalls} balls), extras {live.extrasTotal}
        </Text>
      )}
    </Card>
  );
}

/**
 * How each kind of ball looks in the light theme's "This over", so they read apart without fills:
 * a run is a hairline circle, a four a pale accent ring, a six the full accent ring with a tint, a
 * wicket a red ring (red is for wickets), a wide or no-ball a small grey pill.
 */
function lightBall(ball: BallSummary, theme: ReturnType<typeof useSportTheme>) {
  const six = ball.isBoundary && /6/.test(ball.display);
  if (ball.isWicket) return { bg: theme.dangerTint, border: theme.dangerSolid, fg: theme.dangerInk, width: 1.5, pill: false, strong: true };
  if (ball.isExtra && !ball.isBoundary) return { bg: theme.chip, border: theme.chip, fg: theme.extraInk, width: 1, pill: true, strong: false };
  if (six) return { bg: theme.tint, border: theme.accent, fg: theme.deep, width: 1.5, pill: false, strong: true };
  if (ball.isBoundary) return { bg: 'transparent', border: theme.ring, fg: theme.deep, width: 1.5, pill: false, strong: true };
  return { bg: 'transparent', border: theme.fieldBorder, fg: ball.runs === 0 ? theme.muted : theme.ink, width: 1, pill: false, strong: false };
}

function BallChip({ ball, fresh }: { ball: BallSummary; fresh: boolean }) {
  const { fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  const enter = fresh && !reduced && { animationName: BALL_IN, animationDuration: 200, animationTimingFunction: EASE_OUT };
  if (theme.mode === 'light') {
    const look = lightBall(ball, theme);
    return (
      <Animated.View
        accessible
        accessibilityLabel={`${ball.display}${ball.isFreeHit ? ', free hit' : ''}`}
        style={[
          look.pill ? styles.lightPillBall : styles.lightBall,
          { backgroundColor: look.bg, borderColor: ball.isFreeHit ? theme.accent : look.border, borderWidth: look.width },
          enter,
        ]}
      >
        <Text style={{ fontFamily: look.strong ? fonts.bodySemiBold : fonts.body, fontSize: look.pill ? 12 : 14, color: look.fg }}>
          {ball.display === '0' ? '•' : ball.display}
        </Text>
      </Animated.View>
    );
  }
  // Glass: a run is a faint bead, a four an accent ring, a six a lit accent bead, a wicket red (red
  // is for wickets), a wide or no-ball a small pill — each kind reads apart at a glance.
  const six = ball.isBoundary && /6/.test(ball.display);
  const extra = ball.isExtra && !ball.isBoundary && !ball.isWicket;
  const look = ball.isWicket
    ? { bg: theme.dangerSolid, fg: '#FFFFFF', ring: 'transparent' }
    : six
      ? { bg: theme.accent, fg: theme.accentInk, ring: 'transparent' }
      : ball.isBoundary
        ? { bg: 'transparent', fg: theme.accent, ring: theme.accent }
        : extra
          ? { bg: 'rgba(255,255,255,0.16)', fg: theme.extraInk, ring: 'transparent' }
          : { bg: 'rgba(255,255,255,0.10)', fg: ball.runs === 0 ? theme.onDarkSoft : theme.onDark, ring: 'transparent' };
  return (
    <Animated.View
      accessible
      accessibilityLabel={`${ball.display}${ball.isFreeHit ? ', free hit' : ''}`}
      style={[
        extra ? styles.extraBall : styles.ball,
        { backgroundColor: look.bg, borderColor: ball.isFreeHit ? theme.accent : look.ring },
        enter,
      ]}
    >
      <Text style={[extra ? styles.extraText : styles.ballText, { color: look.fg }]}>{ball.display}</Text>
    </Animated.View>
  );
}

export function OverStrip({ live, ballsPerOver }: { live: InningsLiveState; ballsPerOver: number }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  // The newest ball seen when the console opened; later ones settle in.
  const [seenUpTo] = useState(() => live.thisOver.reduce((m, b) => Math.max(m, b.sequenceNumber), 0));
  const legal = live.thisOver.filter((b) => !b.display.startsWith('wd') && !b.display.startsWith('nb')).length;
  const runs = live.thisOver.reduce((n, b) => n + b.runs, 0);
  const remaining = Math.max(0, ballsPerOver - legal);
  const overNumber = Math.floor(parseFloat(live.overs)) + (legal < ballsPerOver ? 1 : 0);

  if (theme.mode === 'light') {
    return (
      <View style={styles.lightOver}>
        <Text style={[type.caption, { color: theme.muted }]}>This over</Text>
        {live.thisOver.map((b) => (
          <BallChip key={b.sequenceNumber} ball={b} fresh={b.sequenceNumber > seenUpTo} />
        ))}
        {Array.from({ length: remaining }, (_, i) => (
          <View key={`empty-${i}`} style={[styles.lightBall, { borderWidth: 1, borderColor: theme.fieldBorder, borderStyle: 'dashed' }]} />
        ))}
        <Text style={[type.caption, { color: theme.muted, marginLeft: 'auto' }]}>{runs} runs</Text>
      </View>
    );
  }

  // Glass: one line on the wallpaper — "This over 13 runs", then the balls bowled and the ones to come.
  return (
    <View style={styles.over} accessibilityLabel={`Over ${overNumber}, ${runs} runs`}>
      <Text style={[type.bodyStrong, { color: theme.onDark, flexGrow: 1 }]}>
        This over <Text style={[type.body, { color: theme.onDarkSoft }]}>{runs} runs</Text>
      </Text>
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

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end' },
  overs: { alignItems: 'flex-end', paddingBottom: space.md },
  oversFigure: { fontFamily: fonts.bodySemiBold, fontSize: 26, lineHeight: 30, fontVariant: figures },
  chase: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: 44, paddingHorizontal: 18 },
  dls: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: space.md, paddingVertical: space.sm },
  crease: { padding: 0, gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.sm },
  strikeDot: { width: 8, height: 8, borderRadius: 4 },
  runs: { fontFamily: fonts.bodySemiBold, fontSize: 22, lineHeight: 26, fontVariant: figures },
  bowling: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 20, fontVariant: figures },
  partnership: { paddingHorizontal: space.lg, paddingVertical: space.sm + 2, borderTopWidth: StyleSheet.hairlineWidth },
  over: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  balls: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ball: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  extraBall: { height: 34, minWidth: 34, paddingHorizontal: 9, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ballText: { fontFamily: fonts.bodySemiBold, fontSize: 15, fontVariant: figures },
  extraText: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
  // The light theme.
  lightCentre: { alignItems: 'center', gap: 2 },
  lightPill: { marginTop: space.sm, paddingHorizontal: 14, paddingVertical: space.sm, borderRadius: radius.pill, overflow: 'hidden', textAlign: 'center' },
  lightCrease: { borderTopWidth: 1 },
  lightGrid: { flexDirection: 'row', alignItems: 'baseline', gap: 4, paddingVertical: 6 },
  lightCell: { width: 44, textAlign: 'right' },
  lightBowler: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 10, marginTop: 4 },
  lightOver: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  lightBall: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  lightPillBall: { height: 24, paddingHorizontal: 7, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
