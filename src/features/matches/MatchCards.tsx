import { StyleSheet, Text, View } from 'react-native';

import type { MatchCard } from '@/api/types';
import Button from '@/components/Button';
import { Deck } from '@/components/Card';
import PressableScale from '@/components/PressableScale';
import StatusChip from '@/components/StatusChip';
import { phaseOf, statusLine } from '@/features/matches/status';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, lip, radius, space, type } from '@/theme/theme';

// Match cards for the hub's Matches tab. Played and live matches sit on cream (a result is a
// record you read); upcoming ones sit on the dark deck, quieter, until they kick off.

function scoreOf(m: MatchCard): { home: string; away: string } | null {
  if (m.sport === 'Football') return m.status === 'NotStarted' ? null : { home: String(m.homeScore), away: String(m.awayScore) };
  if (!m.homeLine && !m.awayLine) return null;
  return { home: m.homeLine ?? '—', away: m.awayLine ?? 'Yet to bat' };
}

/** The big pinned card for a match in progress, with the one button that matters. */
export function LiveMatchCard({ match, onOpen }: { match: MatchCard; onOpen: () => void }) {
  const theme = useSportTheme();
  const line = statusLine(match);
  const score = scoreOf(match);
  return (
    <Deck accessibilityLabel={`Match ${match.matchNumber}, ${match.homeTeamName} against ${match.awayTeamName}, ${line.label}`}>
      <View style={styles.topRow}>
        <StatusChip label={line.label} tone="live" />
        <Text style={[type.label, { color: theme.onDarkSoft }]}>
          Match {match.matchNumber}, group {match.groupName}
        </Text>
      </View>

      {match.sport === 'Football' ? (
        <View style={styles.liveScore}>
          <Text style={[styles.liveTeam, { color: theme.onDark }]} numberOfLines={2}>
            {match.homeTeamName.toUpperCase()}
          </Text>
          <View style={[styles.scoreBox, { backgroundColor: theme.page }]}>
            <Text style={[type.score, { color: theme.accent }]}>
              {score?.home ?? 0}
              <Text style={{ color: theme.onDarkSoft }}> : </Text>
              <Text style={{ color: theme.onDark }}>{score?.away ?? 0}</Text>
            </Text>
          </View>
          <Text style={[styles.liveTeam, { color: theme.onDark, textAlign: 'right' }]} numberOfLines={2}>
            {match.awayTeamName.toUpperCase()}
          </Text>
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <CricketLine name={match.homeTeamName} line={score?.home} strong />
          <CricketLine name={match.awayTeamName} line={score?.away} />
        </View>
      )}

      <Button
        label={match.sport === 'Football' ? 'Tap to score' : 'Open live scorer'}
        icon="whistle"
        onPress={onOpen}
        size="lg"
      />
    </Deck>
  );
}

function CricketLine({ name, line, strong }: { name: string; line?: string; strong?: boolean }) {
  const theme = useSportTheme();
  return (
    <View style={styles.cricketRow}>
      <Text style={[type.heading, { color: theme.onDark, flex: 1 }]} numberOfLines={1}>
        {name.toUpperCase()}
      </Text>
      <Text style={[type.figure, { color: strong ? theme.accent : theme.onDark }]}>{line ?? 'Yet to bat'}</Text>
    </View>
  );
}

/** A row in a group's list of fixtures. */
export function MatchRow({ match, onOpen }: { match: MatchCard; onOpen: () => void }) {
  const theme = useSportTheme();
  const phase = phaseOf(match);
  const line = statusLine(match);
  const score = scoreOf(match);
  const onCream = phase !== 'upcoming';
  const fg = onCream ? theme.ink : theme.onDark;
  const soft = onCream ? theme.muted : theme.onDarkSoft;
  const result = match.sport === 'Cricket' ? match.resultSummary : null;

  return (
    <PressableScale
      onPress={onOpen}
      accessibilityLabel={`Match ${match.matchNumber}, ${match.homeTeamName} ${score ? score.home : ''} against ${match.awayTeamName} ${score ? score.away : ''}, ${line.label}`}
      style={[
        styles.row,
        onCream
          ? [{ backgroundColor: theme.cream }, lip(theme)]
          : { backgroundColor: theme.deck, borderWidth: 1, borderColor: theme.borderOnDark },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[type.label, { color: soft }]}>Match {match.matchNumber}</Text>
        <StatusChip label={line.label} tone={line.tone} onDark={!onCream} />
      </View>

      {match.sport === 'Football' ? (
        <View style={styles.fixture}>
          <Text style={[styles.team, { color: fg }]} numberOfLines={1}>
            {match.homeTeamName.toUpperCase()}
          </Text>
          {score ? (
            <View style={[styles.miniScore, { backgroundColor: theme.ink }]}>
              <Text style={[type.figure, { color: theme.cream }]}>
                {score.home} - {score.away}
              </Text>
            </View>
          ) : (
            <View style={[styles.vs, { backgroundColor: theme.deckRaised }]}>
              <Text style={[type.label, { color: theme.accent }]}>VS</Text>
            </View>
          )}
          <Text style={[styles.team, { color: fg, textAlign: 'right' }]} numberOfLines={1}>
            {match.awayTeamName.toUpperCase()}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          <View style={styles.cricketRow}>
            <Text style={[styles.teamSmall, { color: fg }]} numberOfLines={1}>
              {match.homeTeamName.toUpperCase()}
            </Text>
            <Text style={[type.bodyStrong, { color: fg }]}>{score?.home ?? ''}</Text>
          </View>
          <View style={styles.cricketRow}>
            <Text style={[styles.teamSmall, { color: fg }]} numberOfLines={1}>
              {match.awayTeamName.toUpperCase()}
            </Text>
            <Text style={[type.bodyStrong, { color: fg }]}>{score?.away ?? ''}</Text>
          </View>
          {!score && <Text style={[type.caption, { color: soft }]}>Toss and XIs not set yet</Text>}
        </View>
      )}

      {result ? <Text style={[type.bodyStrong, { color: theme.successInk }]}>{result}</Text> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  liveScore: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  liveTeam: { flex: 1, fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  scoreBox: { borderRadius: radius.lg, paddingHorizontal: space.md },
  row: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  fixture: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  team: { flex: 1, fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  teamSmall: { flex: 1, fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
  miniScore: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 2 },
  vs: { borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.xs },
  cricketRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
