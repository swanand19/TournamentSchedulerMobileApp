import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { api } from '@/api/client';
import type { PlayerMatchLine, PlayerMatchLines } from '@/api/types';
import Button from '@/components/Button';
import { useQuery } from '@/hooks/useQuery';
import { EASE_OUT } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// What a leaderboard row unfolds into (2026-11-20, the user's stats idea): the player's own
// innings ("45* (32)") or spells ("4-0-28-2") in this tournament, or their goals and assists with
// the minute — one line a match, oldest first. Loaded only when the row is opened, one player at a
// time, so the Stats tab itself stays as light as it was.

export type LineKind = 'batting' | 'bowling' | 'goals' | 'assists';

const HEADING: Record<LineKind, string> = { batting: 'Innings', bowling: 'Spells', goals: 'Goals', assists: 'Assists' };
const NONE: Record<LineKind, string> = {
  batting: 'No innings yet.',
  bowling: 'No spells yet.',
  goals: 'No goals yet.',
  assists: 'No assists yet.',
};

export default function PlayerLines({ tournamentId, playerId, kinds }: { tournamentId: number; playerId: number; kinds: LineKind[] }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const fetcher = useCallback(
    () => api.call<PlayerMatchLines>('TOURNAMENT_PLAYER_LINES', { routeParams: { id: tournamentId, playerId } }),
    [tournamentId, playerId],
  );
  const { data, error, loading, reload } = useQuery(fetcher);

  return (
    <Animated.View
      entering={FadeIn.duration(200).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}
      style={[styles.box, { borderTopColor: theme.mode === 'light' ? theme.cardDivider : theme.borderOnDark }]}
    >
      {loading ? (
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>Loading…</Text>
      ) : error && !data ? (
        <View style={{ gap: space.xs, alignItems: 'flex-start' }}>
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>{error.message}</Text>
          <Button label="Try again" variant="ghost" onPress={reload} />
        </View>
      ) : data ? (
        kinds.map((kind) => (
          <View key={kind} style={{ gap: space.xs }}>
            {kinds.length > 1 ? <Text style={[type.label, { color: theme.onDarkSoft }]}>{HEADING[kind]}</Text> : null}
            {data[kind].length === 0 ? (
              <Text style={[type.caption, { color: theme.onDarkSoft }]}>{NONE[kind]}</Text>
            ) : (
              data[kind].map((line, i) => <Line key={`${line.matchId}-${i}`} line={line} />)
            )}
          </View>
        ))
      ) : null}
    </Animated.View>
  );
}

function Line({ line }: { line: PlayerMatchLine }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const sub = [line.detail, line.inPlay ? 'in play' : null].filter(Boolean).join(' · ');
  return (
    <View
      style={styles.line}
      accessible
      accessibilityLabel={`Match ${line.matchNumber}, against ${line.opponent}: ${line.value}${sub ? `, ${sub}` : ''}`}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[type.body, { color: theme.onDark }]} numberOfLines={1}>
          M{line.matchNumber} · vs {line.opponent}
        </Text>
        {sub ? (
          <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text style={[type.bodyStrong, styles.value, { color: theme.onDark }]}>{line.value}</Text>
    </View>
  );
}

const makeStyles = ({ figures }: Typography) =>
  StyleSheet.create({
    box: { gap: space.md, paddingTop: space.md, marginTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 36 },
    value: { fontVariant: figures },
  });
