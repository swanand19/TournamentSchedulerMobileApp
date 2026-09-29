import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CricketStats, FootballStats, TeamStandingRow } from '@/api/types';
import { Deck } from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import PressableScale from '@/components/PressableScale';
import SectionHeader from '@/components/SectionHeader';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// Standings per group. The columns that fit a phone are always on; the rest of a football row
// (goals, clean sheets, cards, shootouts) opens under it on tap rather than scrolling sideways.

const COL = 30;

export function FootballTable({ stats }: { stats: FootballStats }) {
  const theme = useSportTheme();
  const groups = [...new Set(stats.standings.map((r) => r.groupName))].sort();
  if (stats.standings.length === 0) {
    return <EmptyState icon="table-large" title="No table yet" message="The table fills in as matches finish." />;
  }
  return (
    <View style={{ gap: space.lg }}>
      {groups.map((g) => (
        <FootballGroup key={g} name={g} rows={stats.standings.filter((r) => r.groupName === g)} />
      ))}
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>{stats.basis}</Text>
    </View>
  );
}

function FootballGroup({ name, rows }: { name: string; rows: TeamStandingRow[] }) {
  const theme = useSportTheme();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Deck style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm }}>
        <SectionHeader title={`Group ${name} table`} />
      </View>
      <HeaderRow cols={['P', 'W', 'D', 'L', 'GD', 'PTS']} />
      {[...rows]
        .sort((a, b) => a.rank - b.rank)
        .map((r) => {
          const expanded = open === r.teamId;
          return (
            <PressableScale
              key={r.teamId}
              onPress={() => {
                haptic.select();
                setOpen(expanded ? null : r.teamId);
              }}
              accessibilityLabel={`${r.rank}, ${r.teamName}: played ${r.played}, won ${r.won}, drawn ${r.drawn}, lost ${r.lost}, goal difference ${r.goalDifference}, ${r.points} points`}
              accessibilityState={{ expanded }}
              style={[styles.row, { borderTopColor: theme.borderOnDark }]}
            >
              <View style={styles.line}>
                <Text style={[styles.rank, { color: theme.accent }]}>{r.rank}</Text>
                <Text style={[type.bodyStrong, { color: theme.onDark, flex: 1 }]} numberOfLines={1}>
                  {r.teamName}
                </Text>
                {[r.played, r.won, r.drawn, r.lost, r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference].map((v, i) => (
                  <Text key={i} style={[styles.cell, { color: theme.onDarkSoft }]}>
                    {v}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.pts, { color: theme.onDark }]}>{r.points}</Text>
              </View>
              {expanded && (
                <View style={[styles.detail, { backgroundColor: theme.surfaceOnDark }]}>
                  <Detail label="Goals" value={`${r.goalsFor}–${r.goalsAgainst}`} />
                  <Detail label="Clean sheets" value={r.cleanSheets} />
                  <Detail label="Cards" value={`${r.yellowCards}Y ${r.redCards}R`} />
                  {r.shootoutsWon + r.shootoutsLost > 0 && <Detail label="Shootouts" value={`${r.shootoutsWon}W ${r.shootoutsLost}L`} />}
                </View>
              )}
            </PressableScale>
          );
        })}
    </Deck>
  );
}

export function CricketTable({ stats }: { stats: CricketStats }) {
  const theme = useSportTheme();
  if (stats.pointsTable.every((g) => g.rows.length === 0)) {
    return <EmptyState icon="table-large" title="No table yet" message="The points table fills in as matches finish." />;
  }
  return (
    <View style={{ gap: space.lg }}>
      {stats.pointsTable.map((g) => (
        <Deck key={g.groupName} style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
          <View style={{ padding: space.lg, paddingBottom: space.sm }}>
            <SectionHeader eyebrow="Points, then net run rate" title={`Group ${g.groupName}`} />
          </View>
          <HeaderRow cols={['P', 'W', 'L', 'NR', 'PTS']} wide="NRR" />
          {g.rows.map((r) => (
            <View
              key={r.teamId}
              style={[styles.row, { borderTopColor: theme.borderOnDark }]}
              accessible
              accessibilityLabel={`${r.rank}, ${r.teamName}: played ${r.played}, won ${r.won}, lost ${r.lost}, ${r.points} points, net run rate ${r.netRunRate.toFixed(3)}`}
            >
              <View style={styles.line}>
                <Text style={[styles.rank, { color: theme.accent }]}>{r.rank}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[type.bodyStrong, { color: theme.onDark }]} numberOfLines={1}>
                    {r.teamName}
                  </Text>
                  {r.form.length > 0 && <FormStrip form={r.form} />}
                </View>
                {[r.played, r.won, r.lost, r.noResult].map((v, i) => (
                  <Text key={i} style={[styles.cell, { color: theme.onDarkSoft }]}>
                    {v}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.pts, { color: theme.onDark }]}>{r.points}</Text>
                <Text style={[styles.cell, styles.nrr, { color: r.netRunRate >= 0 ? '#B9DB94' : theme.onDarkSoft }]}>
                  {r.netRunRate >= 0 ? '+' : ''}
                  {r.netRunRate.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
        </Deck>
      ))}
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>{stats.basis}</Text>
    </View>
  );
}

/** W / L / T / D / NR pills. A loss is muted, not red — red means a wicket in this app. */
function FormStrip({ form }: { form: string[] }) {
  const theme = useSportTheme();
  return (
    <View style={styles.form} accessibilityLabel={`Form ${form.join(', ')}`}>
      {form.slice(-5).map((f, i) => (
        <View
          key={i}
          style={[
            styles.formPill,
            { backgroundColor: f === 'W' ? theme.successSolid : theme.surfaceOnDark, borderColor: theme.borderOnDark },
          ]}
        >
          <Text style={[styles.formText, { color: f === 'W' ? '#FFFFFF' : theme.onDarkSoft }]}>{f}</Text>
        </View>
      ))}
    </View>
  );
}

function HeaderRow({ cols, wide }: { cols: string[]; wide?: string }) {
  const theme = useSportTheme();
  return (
    <View style={[styles.line, styles.head, { backgroundColor: theme.surfaceOnDark }]} importantForAccessibility="no-hide-descendants">
      <Text style={[styles.rank, type.label, { color: theme.onDarkSoft }]}>#</Text>
      <Text style={[type.label, { color: theme.onDarkSoft, flex: 1 }]}>Team</Text>
      {cols.map((c) => (
        <Text key={c} style={[styles.cell, type.label, { color: theme.onDarkSoft }]}>
          {c}
        </Text>
      ))}
      {wide ? <Text style={[styles.cell, styles.nrr, type.label, { color: theme.onDarkSoft }]}>{wide}</Text> : null}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string | number }) {
  const theme = useSportTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[type.figure, { color: theme.onDark }]}>{value}</Text>
      <Text style={[type.label, { color: theme.onDarkSoft }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 1, gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rank: { width: 26, fontFamily: fonts.display, fontSize: 18 },
  cell: { width: COL, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 14, fontVariant: ['tabular-nums'] },
  pts: { fontFamily: fonts.display, fontSize: 18 },
  nrr: { width: 50 },
  detail: { flexDirection: 'row', borderRadius: radius.md, paddingVertical: space.sm },
  form: { flexDirection: 'row', gap: 3 },
  formPill: { minWidth: 20, height: 18, borderRadius: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 2 },
  formText: { fontFamily: fonts.bodyBold, fontSize: 10 },
});
