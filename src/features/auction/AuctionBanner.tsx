import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { api } from '@/api/client';
import type { AuctionState, DrawState } from '@/api/types';
import Button from '@/components/Button';
import { Deck } from '@/components/Card';
import LiveDot from '@/components/LiveDot';
import { amount } from '@/features/auction/AuctionParts';
import { useQuery } from '@/hooks/useQuery';
import { EASE_OUT } from '@/lib/motion';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// On the hub of a tournament that hasn't started, for everyone but its owners (they have the
// checklist): the auction when there is one — live now (watch, or bid for your team), waiting to
// start with you in the pool, or finished. Nothing at all for a tournament without an auction.

export default function AuctionBanner({ tournamentId }: { tournamentId: number }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
  const fetcher = useCallback(() => api.call<AuctionState>('AUCTION_GET', { routeParams: { id: tournamentId } }), [tournamentId]);
  const q = useQuery(fetcher, { pollMs: 30000, live: { kind: 'tournament', tournamentId } });
  const s = q.data;
  if (!s || s.status === 'Confirmed') return null;
  if (s.method === 'Draw' && (s.status === 'None' || s.status === 'Setup')) return null;

  const live = s.status === 'Live' || s.status === 'Paused';
  const mine = s.teams.find((t) => t.teamId === s.me.bidderForTeamId);
  const inPool = s.me.poolPlayerId != null;
  if (!live && !inPool && !mine && (s.status === 'None' || s.status === 'Setup')) return null;

  const open = () => router.push({ pathname: '/tournament/[id]/auction', params: { id: String(tournamentId) } });
  const title = live
    ? s.status === 'Paused' ? 'The auction is paused' : 'The auction is live'
    : s.status === 'RoundOver' || s.status === 'Finished'
      ? 'The auction is nearly done'
      : 'There will be a player auction';
  const body = mine
    ? `You bid for ${mine.name}: ${amount(mine.purseLeft)} ${s.settings.unit} left, ${mine.players} of ${s.settings.minSquad}–${s.settings.maxSquad} players.`
    : inPool
      ? "You're in the player pool. Watch which team buys you."
      : `${s.counts.sold} sold so far.`;

  return (
    <Animated.View entering={FadeInDown.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
      <Deck style={{ borderWidth: 1, borderColor: live ? theme.accent : theme.glassBorder }}>
        <View style={styles.head}>
          {live && <LiveDot color={theme.accent} glow />}
          <Text style={[type.headline, { color: theme.onDark, flex: 1 }]}>{title}</Text>
        </View>
        <Text style={[type.body, { color: theme.onDarkSoft }]}>{body}</Text>
        <Button label={mine && live ? `Bid for ${mine.name}` : live ? 'Watch the auction' : 'Open'} icon="gavel" onPress={open} size={live ? 'lg' : 'md'} />
      </Deck>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center', gap: space.sm } });

/** The team draw, while it runs or waits to be confirmed: watch it, and see where you were drawn. */
export function DrawBanner({ tournamentId }: { tournamentId: number }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
  const fetcher = useCallback(() => api.call<DrawState>('DRAW_GET', { routeParams: { id: tournamentId } }), [tournamentId]);
  const q = useQuery(fetcher, { pollMs: 30000, live: { kind: 'tournament', tournamentId } });
  const s = q.data;
  if (!s || s.status === 'Confirmed') return null;
  const coming = s.status !== 'Live';
  // Before it starts: only for the players waiting in the pool of a tournament set to draw.
  if (coming && !(s.method === 'Draw' && s.me.poolPlayerId != null)) return null;

  const live = !coming && !s.allDrawn;
  const mine = s.teams.find((t) => t.teamId === s.me.drawnForTeamId);
  const open = () => router.push({ pathname: '/tournament/[id]/draw', params: { id: String(tournamentId) } });
  const body = coming
    ? "You're in the player pool. The teams will be drawn live; you'll get a notification when it starts."
    : mine
      ? `You were drawn for ${mine.name}.`
      : s.me.poolPlayerId != null
        ? "You're in the pool. Watch which team you're drawn for."
        : `${s.counts.drawn} of ${s.counts.players} drawn so far.`;

  return (
    <Animated.View entering={FadeInDown.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
      <Deck style={{ borderWidth: 1, borderColor: live ? theme.accent : theme.glassBorder }}>
        <View style={styles.head}>
          {live && <LiveDot color={theme.accent} glow />}
          <Text style={[type.headline, { color: theme.onDark, flex: 1 }]}>{coming ? 'There will be a team draw' : live ? 'The team draw is live' : 'The teams are drawn'}</Text>
        </View>
        <Text style={[type.body, { color: theme.onDarkSoft }]}>{body}</Text>
        <Button label={coming ? 'Open' : live ? 'Watch the draw' : 'See the teams'} icon="shuffle-variant" onPress={open} size={live ? 'lg' : 'md'} />
      </Deck>
    </Animated.View>
  );
}
