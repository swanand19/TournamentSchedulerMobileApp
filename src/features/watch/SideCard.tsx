import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import type { WatchMarkKind, WatchPlayer, WatchSide } from '@/api/types';
import { Card } from '@/components/Card';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// One side on a team sheet: the squad before the start, the XI or starting line-up after, then
// the bench. Football rows carry what happened to the player (goal, cards, on or off); cricket
// rows the batting order and C / WK. A name opens that player's profile.

export default function SideCard({ side, sport }: { side: WatchSide; sport: 'football' | 'cricket' }) {
  const theme = useSportTheme();
  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={[styles.head, { borderBottomColor: theme.cardDivider }]}>
        <Text style={[type.heading, { color: theme.deep, flex: 1 }]} numberOfLines={2}>
          {side.name.toUpperCase()}
        </Text>
        <Text style={[type.label, { color: theme.muted }]}>{side.heading}</Text>
      </View>
      {side.players.length === 0 ? (
        <Text style={[type.body, styles.empty, { color: theme.muted }]}>{side.name} hasn&apos;t added players yet.</Text>
      ) : (
        side.players.map((p, i) => <PlayerRow key={p.playerId} player={p} sport={sport} index={i} />)
      )}
      {side.bench.length > 0 && (
        <>
          <View style={[styles.benchHead, { backgroundColor: theme.chip }]}>
            <Text style={[type.label, { color: theme.muted }]}>{sport === 'cricket' ? 'Also in the squad' : 'Bench'}</Text>
          </View>
          {side.bench.map((p, i) => (
            <PlayerRow key={p.playerId} player={p} sport={sport} index={i} bench />
          ))}
        </>
      )}
    </Card>
  );
}

function PlayerRow({ player, sport, index, bench }: { player: WatchPlayer; sport: 'football' | 'cricket'; index: number; bench?: boolean }) {
  const theme = useSportTheme();
  const router = useRouter();
  // Cricket numbers the XI by batting order; before the toss (no order yet) the shirt number shows.
  const number = sport === 'cricket' && player.battingOrder != null ? (bench ? null : player.battingOrder) : player.jerseyNumber;
  const tags = [player.isCaptain && 'C', player.isWicketKeeper && 'WK'].filter(Boolean) as string[];

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/profile', params: { playerId: String(player.playerId) } })}
      accessibilityRole="button"
      accessibilityLabel={`${player.name}${tags.length ? `, ${tags.map((t) => (t === 'C' ? 'captain' : 'wicketkeeper')).join(', ')}` : ''}${player.role ? `, ${player.role}` : ''}. Open profile`}
      style={[styles.row, index > 0 || bench ? { borderTopWidth: 1, borderTopColor: theme.cardDivider } : null]}
    >
      <Text style={[styles.number, { color: bench ? theme.muted : theme.deep }]}>{number ?? '–'}</Text>
      <View style={{ flex: 1 }}>
        <View style={styles.nameLine}>
          <Text style={[type.bodyStrong, { color: theme.ink, flexShrink: 1 }]} numberOfLines={1}>
            {player.name}
          </Text>
          {tags.map((t) => (
            <View key={t} style={[styles.tag, { backgroundColor: theme.tint }]}>
              <Text style={[styles.tagText, { color: theme.deep }]}>{t}</Text>
            </View>
          ))}
        </View>
        {player.role ? <Text style={[type.caption, { color: theme.muted }]}>{player.role}</Text> : null}
      </View>
      {player.marks.length > 0 && (
        <View style={styles.marks}>
          {player.marks.map((m, i) => (
            <Mark key={i} kind={m.kind} minute={m.minute} />
          ))}
        </View>
      )}
      <Icon name="chevron-right" size={18} color={theme.muted} />
    </PressableScale>
  );
}

function Mark({ kind, minute }: { kind: WatchMarkKind; minute: string }) {
  const theme = useSportTheme();
  const glyph =
    kind === 'Goal' ? <Icon name="soccer" size={14} color={theme.ink} />
    : kind === 'YellowCard' ? <View style={[styles.card, { backgroundColor: theme.yellowCard }]} />
    : kind === 'RedCard' ? <View style={[styles.card, { backgroundColor: theme.dangerSolid }]} />
    : kind === 'SubbedOn' ? <Icon name="arrow-up-bold" size={14} color={theme.successInk} />
    : <Icon name="arrow-down-bold" size={14} color={theme.muted} />;
  return (
    <View style={styles.mark}>
      {glyph}
      <Text style={[type.caption, { color: theme.muted }]}>{minute}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, paddingHorizontal: space.lg, borderBottomWidth: 1 },
  empty: { padding: space.lg },
  benchHead: { paddingHorizontal: space.lg, paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg, paddingVertical: space.sm },
  number: { width: 28, textAlign: 'center', fontFamily: fonts.display, fontSize: 20, fontVariant: ['tabular-nums'] },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tag: { borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 1 },
  tagText: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 15 },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, maxWidth: 140, justifyContent: 'flex-end' },
  mark: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  card: { width: 9, height: 13, borderRadius: 2 },
});
