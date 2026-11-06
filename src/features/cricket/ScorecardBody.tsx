import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CricketScorecard, InningsCard } from '@/api/types';
import { Card, Deck } from '@/components/Card';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import SectionHeader from '@/components/SectionHeader';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// A scorecard's innings, one at a time behind chips: batting, extras and total, fall of wickets,
// bowling. Shared by the scorer's Scorecard screen and the watcher's swipe page.

export default function ScorecardBody({ card }: { card: CricketScorecard }) {
  const [picked, setPicked] = useState<number | null>(null);
  const innings = card.innings;
  if (innings.length === 0)
    return <EmptyState icon="table-large" title="No innings yet" message="The scorecard fills in ball by ball once play starts." />;

  const current = innings.find((i) => i.inningsId === picked) ?? innings[innings.length - 1];
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {innings.map((i) => (
          <Chip
            key={i.inningsId}
            label={`${i.isSuperOver ? 'SO · ' : ''}${i.battingTeamName} ${i.runs}/${i.wickets}`}
            selected={i.inningsId === current.inningsId}
            onPress={() => setPicked(i.inningsId)}
          />
        ))}
      </ScrollView>
      <Innings card={current} />
    </>
  );
}

function Innings({ card }: { card: InningsCard }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  // Light ("B · Scorecard"): open tables flush with the screen, no bands or tinted rows, quiet words.
  const light = theme.mode === 'light';
  const batted = card.batting.filter((b) => b.hasBatted);
  const yetToBat = card.batting.filter((b) => !b.hasBatted);

  return (
    <>
      <SectionHeader
        eyebrow={`Innings ${card.inningsNumber}${card.isFollowOn ? ' · follow-on' : ''}${card.target ? ` · target ${card.target}` : ''}`}
        title={`${card.battingTeamName} batting`}
      />
      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <Head cols={['R', 'B', '4s', '6s', 'SR']} first="Batter" />
        {batted.map((b) => {
          const atCrease = b.isStriker || b.isNonStriker;
          return (
            <View
              key={b.playerId}
              style={[styles.tr, light && styles.lightTr, { borderTopColor: theme.cardDivider }, atCrease && !light && { backgroundColor: theme.tint }]}
              accessible
              accessibilityLabel={`${b.playerName}, ${b.dismissalText}, ${b.runs} off ${b.ballsFaced}`}
            >
              <View style={styles.nameCell}>
                <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
                  {b.playerName}
                  {b.isStriker ? ' *' : ''}
                </Text>
                <Text style={[type.caption, { color: b.isOut ? theme.muted : theme.successInk }]} numberOfLines={1}>
                  {b.dismissalText}
                </Text>
              </View>
              <Text style={[styles.cell, styles.big, { color: theme.ink }]}>{b.runs}</Text>
              {[b.ballsFaced, b.fours, b.sixes].map((v, i) => (
                <Text key={i} style={[styles.cell, { color: theme.muted }]}>
                  {v}
                </Text>
              ))}
              <Text style={[styles.cell, styles.wide, { color: theme.muted }]}>{b.strikeRate.toFixed(1)}</Text>
            </View>
          );
        })}
        {yetToBat.length > 0 && (
          <View style={[styles.note, light && styles.lightTr, { borderTopColor: theme.cardDivider }]}>
            <Text style={[type.caption, { color: theme.muted }]}>
              <Text style={type.label}>Yet to bat: </Text>
              {yetToBat.map((b) => b.playerName).join(', ')}
            </Text>
          </View>
        )}
      </Card>

      <Deck style={styles.totals}>
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>
            {light
              ? `Extras ${card.extrasTotal}: wd ${card.wides}, nb ${card.noBalls}, b ${card.byes}, lb ${card.legByes}${card.penaltyRuns ? `, pen ${card.penaltyRuns}` : ''}`
              : `EXTRAS ${card.extrasTotal} · WD ${card.wides} · NB ${card.noBalls} · B ${card.byes} · LB ${card.legByes}${card.penaltyRuns ? ` · PEN ${card.penaltyRuns}` : ''}`}
          </Text>
          <Text style={[type.score, { color: theme.onDark }]}>
            {card.runs}
            <Text style={{ color: light ? theme.placeholderInk : theme.accent }}>/</Text>
            {card.wickets}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.figure, { color: theme.onDark }]}>
            {card.overs}
            {card.oversLimit ? ` / ${card.oversLimit}` : ''} ov
          </Text>
          <Text style={[type.bodyStrong, { color: light ? theme.deep : theme.accent }]}>
            {light ? 'Run rate' : 'RR'} {card.runRate.toFixed(2)}
          </Text>
        </View>
      </Deck>

      {card.fallOfWickets.length > 0 && (
        <View style={{ gap: space.sm }}>
          <SectionHeader title="Fall of wickets" />
          <View style={styles.fow}>
            {card.fallOfWickets.map((f) => (
              <View
                key={f.wicketNumber}
                style={[styles.fowChip, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }, light && styles.lightFow]}
              >
                <Text style={[type.bodyStrong, { color: light ? theme.deep : theme.accent }]}>
                  {f.wicketNumber}-{f.runs}
                </Text>
                <Text style={[type.caption, { color: theme.onDark }]}>
                  {f.playerName} ({f.overs})
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <SectionHeader title={`${card.bowlingTeamName} bowling`} />
      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <Head cols={['O', 'M', 'R', 'W', 'Econ']} first="Bowler" />
        {card.bowling.map((b) => (
          <View
            key={b.playerId}
            style={[styles.tr, light && styles.lightTr, { borderTopColor: theme.cardDivider }]}
            accessible
            accessibilityLabel={`${b.playerName}: ${b.overs} overs, ${b.maidens} maidens, ${b.runs} runs, ${b.wickets} wickets`}
          >
            <View style={styles.nameCell}>
              <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
                {b.playerName}
              </Text>
              {b.wides + b.noBalls > 0 && (
                <Text style={[type.caption, { color: theme.muted }]}>
                  {b.wides} wd · {b.noBalls} nb
                </Text>
              )}
            </View>
            {[b.overs, b.maidens, b.runs].map((v, i) => (
              <Text key={i} style={[styles.cell, { color: theme.muted }]}>
                {v}
              </Text>
            ))}
            <Text style={[styles.cell, styles.big, { color: theme.ink }]}>{b.wickets}</Text>
            <Text style={[styles.cell, styles.wide, { color: theme.muted }]}>{b.economy.toFixed(2)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function Head({ cols, first }: { cols: string[]; first: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View
      style={[styles.tr, styles.th, { backgroundColor: theme.chip }, theme.mode === 'light' && [styles.lightTr, { backgroundColor: 'transparent' }]]}
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[type.label, styles.nameCell, { color: theme.muted }]}>{first}</Text>
      {cols.map((c, i) => (
        <Text key={c} style={[type.label, styles.cell, i === cols.length - 1 && styles.wide, { color: theme.muted }]}>
          {c}
        </Text>
      ))}
    </View>
  );
}

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1, minHeight: 52 },
  th: { borderTopWidth: 0, minHeight: 36 },
  nameCell: { flex: 1, paddingRight: space.xs },
  cell: { width: 34, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 14, fontVariant: figures },
  wide: { width: 46 },
  big: { fontFamily: fonts.display, fontSize: 20 },
  note: { paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1 },
  totals: { flexDirection: 'row', alignItems: 'center' },
  fow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fowChip: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: space.xs },
  lightTr: { paddingHorizontal: 0 },
  lightFow: { borderWidth: 0, paddingHorizontal: 0, marginRight: space.md },
});
