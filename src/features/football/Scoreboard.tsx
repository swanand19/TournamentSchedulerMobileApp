import { StyleSheet, Text, View } from 'react-native';

import type { FootballMatch, MatchEvent } from '@/api/types';
import Bump from '@/components/Bump';
import { Deck } from '@/components/Card';
import StatusChip from '@/components/StatusChip';
import MatchClock from '@/features/football/MatchClock';
import { playerIndex } from '@/features/football/useFootballMatch';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// The football scoreboard: period, status, clock, both teams and the score, and who scored. The
// scorer's console and the watcher's screen draw the same board.

export default function Scoreboard({ match, events }: { match: FootballMatch; events: MatchEvent[] }) {
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
  boardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  teams: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  teamCol: { flex: 1, gap: 4 },
  teamName: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.lg, paddingHorizontal: space.md },
  scorers: { flexDirection: 'row', gap: space.md },
});
