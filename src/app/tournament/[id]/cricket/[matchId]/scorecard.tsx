import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketScorecard } from '@/api/types';
import { Deck } from '@/components/Card';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import Skeleton from '@/components/Skeleton';
import ScorecardBody from '@/features/cricket/ScorecardBody';
import { useQuery } from '@/hooks/useQuery';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// The scorecard, one innings at a time: batting, extras and total, fall of wickets, bowling.
// Built by the server from the ball-by-ball record; polled while open, so it follows a live match.

export default function ScorecardScreen() {
  const theme = useSportTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const fetcher = useCallback(() => api.call<CricketScorecard>('CRICKET_SCORECARD', { routeParams: { matchId } }), [matchId]);
  const card = useQuery(fetcher, { pollMs: 15000 });

  const c = card.data;
  if (!c) return <Screen error={card.error} onRetry={card.refresh}>{card.loading && <Skeleton rows={5} />}</Screen>;

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

      <ScorecardBody card={c} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
