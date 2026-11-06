import { StyleSheet, Text, View } from 'react-native';

import type { FootballMatch, MatchEvent } from '@/api/types';
import Bump from '@/components/Bump';
import { Deck } from '@/components/Card';
import StatusChip from '@/components/StatusChip';
import MatchClock from '@/features/football/MatchClock';
import { playerIndex } from '@/features/football/useFootballMatch';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The football scoreboard: period, status, clock, both teams and the score, and who scored. The
// scorer's console and the watcher's screen draw the same board.

export default function Scoreboard({ match, events }: { match: FootballMatch; events: MatchEvent[] }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
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
  const light = theme.mode === 'light';

  // Light ("B · Sight-screen"): no board — the period and clock in a quiet line, then the teams in
  // sentence case either side of a thin, oversized score.
  if (light) {
    const sideLine = (teamId: number | null, label: string) => `${label}, subs ${subsUsed(teamId)}/${match.maxSubstitutions ?? 0}`;
    return (
      <View style={{ gap: space.md }}>
        <View style={styles.lightTop}>
          <Text style={[type.body, { color: theme.muted }]}>{match.currentPeriodLabel}</Text>
          <StatusChip label={state.label} tone={state.tone} />
          <View style={{ flex: 1 }} />
          {match.status !== 'Completed' && <MatchClock match={match} />}
        </View>
        <View
          style={styles.lightTeams}
          accessible
          accessibilityLabel={`${match.homeTeamName} ${match.homeScore}, ${match.awayTeamName} ${match.awayScore}`}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.teamCol}>
            <Text style={[type.lead, styles.lightTeam, { color: theme.ink }]} numberOfLines={2}>
              {match.homeTeamName}
            </Text>
            <Text style={[type.caption, { color: theme.muted }]}>{sideLine(match.homeTeamId, 'Home')}</Text>
          </View>
          <View style={styles.lightScore}>
            <Bump value={match.homeScore} style={[type.scoreLarge, { color: theme.ink }]} />
            <Text style={[type.score, { color: theme.placeholderInk }]}>–</Text>
            <Bump value={match.awayScore} style={[type.scoreLarge, { color: theme.ink }]} />
          </View>
          <View style={[styles.teamCol, { alignItems: 'flex-end' }]}>
            <Text style={[type.lead, styles.lightTeam, { color: theme.ink, textAlign: 'right' }]} numberOfLines={2}>
              {match.awayTeamName}
            </Text>
            <Text style={[type.caption, { color: theme.muted, textAlign: 'right' }]}>{sideLine(match.awayTeamId, 'Away')}</Text>
          </View>
        </View>
        {pens && (
          <Text style={[styles.lightPens, type.bodyStrong, { color: theme.deep, backgroundColor: theme.tint }]}>
            Penalties {match.penaltyHomeScore}–{match.penaltyAwayScore}
          </Text>
        )}
        {(scorers(match.homeTeamId).length > 0 || scorers(match.awayTeamId).length > 0) && (
          <View style={styles.scorers}>
            <View style={{ flex: 1, gap: 2 }}>
              {scorers(match.homeTeamId).map((s) => (
                <Text key={s} style={[type.caption, { color: theme.muted }]}>
                  {s}
                </Text>
              ))}
            </View>
            <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
              {scorers(match.awayTeamId).map((s) => (
                <Text key={s} style={[type.caption, { color: theme.muted, textAlign: 'right' }]}>
                  {s}
                </Text>
              ))}
            </View>
          </View>
        )}
        <Text style={[type.caption, { color: theme.muted }]}>
          {match.roundLabel ?? `Group ${match.groupName}`}, match {match.matchNumber}
        </Text>
      </View>
    );
  }

  // Glass ("N · Football live"): one frosted panel — the period, the live dot and the clock along
  // the top; the two sides either side of a heavy score; who scored under each; where it's played.
  return (
    <Deck style={{ gap: space.md }}>
      <View style={styles.boardTop}>
        <Text style={[type.bodyStrong, { color: theme.onDark }]}>{match.currentPeriodLabel}</Text>
        <StatusChip label={state.label} tone={state.tone} />
        <View style={{ flex: 1 }} />
        {match.status !== 'Completed' && <MatchClock match={match} />}
      </View>

      <View style={styles.teams} accessible accessibilityLabel={`${match.homeTeamName} ${match.homeScore}, ${match.awayTeamName} ${match.awayScore}`} accessibilityLiveRegion="polite">
        <View style={styles.teamCol}>
          <Text style={[type.heading, { color: theme.onDark }]} numberOfLines={2}>
            {match.homeTeamName}
          </Text>
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>
            Home, subs {subsUsed(match.homeTeamId)}/{match.maxSubstitutions ?? 0}
          </Text>
        </View>
        <View style={styles.score}>
          <Bump value={match.homeScore} style={[styles.figure, { color: theme.onDark }]} />
          <Text style={[styles.dash, { color: theme.onDarkSoft }]}>–</Text>
          <Bump value={match.awayScore} style={[styles.figure, { color: theme.onDark }]} />
        </View>
        <View style={[styles.teamCol, { alignItems: 'flex-end' }]}>
          <Text style={[type.heading, { color: theme.onDark, textAlign: 'right' }]} numberOfLines={2}>
            {match.awayTeamName}
          </Text>
          <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'right' }]}>
            Away, subs {subsUsed(match.awayTeamId)}/{match.maxSubstitutions ?? 0}
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
                {s}
              </Text>
            ))}
          </View>
          <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
            {scorers(match.awayTeamId).map((s) => (
              <Text key={s} style={[type.caption, { color: theme.onDarkSoft, textAlign: 'right' }]}>
                {s}
              </Text>
            ))}
          </View>
        </View>
      )}
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>
        {match.roundLabel ?? `Group ${match.groupName}`}, match {match.matchNumber}
      </Text>
    </Deck>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  boardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  teams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  teamCol: { flex: 1, gap: 4 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  figure: { fontFamily: fonts.display, fontSize: 64, lineHeight: 70, letterSpacing: -2, fontVariant: ['tabular-nums'] },
  dash: { fontFamily: fonts.body, fontSize: 44, lineHeight: 70 },
  scorers: { flexDirection: 'row', gap: space.md },
  lightTop: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  lightTeams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lightTeam: { fontSize: 18, lineHeight: 23 },
  lightScore: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lightPens: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: space.sm, borderRadius: radius.pill, overflow: 'hidden' },
});
