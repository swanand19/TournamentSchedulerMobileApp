import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketScorecard, InningsCard } from '@/api/types';
import { Card, Deck } from '@/components/Card';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import { useQuery } from '@/hooks/useQuery';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// The scorecard, one innings at a time: batting, extras and total, fall of wickets, bowling.
// Built by the server from the ball-by-ball record; polled while open, so it follows a live match.

export default function ScorecardScreen() {
  const theme = useSportTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const fetcher = useCallback(() => api.call<CricketScorecard>('CRICKET_SCORECARD', { routeParams: { matchId } }), [matchId]);
  const card = useQuery(fetcher, { pollMs: 15000 });
  const [picked, setPicked] = useState<number | null>(null);

  const c = card.data;
  if (!c) return <Screen error={card.error} onRetry={card.refresh}>{card.loading && <Skeleton rows={5} />}</Screen>;

  const innings = c.innings;
  const current = innings.find((i) => i.inningsId === picked) ?? innings[innings.length - 1];

  return (
    <Screen onRefresh={card.refresh} refreshing={card.refreshing} error={card.error} onRetry={card.refresh}>
      <Deck>
        {c.resultSummary ? (
          <>
            <View style={styles.row}>
              <Icon name="trophy" size={18} color={theme.accent} />
              <Text style={[type.label, { color: theme.accent }]}>Result</Text>
            </View>
            <Text style={[type.title, { color: theme.onDark }]}>{c.resultSummary.toUpperCase()}</Text>
          </>
        ) : (
          <Text style={[type.title, { color: theme.onDark }]}>
            {c.homeTeamName.toUpperCase()} <Text style={{ color: theme.accent }}>V</Text> {c.awayTeamName.toUpperCase()}
          </Text>
        )}
        {c.tossSummary ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{c.tossSummary}.</Text> : null}
      </Deck>

      {innings.length === 0 ? (
        <EmptyState icon="table-large" title="No innings yet" message="The scorecard fills in ball by ball once play starts." />
      ) : (
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
      )}
    </Screen>
  );
}

function Innings({ card }: { card: InningsCard }) {
  const theme = useSportTheme();
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
              style={[styles.tr, { borderTopColor: theme.cardDivider }, atCrease && { backgroundColor: theme.tint }]}
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
          <View style={[styles.note, { borderTopColor: theme.cardDivider }]}>
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
            EXTRAS {card.extrasTotal} · WD {card.wides} · NB {card.noBalls} · B {card.byes} · LB {card.legByes}
            {card.penaltyRuns ? ` · PEN ${card.penaltyRuns}` : ''}
          </Text>
          <Text style={[type.score, { color: theme.onDark }]}>
            {card.runs}
            <Text style={{ color: theme.accent }}>/{card.wickets}</Text>
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.figure, { color: theme.onDark }]}>
            {card.overs}
            {card.oversLimit ? ` / ${card.oversLimit}` : ''} ov
          </Text>
          <Text style={[type.bodyStrong, { color: theme.accent }]}>RR {card.runRate.toFixed(2)}</Text>
        </View>
      </Deck>

      {card.fallOfWickets.length > 0 && (
        <View style={{ gap: space.sm }}>
          <SectionHeader title="Fall of wickets" />
          <View style={styles.fow}>
            {card.fallOfWickets.map((f) => (
              <View key={f.wicketNumber} style={[styles.fowChip, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}>
                <Text style={[type.bodyStrong, { color: theme.accent }]}>
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
            style={[styles.tr, { borderTopColor: theme.cardDivider }]}
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
  const theme = useSportTheme();
  return (
    <View style={[styles.tr, styles.th, { backgroundColor: theme.chip }]} importantForAccessibility="no-hide-descendants">
      <Text style={[type.label, styles.nameCell, { color: theme.muted }]}>{first}</Text>
      {cols.map((c, i) => (
        <Text key={c} style={[type.label, styles.cell, i === cols.length - 1 && styles.wide, { color: theme.muted }]}>
          {c.toUpperCase()}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1, minHeight: 52 },
  th: { borderTopWidth: 0, minHeight: 36 },
  nameCell: { flex: 1, paddingRight: space.xs },
  cell: { width: 34, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 14, fontVariant: ['tabular-nums'] },
  wide: { width: 46 },
  big: { fontFamily: fonts.display, fontSize: 20 },
  note: { paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1 },
  totals: { flexDirection: 'row', alignItems: 'center' },
  fow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fowChip: { borderRadius: radius.md, borderWidth: 1, paddingHorizontal: space.sm, paddingVertical: space.xs },
});
