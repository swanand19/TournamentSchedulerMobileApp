import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler';

import type { CricketBoard, CricketStats, FootballStats, StatBoard } from '@/api/types';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import PressableScale from '@/components/PressableScale';
import HubPage, { StickyBand } from '@/features/hub/HubPage';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The players' leaderboards. Their header (title and board chips) stays pinned under the tab bar
// while only the players move. The tournament's totals and records are the Summary tab's
// (SummaryTab.tsx), so this page is only about players.
//
// Everything here is built by the server from completed matches only, so it never shifts while a
// match is being played — the `basis` line at the foot says so.

type PageProps<T> = { stats: T; refreshing: boolean; onRefresh: () => void };

// ---------------------------------------------------------------------------------------------
// Shared pieces

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

// Long column names shortened for the one-line summary under a player; the server's names stay
// as they are on the website's tables.
const SHORT: Record<string, string> = { Batting: 'Bat', Bowling: 'Bowl', Fielding: 'Field' };

/** "Bat 45  ·  Bowl 30  ·  Field 8  ·  Mat 4": a board's supporting figures, in column order. */
function summary(parts: [string, string | number | null | undefined][], note?: string | null) {
  return [...parts.map(([c, v]) => (v != null ? `${SHORT[c] ?? c} ${v}` : null)), note].filter(Boolean).join('  ·  ');
}

/** One player on a board: name, team, and one faint line of supporting figures that is cut short
 *  rather than wrapped, so every row is the same height. Tapping it opens the player's profile. */
function LeaderRow({
  rank,
  name,
  team,
  value,
  valueLabel,
  detail,
  playerId,
}: {
  rank: number;
  name: string;
  team: string;
  value: string | number;
  valueLabel: string;
  detail?: string;
  playerId: number;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const top = rank === 1;
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/profile', params: { playerId: String(playerId) } })}
      style={[styles.leader, { backgroundColor: theme.deck, borderColor: theme.mode === 'dark' ? 'transparent' : top ? theme.accentSoft : theme.borderOnDark }, theme.mode === 'dark' && styles.glassTile, theme.mode === 'light' && [styles.lightLeader, { borderColor: theme.cardDivider }]]}
      accessibilityRole="button"
      accessibilityHint="Opens their profile"
      accessibilityLabel={`Rank ${rank}, ${name}, ${team}, ${value} ${valueLabel}${detail ? `, ${detail}` : ''}`}
    >
      <Text style={[styles.rank, { color: top ? theme.accent : theme.onDarkSoft }]}>{rank}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.lead, { color: theme.onDark }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
          {team}
        </Text>
        {detail ? (
          <Text style={[type.caption, styles.meta, { color: theme.onDarkSoft }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.leaderValue, { color: top ? theme.accent : theme.onDark }]}>{value}</Text>
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>{valueLabel.toLowerCase()}</Text>
      </View>
    </PressableScale>
  );
}

function Footnotes({ basis, notes }: { basis: string; notes: string[] }) {
  const { type } = useTypography();
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
  const { type } = useTypography();
  const theme = useSportTheme();
  const [boardKey, setBoardKey] = useState(stats.playerBoards[0]?.key ?? '');
  const board: StatBoard | undefined = stats.playerBoards.find((b) => b.key === boardKey) ?? stats.playerBoards[0];

  const rows = board?.rows.slice(0, 25) ?? [];

  return (
    <HubPage refreshing={refreshing} onRefresh={onRefresh} stickyIndex={0}>
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
            playerId={r.playerId}
            rank={r.rank}
            name={`${r.jerseyNumber != null ? `#${r.jerseyNumber} ` : ''}${r.playerName}`}
            team={r.teamName}
            value={r.value}
            valueLabel={board!.valueLabel}
            detail={summary(
              [...board!.detailColumns.map((c): [string, number] => [c, r.detail[c] ?? 0]), ['Apps', r.appearances]],
              board!.showPerMatch && r.perMatch != null ? `${r.perMatch.toFixed(2)} a match` : null,
            )}
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
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const [category, setCategory] = useState<Category>('batting');
  const boards: CricketBoard[] =
    category === 'batting' ? stats.battingBoards : category === 'bowling' ? stats.bowlingBoards : category === 'fielding' ? stats.fieldingBoards : [stats.mvp];
  const [boardKey, setBoardKey] = useState('');
  const board = boards.find((b) => b.key === boardKey) ?? boards[0];
  const [pointsOpen, setPointsOpen] = useState({ open: false, key: 0 });
  const rows = board?.rows.slice(0, 25) ?? [];

  return (
    <HubPage refreshing={refreshing} onRefresh={onRefresh} stickyIndex={0}>
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
            playerId={r.playerId}
            rank={r.rank}
            name={r.playerName}
            team={r.teamName}
            value={r.value}
            valueLabel={board!.valueLabel}
            detail={summary(board!.columns.map((c) => [c, r.detail[c]]), r.note)}
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

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  leader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  meta: { opacity: 0.8, fontVariant: figures },
  rank: { width: 24, fontFamily: fonts.display, fontSize: 22, textAlign: 'center', fontVariant: figures },
  leaderValue: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, fontVariant: figures },
  pointRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 },
  /** Glass: a frosted pane, no edge, the design's softer corner. */
  glassTile: { borderRadius: 20, borderCurve: 'continuous', paddingHorizontal: 14 },
  lightLeader: { borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, paddingHorizontal: 0 },
});
