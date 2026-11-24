import { StyleSheet, Text, View } from 'react-native';

import type { MatchCard } from '@/api/types';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import StatusChip from '@/components/StatusChip';
import { phaseOf, statusLine } from '@/features/matches/status';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Match cards for the hub's Matches tab: frosted cards in the glass theme, open rows between
// hairlines in the light theme.

/** What a live match's button says: scoring for those who can score, watching for everyone else. */
function liveLabel(m: MatchCard, canScore: boolean) {
  if (!canScore) return 'Watch live';
  return m.sport === 'Football' ? 'Tap to score' : 'Open live scorer';
}

function scoreOf(m: MatchCard): { home: string; away: string } | null {
  if (m.sport === 'Football') return m.status === 'NotStarted' ? null : { home: String(m.homeScore), away: String(m.awayScore) };
  if (!m.homeLine && !m.awayLine) return null;
  return { home: m.homeLine ?? '—', away: m.awayLine ?? 'Yet to bat' };
}

/**
 * The light theme's match ("B · Sight-screen"): one row between hairlines — a line of status, then
 * each side with its score in thin figures (the side behind in a football result muted), then what
 * happened. The whole row opens the match; a live one says so in the accent.
 */
function LightMatchRow({ match, onOpen, live, canScore }: { match: MatchCard; onOpen: () => void; live?: boolean; canScore: boolean }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const line = statusLine(match);
  const score = scoreOf(match);
  const where = `match ${match.matchNumber}, ${match.roundLabel ?? `Group ${match.groupName}`}`;
  const result = match.sport === 'Cricket' ? match.resultSummary : null;
  const done = phaseOf(match) === 'completed';
  const behind = (side: 'home' | 'away') =>
    done && match.sport === 'Football' && (side === 'home' ? match.homeScore < match.awayScore : match.awayScore < match.homeScore);

  const side = (name: string, value: string | undefined, which: 'home' | 'away') => (
    <View style={styles.lightSide}>
      <Text
        style={[behind(which) ? type.body : type.lead, styles.lightName, { color: behind(which) ? theme.muted : theme.ink }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {value !== undefined && (
        <Text style={[type.figure, { color: behind(which) ? theme.muted : theme.ink }]}>{value}</Text>
      )}
    </View>
  );

  return (
    <PressableScale
      onPress={onOpen}
      accessibilityLabel={`Match ${match.matchNumber}, ${match.homeTeamName} ${score ? score.home : ''} against ${match.awayTeamName} ${score ? score.away : ''}, ${line.label}`}
      accessibilityHint={live ? 'Opens the match' : undefined}
      style={[styles.lightRow, { borderBottomColor: theme.cardDivider }]}
    >
      <View style={styles.lightStatus}>
        {live && (
          <View style={[styles.lightRing, { backgroundColor: theme.tint }]}>
            <View style={[styles.lightDot, { backgroundColor: theme.accent }]} />
          </View>
        )}
        <Text style={[type.caption, { color: live ? theme.deep : theme.muted }]}>
          {line.label}, {where}
        </Text>
      </View>
      {score ? (
        <View style={{ gap: 2 }}>
          {side(match.homeTeamName, score.home, 'home')}
          {side(match.awayTeamName, score.away, 'away')}
        </View>
      ) : (
        <Text style={[type.lead, styles.lightName, { color: theme.ink }]} numberOfLines={2}>
          {match.homeTeamName} <Text style={[type.body, { color: theme.muted }]}>v</Text> {match.awayTeamName}
        </Text>
      )}
      {result ? <Text style={[type.caption, { color: theme.ink }]}>{result}</Text> : null}
      {!score && match.sport === 'Cricket' ? <Text style={[type.caption, { color: theme.muted }]}>Toss and XIs not set yet</Text> : null}
      {live && (
        <Text style={[type.bodyStrong, { color: theme.deep }]}>
          {liveLabel(match, canScore)} ›
        </Text>
      )}
    </PressableScale>
  );
}

/**
 * Who won a finished match, for the bold line: football by the goals; cricket by the server's own
 * result line ("Lions won by 6 wickets"), since a card carries no winner id.
 */
function winnerOf(m: MatchCard): 'home' | 'away' | null {
  if (phaseOf(m) !== 'completed') return null;
  if (m.sport === 'Football') return m.homeScore > m.awayScore ? 'home' : m.awayScore > m.homeScore ? 'away' : null;
  const r = m.resultSummary ?? '';
  return r.startsWith(m.homeTeamName) ? 'home' : r.startsWith(m.awayTeamName) ? 'away' : null;
}

/**
 * The glass theme's match ("N · Matches"): a frosted card — what it is and where it stands, each side
 * with its score (the winner in bold), then what happened in the sport's colour. A live one adds the
 * one tinted button that matters; an upcoming one says what's still to set.
 */
function GlassMatchCard({ match, onOpen, live, canScore }: { match: MatchCard; onOpen: () => void; live?: boolean; canScore: boolean }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const line = statusLine(match);
  const score = scoreOf(match);
  const won = winnerOf(match);
  const where = `Match ${match.matchNumber}, ${match.roundLabel ?? `group ${match.groupName}`}`;
  const result = match.sport === 'Cricket' ? match.resultSummary : null;

  const side = (name: string, value: string, which: 'home' | 'away') => (
    <View style={styles.side}>
      <Text style={[won === which ? styles.sideNameWon : styles.sideName, { color: theme.onDark, flex: 1 }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[won === which ? styles.sideScoreWon : styles.sideScore, { color: theme.onDark }]}>{value}</Text>
    </View>
  );

  const label = `${where}, ${match.homeTeamName} ${score ? score.home : ''} against ${match.awayTeamName} ${score ? score.away : ''}, ${line.label}`;
  // A live card's button is how it opens, so the card itself isn't one (no button in a button).
  const Frame = live ? View : PressableScale;
  return (
    <Frame
      onPress={live ? undefined : onOpen}
      accessibilityLabel={live ? undefined : label}
      style={[styles.card, { backgroundColor: theme.cream }]}
    >
      <View style={styles.topRow}>
        {live ? <StatusChip label={line.label} tone="live" /> : <Text style={[type.caption, { color: theme.onDarkSoft }]}>{where}</Text>}
        {live ? (
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>{where}</Text>
        ) : (
          // Not started isn't a warning here, just a fact: quiet words.
          <StatusChip label={line.label} tone={line.tone === 'setup' ? 'done' : line.tone} />
        )}
      </View>
      {score ? (
        <View style={{ gap: 4 }}>
          {side(match.homeTeamName, score.home, 'home')}
          {side(match.awayTeamName, score.away, 'away')}
        </View>
      ) : (
        <>
          <Text style={[styles.sideName, { color: theme.onDark }]} numberOfLines={2}>
            {match.homeTeamName} v {match.awayTeamName}
          </Text>
          {match.sport === 'Cricket' && <Text style={[type.caption, { color: theme.onDarkSoft }]}>Toss and XIs not set yet</Text>}
        </>
      )}
      {result ? <Text style={[styles.result, { color: theme.accent }]}>{result}</Text> : null}
      {live && (
        <Button
          label={liveLabel(match, canScore)}
          onPress={onOpen}
          accessibilityHint={label}
          style={styles.liveButton}
        />
      )}
    </Frame>
  );
}

/** The big pinned card for a match in progress, with the one button that matters. */
export function LiveMatchCard({ match, onOpen, canScore }: { match: MatchCard; onOpen: () => void; canScore: boolean }) {
  const theme = useSportTheme();
  if (theme.mode === 'light') return <LightMatchRow match={match} onOpen={onOpen} live canScore={canScore} />;
  return <GlassMatchCard match={match} onOpen={onOpen} live canScore={canScore} />;
}

/** A row in a group's list of fixtures. */
export function MatchRow({ match, onOpen, canScore }: { match: MatchCard; onOpen: () => void; canScore: boolean }) {
  const theme = useSportTheme();
  const live = phaseOf(match) === 'live';
  if (theme.mode === 'light') return <LightMatchRow match={match} onOpen={onOpen} live={live} canScore={canScore} />;
  return <GlassMatchCard match={match} onOpen={onOpen} live={live} canScore={canScore} />;
}

const makeStyles = ({ fonts, figures }: Typography) => StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  // Compact (2026-11-24, the user found the list crowded): a fixture list is scanned, so rows stay short.
  card: { borderRadius: radius.glass, borderCurve: 'continuous', paddingVertical: space.md, paddingHorizontal: 14, gap: 6 },
  side: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  sideName: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20 },
  sideNameWon: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  sideScore: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, fontVariant: figures },
  sideScoreWon: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20, fontVariant: figures },
  result: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  liveButton: { marginTop: space.xs },
  lightRow: { gap: 6, paddingTop: space.md, paddingBottom: 14, borderBottomWidth: 1 },
  lightStatus: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lightRing: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  lightDot: { width: 7, height: 7, borderRadius: 4 },
  lightSide: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  lightName: { flex: 1, fontSize: 17, lineHeight: 22 },
});
