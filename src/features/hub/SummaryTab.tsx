import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CricketStats, FootballStats } from '@/api/types';
import { Deck, Panel } from '@/components/Card';
import SectionHeader from '@/components/SectionHeader';
import HubPage from '@/features/hub/HubPage';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The tournament at a glance: how many matches are played and its totals and records. Its own tab
// (the user's call, 2026-11-03) so the Stats tab is only the players' leaderboards. Same answer as
// Table and Stats, built from completed matches only — the `basis` line at the foot says so.

type PageProps<T> = { stats: T; refreshing: boolean; onRefresh: () => void };

function Tile({ label, value, sub, wide, accent }: { label: string; value: string | number; sub?: string; wide?: boolean; accent?: boolean }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View
      style={[styles.tile, theme.mode === 'light' && styles.lightTile, wide && styles.tileWide, { backgroundColor: theme.deck, borderColor: theme.mode === 'light' ? theme.borderOnDark : 'transparent' }, theme.mode === 'dark' && styles.glassTile]}
      accessible
      accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}
    >
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: accent ? theme.accent : theme.onDark }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={2}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function Grid({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return <View style={[styles.grid, theme.mode === 'light' && { columnGap: space.xl }]}>{children}</View>;
}

function Progress({ done, total }: { done: number; total: number }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Deck accessibilityLabel={`${done} of ${total} matches played, ${pct} percent`}>
      <View style={styles.progressHead}>
        <Text style={[type.bodyStrong, { color: theme.onDarkSoft }]}>Matches played</Text>
        <Text style={[type.bodyStrong, { color: theme.accent }]}>{pct}%</Text>
      </View>
      <Text style={[type.score, { color: theme.onDark }]}>
        {done}
        <Text style={[type.heading, { color: theme.onDarkSoft }]}> of {total}</Text>
      </Text>
      <View style={[styles.track, { backgroundColor: theme.mode === 'light' ? theme.chip : theme.deckRaised }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
      </View>
    </Deck>
  );
}

function Basis({ text }: { text: string }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return <Text style={[type.caption, { color: theme.onDarkSoft }]}>{text}</Text>;
}

export function FootballSummaryPage({ stats, refreshing, onRefresh }: PageProps<FootballStats>) {
  const s = stats.summary;
  return (
    <HubPage refreshing={refreshing} onRefresh={onRefresh}>
      <Progress done={s.matchesCompleted} total={s.totalMatches} />
      <Grid>
        <Tile label="Goals" value={s.totalGoals} sub={`${s.goalsPerMatch.toFixed(2)} a match`} accent />
        <Tile label="Assists" value={s.totalAssists} />
        <Tile label="Cards" value={`${s.totalYellowCards} / ${s.totalRedCards}`} sub="yellow / red" />
        <Tile label="Clean sheets" value={s.cleanSheets} />
        <Tile label="Draws" value={s.matchesDrawn} sub={s.shootoutsPlayed ? `${s.shootoutsPlayed} went to penalties` : undefined} />
        <Tile label="Substitutions" value={s.totalSubstitutions} />
        {s.highestScoringMatch ? <Tile label="Highest scoring match" value={s.highestScoringMatch} wide /> : null}
        {s.biggestWin ? <Tile label="Biggest win" value={s.biggestWin} wide /> : null}
      </Grid>
      <Basis text={stats.basis} />
    </HubPage>
  );
}

export function CricketSummaryPage({ stats, refreshing, onRefresh }: PageProps<CricketStats>) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const s = stats.summary;
  return (
    <HubPage refreshing={refreshing} onRefresh={onRefresh}>
      <Progress done={s.matchesCompleted} total={s.totalMatches} />
      <Grid>
        <Tile label="Runs" value={s.totalRuns.toLocaleString()} accent />
        <Tile label="Wickets" value={s.totalWickets} />
        <Tile label="Fours and sixes" value={`${s.fours} / ${s.sixes}`} />
        <Tile label="Fifties and hundreds" value={`${s.fifties} / ${s.hundreds}`} />
        {s.highestScore ? <Tile label="Highest score" value={s.highestScore} wide /> : null}
        {s.bestBowling ? <Tile label="Best bowling" value={s.bestBowling} wide /> : null}
        {s.highestTeamTotal ? <Tile label="Highest total" value={s.highestTeamTotal} wide /> : null}
      </Grid>
      {s.mvp ? (
        <Panel>
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>Most valuable player</Text>
          <Text style={[type.lead, { color: theme.onDark }]}>{s.mvp}</Text>
        </Panel>
      ) : null}
      <Records stats={stats} />
      <Basis text={stats.basis} />
    </HubPage>
  );
}

function Records({ stats }: { stats: CricketStats }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const sections = [
    { title: 'Highest totals', rows: stats.records.highestTotals },
    { title: 'Lowest totals', rows: stats.records.lowestTotals },
    { title: 'Biggest wins', rows: stats.records.biggestWins },
    { title: 'Highest partnerships', rows: stats.records.highestPartnerships },
  ].filter((s) => s.rows.length > 0);
  if (sections.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title="Team records" />
      {sections.map((s) => (
        <Deck key={s.title} style={{ gap: space.xs }}>
          <Text style={[type.bodyStrong, { color: theme.accent }]}>{s.title}</Text>
          {s.rows.slice(0, 3).map((r, i) => (
            <View key={i} style={styles.recordRow}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: theme.onDark }]}>{r.teamName}</Text>
                <Text style={[type.caption, { color: theme.onDarkSoft }]}>{r.detail}</Text>
              </View>
              <Text style={[type.figure, { color: theme.onDark }]}>{r.value}</Text>
            </View>
          ))}
        </Deck>
      ))}
    </View>
  );
}

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, borderRadius: radius.lg, borderWidth: 1, padding: space.md, gap: 2 },
  tileWide: { flexBasis: '100%' },
  tileValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontVariant: figures },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  // Light: figures as open rows between hairlines, not boxes.
  lightTile: { flexBasis: '40%', borderWidth: 0, borderTopWidth: 1, borderRadius: 0, paddingHorizontal: 0, paddingTop: space.sm },
  /** Glass: a frosted pane, no edge, the design's softer corner. */
  glassTile: { borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14 },
});
