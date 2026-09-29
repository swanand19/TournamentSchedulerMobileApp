import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import type { CricketBoard, CricketStats, FootballStats, StatBoard } from '@/api/types';
import Button from '@/components/Button';
import { Deck, Panel } from '@/components/Card';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import HubPage, { StickyBand } from '@/features/hub/HubPage';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// The numbers, in reading order: the overview first; then, as you scroll into the leaderboards,
// their header (title and board chips) pins under the tab bar and only the players move. Scroll
// back up and the header stays until you're past the top of the list, then the overview returns.
//
// Everything here is built by the server from completed matches only, so it never shifts while a
// match is being played — the `basis` line at the foot says so.

type PageProps<T> = { stats: T; refreshing: boolean; onRefresh: () => void };

// ---------------------------------------------------------------------------------------------
// Shared pieces

function Tile({ label, value, sub, wide, accent }: { label: string; value: string | number; sub?: string; wide?: boolean; accent?: boolean }) {
  const theme = useSportTheme();
  return (
    <View
      style={[styles.tile, wide && styles.tileWide, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}
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

function Progress({ done, total }: { done: number; total: number }) {
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
      <View style={[styles.track, { backgroundColor: theme.deckRaised }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: theme.accent }]} />
      </View>
    </Deck>
  );
}

/** Board chips scroll sideways. A gesture-handler scroll view, so a sideways drag here scrolls the
 *  chips instead of turning the hub's page. */
function BoardChips<K extends string>({ boards, value, onChange }: { boards: { key: K; title: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <GestureScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}>
      {boards.map((b) => (
        <Chip key={b.key} label={b.title} selected={b.key === value} onPress={() => onChange(b.key)} />
      ))}
    </GestureScrollView>
  );
}

function LeaderRow({
  rank,
  name,
  team,
  value,
  valueLabel,
  detail,
}: {
  rank: number;
  name: string;
  team: string;
  value: string | number;
  valueLabel: string;
  detail?: string;
}) {
  const theme = useSportTheme();
  const top = rank === 1;
  return (
    <View
      style={[styles.leader, { backgroundColor: theme.deck, borderColor: top ? theme.accentSoft : theme.borderOnDark }]}
      accessible
      accessibilityLabel={`Rank ${rank}, ${name}, ${team}, ${value} ${valueLabel}${detail ? `, ${detail}` : ''}`}
    >
      <Text style={[styles.rank, { color: top ? theme.accent : theme.onDarkSoft }]}>{rank}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.lead, { color: theme.onDark }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={2}>
          {team}
          {detail ? `  ·  ${detail}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.leaderValue, { color: top ? theme.accent : theme.onDark }]}>{value}</Text>
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>{valueLabel.toLowerCase()}</Text>
      </View>
    </View>
  );
}

function Footnotes({ basis, notes }: { basis: string; notes: string[] }) {
  const theme = useSportTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>{basis}</Text>
      {notes.map((n, i) => (
        <Text key={i} style={[type.caption, { color: theme.onDarkSoft }]}>
          {n}
        </Text>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Football

export function FootballStatsPage({ stats, refreshing, onRefresh }: PageProps<FootballStats>) {
  const theme = useSportTheme();
  const s = stats.summary;
  const [boardKey, setBoardKey] = useState(stats.playerBoards[0]?.key ?? '');
  const board: StatBoard | undefined = stats.playerBoards.find((b) => b.key === boardKey) ?? stats.playerBoards[0];

  const rows = board?.rows.slice(0, 25) ?? [];

  return (
    <HubPage refreshing={refreshing} onRefresh={onRefresh} stickyIndex={1}>
      <View style={{ gap: space.lg }}>
        <Progress done={s.matchesCompleted} total={s.totalMatches} />
        <View style={styles.grid}>
          <Tile label="Goals" value={s.totalGoals} sub={`${s.goalsPerMatch.toFixed(2)} a match`} accent />
          <Tile label="Assists" value={s.totalAssists} />
          <Tile label="Cards" value={`${s.totalYellowCards} / ${s.totalRedCards}`} sub="yellow / red" />
          <Tile label="Clean sheets" value={s.cleanSheets} />
          <Tile label="Draws" value={s.matchesDrawn} sub={s.shootoutsPlayed ? `${s.shootoutsPlayed} went to penalties` : undefined} />
          <Tile label="Substitutions" value={s.totalSubstitutions} />
          {s.highestScoringMatch ? <Tile label="Highest scoring match" value={s.highestScoringMatch} wide /> : null}
          {s.biggestWin ? <Tile label="Biggest win" value={s.biggestWin} wide /> : null}
        </View>
      </View>

      <StickyBand>
        <SectionHeader title={board?.title ?? 'Leaderboards'} />
        {stats.playerBoards.length > 0 && board ? <BoardChips boards={stats.playerBoards} value={board.key} onChange={setBoardKey} /> : null}
        {board?.note ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{board.note}</Text> : null}
      </StickyBand>

      {rows.length === 0 ? (
        <EmptyState icon="podium" title="No entries yet" message="This board fills in as matches finish." />
      ) : (
        rows.map((r) => (
          <LeaderRow
            key={`${board!.key}-${r.playerId}`}
            rank={r.rank}
            name={`${r.jerseyNumber != null ? `#${r.jerseyNumber} ` : ''}${r.playerName}`}
            team={r.teamName}
            value={r.value}
            valueLabel={board!.valueLabel}
            detail={[
              ...board!.detailColumns.map((c) => `${c} ${r.detail[c] ?? 0}`),
              `${r.appearances} apps`,
              board!.showPerMatch && r.perMatch != null ? `${r.perMatch.toFixed(2)} a match` : null,
            ]
              .filter(Boolean)
              .join(', ')}
          />
        ))
      )}

      <Footnotes basis={stats.basis} notes={stats.notes} />
    </HubPage>
  );
}

// ---------------------------------------------------------------------------------------------
// Cricket

type Category = 'batting' | 'bowling' | 'fielding' | 'mvp';

export function CricketStatsPage({ stats, refreshing, onRefresh }: PageProps<CricketStats>) {
  const theme = useSportTheme();
  const s = stats.summary;
  const [category, setCategory] = useState<Category>('batting');
  const boards: CricketBoard[] =
    category === 'batting' ? stats.battingBoards : category === 'bowling' ? stats.bowlingBoards : category === 'fielding' ? stats.fieldingBoards : [stats.mvp];
  const [boardKey, setBoardKey] = useState('');
  const board = boards.find((b) => b.key === boardKey) ?? boards[0];
  const [pointsOpen, setPointsOpen] = useState({ open: false, key: 0 });
  const rows = board?.rows.slice(0, 25) ?? [];

  return (
    <HubPage refreshing={refreshing} onRefresh={onRefresh} stickyIndex={1}>
      <View style={{ gap: space.lg }}>
        <Progress done={s.matchesCompleted} total={s.totalMatches} />
        <View style={styles.grid}>
          <Tile label="Runs" value={s.totalRuns.toLocaleString()} accent />
          <Tile label="Wickets" value={s.totalWickets} />
          <Tile label="Fours and sixes" value={`${s.fours} / ${s.sixes}`} />
          <Tile label="Fifties and hundreds" value={`${s.fifties} / ${s.hundreds}`} />
          {s.highestScore ? <Tile label="Highest score" value={s.highestScore} wide /> : null}
          {s.bestBowling ? <Tile label="Best bowling" value={s.bestBowling} wide /> : null}
          {s.highestTeamTotal ? <Tile label="Highest total" value={s.highestTeamTotal} wide /> : null}
        </View>
        {s.mvp ? (
          <Panel>
            <Text style={[type.caption, { color: theme.onDarkSoft }]}>Most valuable player</Text>
            <Text style={[type.lead, { color: theme.onDark }]}>{s.mvp}</Text>
          </Panel>
        ) : null}
        <Records stats={stats} />
      </View>

      <StickyBand>
        <SectionHeader title={board?.title ?? 'Leaderboards'} />
        <SegmentedControl
          segments={[
            { key: 'batting', label: 'Batting' },
            { key: 'bowling', label: 'Bowling' },
            { key: 'fielding', label: 'Fielding' },
            { key: 'mvp', label: 'MVP' },
          ]}
          value={category}
          onChange={(c) => {
            setCategory(c);
            setBoardKey('');
          }}
          accessibilityLabel="Leaderboard category"
        />
        {boards.length > 1 && board ? <BoardChips boards={boards} value={board.key} onChange={setBoardKey} /> : null}
        {board?.qualification ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{board.qualification}</Text> : null}
      </StickyBand>

      {rows.length === 0 ? (
        <EmptyState icon="podium" title="No entries yet" message="This board fills in as matches finish." />
      ) : (
        rows.map((r) => (
          <LeaderRow
            key={`${board!.key}-${r.playerId}-${r.rank}`}
            rank={r.rank}
            name={r.playerName}
            team={r.teamName}
            value={r.value}
            valueLabel={board!.valueLabel}
            detail={[...board!.columns.map((c) => (r.detail[c] != null ? `${c} ${r.detail[c]}` : null)), r.note]
              .filter(Boolean)
              .join(', ')}
          />
        ))
      )}

      {category === 'mvp' && stats.pointsSystem.length > 0 ? (
        <Button label="How the points work" variant="ghost" icon="information-outline" onPress={() => setPointsOpen((p) => ({ open: true, key: p.key + 1 }))} />
      ) : null}

      <Footnotes basis={stats.basis} notes={stats.notes} />

      <Sheet
        key={pointsOpen.key}
        visible={pointsOpen.open}
        onClose={() => setPointsOpen((p) => ({ ...p, open: false }))}
        title="How the points work"
        subtitle="Fantasy points behind the MVP race"
      >
        {[...new Set(stats.pointsSystem.map((p) => p.category))].map((cat) => (
          <View key={cat} style={{ gap: space.xs }}>
            <Text style={[type.bodyStrong, { color: theme.muted }]}>{cat}</Text>
            {stats.pointsSystem
              .filter((p) => p.category === cat)
              .map((p) => (
                <View key={p.item} style={styles.pointRow}>
                  <Text style={[type.body, { color: theme.ink, flex: 1 }]}>{p.item}</Text>
                  <Text style={[type.bodyStrong, { color: theme.ink }]}>{p.points > 0 ? `+${p.points}` : p.points}</Text>
                </View>
              ))}
          </View>
        ))}
      </Sheet>
    </HubPage>
  );
}

function Records({ stats }: { stats: CricketStats }) {
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
            <View key={i} style={styles.pointRow}>
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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, borderRadius: radius.lg, borderWidth: 1, padding: space.md, gap: 2 },
  tileWide: { flexBasis: '100%' },
  tileValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  leader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  rank: { width: 24, fontFamily: fonts.display, fontSize: 22, textAlign: 'center', fontVariant: ['tabular-nums'] },
  leaderValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
});
