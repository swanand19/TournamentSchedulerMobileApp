import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { api } from '@/api/client';
import type { AuctionState, Pool, PoolMethod, PoolPlayer } from '@/api/types';
import Button from '@/components/Button';
import { Card, Panel } from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import ErrorBanner from '@/components/ErrorBanner';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import TextField from '@/components/TextField';
import { amount } from '@/features/auction/AuctionParts';
import { MoveSheet, PoolPlayerSheet, PoolRow, TierSheet } from '@/features/auction/PoolParts';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The player pool: everyone still to be placed in a team, grouped by tier. Owners add players (by
// email or number first, so accounts link), open registration by code so players add themselves,
// set the tiers and base prices, and press and hold to move several players to a tier at once.
// Everyone else sees the list (and their own place in it).

export default function PoolScreen() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const t = useTournament();
  const action = useAction();

  const poolFetcher = useCallback(() => api.call<Pool>('POOL_GET', { routeParams: { id: t.id } }), [t.id]);
  const pool = useQuery(poolFetcher, { pollMs: 15000, live: { kind: 'tournament', tournamentId: t.id } });
  const auctionFetcher = useCallback(() => api.call<AuctionState>('AUCTION_GET', { routeParams: { id: t.id } }), [t.id]);
  const auction = useQuery(auctionFetcher);

  const [editing, setEditing] = useState<{ player: PoolPlayer | null; key: number } | null>(null);
  const [tiersOpen, setTiersOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  const p = pool.data;
  const unit = auction.data?.settings.unit ?? 'pts';
  const started = !!auction.data && !['None', 'Setup'].includes(auction.data.status);
  const owner = t.access.canEdit;
  const drawing = p?.method === 'Draw';

  if (!p) return <Screen error={pool.error} onRetry={pool.refresh}><Skeleton rows={4} height={90} /></Screen>;

  const selecting = picked.size > 0;
  const toggle = (id: number) => {
    haptic.select();
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const setRegistration = async (open: boolean) => {
    const res = await action.run(() => api.call<Pool>('POOL_REGISTRATION', { routeParams: { id: t.id }, body: { open } }));
    if (!res.ok) return;
    haptic.success();
    pool.setData(res.value);
  };

  const shareCode = async () => {
    if (!p.joinCode) return;
    await Share.share({
      message: `Join the player pool for ${t.name}: open KickCricket, tap "Join a team" and enter ${p.joinCode}.`,
    }).catch(() => {});
  };

  const choose = async (method: PoolMethod) => {
    if (p?.method === method) return;
    haptic.select();
    const res = await action.run(() => api.call<Pool>('POOL_METHOD_SET', { routeParams: { id: t.id }, body: { method } }));
    if (!res.ok) return;
    pool.setData(res.value);
  };

  const openWay = () =>
    router.push({ pathname: drawing ? '/tournament/[id]/draw' : '/tournament/[id]/auction', params: { id: String(t.id) } });

  const move = async (tierId: number | null) => {
    const res = await action.run(() => api.call<Pool>('POOL_MOVE', { routeParams: { id: t.id }, body: { playerIds: [...picked], tierId } }));
    if (!res.ok) return;
    haptic.success();
    pool.setData(res.value);
    setPicked(new Set());
    setMoving(false);
  };

  const available = p.players.filter((x) => !x.isWithdrawn).length;

  // By tier, top first, then "No tier"; the search narrows every group.
  const q = search.trim().toLowerCase();
  const shown = p.players.filter((x) => !q || x.name.toLowerCase().includes(q) || (x.role ?? '').toLowerCase().includes(q));
  const none = shown.filter((x) => x.tierId == null);
  const groups = [
    ...p.tiers.map((tier) => ({ key: String(tier.id), title: tier.name, base: tier.basePrice as number | null, max: tier.maxPerTeam, players: shown.filter((x) => x.tierId === tier.id) })),
    ...(none.length > 0 ? [{ key: 'none', title: 'No tier', base: auction.data?.settings.noTierBasePrice ?? null, max: null, players: none }] : []),
  ].map((g) => (drawing ? { ...g, base: null, max: null } : g));

  return (
    <Screen
      onRefresh={pool.refresh}
      refreshing={pool.refreshing}
      footer={
        selecting ? (
          <View style={styles.footRow}>
            <Button label="Cancel" variant="secondary" size="lg" onPress={() => setPicked(new Set())} style={{ flex: 1 }} />
            <Button label={`Move ${picked.size} to a tier`} icon="swap-vertical" size="lg" onPress={() => setMoving(true)} style={{ flex: 2 }} />
          </View>
        ) : owner && p.canAdd ? (
          <View style={styles.footRow}>
            <Button label="Add player" icon="account-plus" variant="secondary" size="lg" onPress={() => setEditing({ player: null, key: Date.now() })} style={{ flex: 1 }} />
            <Button label={drawing ? 'Draw' : 'Auction'} icon={drawing ? 'shuffle-variant' : 'gavel'} size="lg" onPress={openWay} style={{ flex: 1 }} />
          </View>
        ) : undefined
      }
    >
      <SectionHeader eyebrow={t.name} title={plural(available, 'player')} large />
      <Text style={[type.body, { color: theme.onDarkSoft }]}>
        {p.keptPlayers > 0
          ? `Players already in a team (${p.keptPlayers}, such as the captains) aren't here. Everyone here is still to be placed.`
          : 'Everyone here is still to be placed in a team.'}
      </Text>
      <ErrorBanner message={editing || tiersOpen || moving ? null : action.error?.message} />

      {owner && p.canChooseMethod && (
        <Card>
          <Text style={[type.headline, { color: theme.ink }]}>How are the teams filled?</Text>
          {(
            [
              { key: 'Draw', icon: 'shuffle-variant', title: 'Draw', body: 'Names are drawn into the teams at random, tier by tier, with everyone watching.' },
              { key: 'Auction', icon: 'gavel', title: 'Auction', body: 'Each team buys players with a fixed purse; captains bid from their phones.' },
            ] as const
          ).map((o) => {
            const on = p.method === o.key;
            return (
              <PressableScale key={o.key} onPress={() => choose(o.key)} disabled={action.busy} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                <View style={[styles.way, { borderColor: on ? theme.accent : theme.cardDivider, backgroundColor: on ? theme.accentSoft : 'transparent' }]}>
                  <Icon name={o.icon} size={24} color={on ? theme.accent : theme.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[type.bodyStrong, { color: theme.ink }]}>{o.title}</Text>
                    <Text style={[type.caption, { color: theme.muted }]}>{o.body}</Text>
                  </View>
                  {on && <Icon name="check-circle" size={22} color={theme.accent} />}
                </View>
              </PressableScale>
            );
          })}
          <Text style={[type.caption, { color: theme.muted }]}>You can switch until it begins. Once the draw or the auction has started, it can&apos;t be changed.</Text>
        </Card>
      )}

      {owner && p.canAdd && (
        <Card>
          <View style={styles.between}>
            <Text style={[type.headline, { color: theme.ink }]}>Players can add themselves</Text>
            <StatusChip label={p.registrationOpen ? 'Open' : 'Closed'} tone={p.registrationOpen ? 'ready' : 'done'} />
          </View>
          {p.registrationOpen && p.joinCode ? (
            <>
              <Animated.Text entering={FadeIn.duration(220)} style={[styles.code, { color: theme.ink }]} accessibilityLabel={`Code ${p.joinCode.split('').join(' ')}`} selectable>
                {p.joinCode}
              </Animated.Text>
              <Text style={[type.caption, { color: theme.muted }]}>
                They enter it under “Join a team” and appear here marked “Joined by code”. Remove anyone who shouldn&apos;t be.
              </Text>
              <View style={styles.footRow}>
                <Button label="Share code" icon="share-variant" onPress={shareCode} style={{ flex: 1 }} />
                <Button label="Close" variant="secondary" onPress={() => setRegistration(false)} busy={action.busy} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <>
              <Text style={[type.body, { color: theme.muted }]}>
                Share one code in your group instead of typing every name. Each person registers with their own account.
              </Text>
              <Button label="Open registrations" icon="key-variant" variant="secondary" onPress={() => setRegistration(true)} busy={action.busy} />
            </>
          )}
        </Card>
      )}

      {p.tiers.length > 0 && (
        <View style={styles.tiles}>
          {p.tiers.map((tier) => (
            <View key={tier.id} style={[styles.tile, { backgroundColor: theme.surfaceOnDark, borderColor: theme.borderOnDark }]} accessible accessibilityLabel={`${tier.name}: ${tier.players} players`}>
              <Text style={[styles.tileNum, { color: theme.onDark }]}>{tier.players}</Text>
              <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
                {tier.name}
              </Text>
            </View>
          ))}
        </View>
      )}
      {owner && p.canEdit && (
        <Button label={drawing ? 'Tiers' : 'Tiers and base prices'} icon="tune-variant" variant="ghost" onPress={() => setTiersOpen(true)} />
      )}

      {p.players.length === 0 ? (
        <EmptyState
          icon="account-multiple-plus-outline"
          title="Nobody in the pool yet"
          message={owner ? 'Add players by email or number, or open registrations and share the code.' : 'The organisers are still adding players.'}
          actionLabel={owner && p.canAdd ? 'Add player' : undefined}
          onAction={owner && p.canAdd ? () => setEditing({ player: null, key: Date.now() }) : undefined}
        />
      ) : (
        <>
          <TextField label="Search players" value={search} onChangeText={setSearch} placeholder="Name or role" autoCorrect={false} />
          {groups.map((g) =>
            g.players.length === 0 ? null : (
              <Animated.View key={g.key} layout={LinearTransition.duration(220).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
                <Panel>
                  <View style={styles.between}>
                    <Text style={[type.headline, { color: theme.onDark }]}>
                      {g.title} · {g.players.length}
                    </Text>
                    {g.base != null && (
                      <Text style={[type.caption, { color: theme.onDarkSoft }]}>
                        Base {amount(g.base)} {unit}
                        {g.max ? ` · ${g.max} a team` : ''}
                      </Text>
                    )}
                  </View>
                  {g.players.map((x) => (
                    <PoolRow
                      key={x.id}
                      player={x}
                      unit={unit}
                      selecting={selecting}
                      selected={picked.has(x.id)}
                      onPress={owner ? () => (selecting ? toggle(x.id) : setEditing({ player: x, key: Date.now() })) : undefined}
                      onLongPress={owner && p.canEdit ? () => toggle(x.id) : undefined}
                    />
                  ))}
                </Panel>
              </Animated.View>
            ),
          )}
          {owner && p.canEdit && !selecting && (
            <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>
              Tap a player to change their tier or remove them. Press and hold to pick several.
            </Text>
          )}
        </>
      )}

      {editing && (
        <PoolPlayerSheet
          key={editing.key}
          visible
          onClose={() => setEditing(null)}
          onSaved={pool.setData}
          tournamentId={t.id}
          sport={t.sport}
          pool={p}
          player={editing.player}
          auctionStarted={started}
        />
      )}
      {tiersOpen && (
        <TierSheet visible onClose={() => setTiersOpen(false)} onSaved={pool.setData} tournamentId={t.id} tiers={p.tiers} unit={unit} prices={!drawing} />
      )}
      <MoveSheet visible={moving} onClose={() => setMoving(false)} onPick={move} tiers={p.tiers} count={picked.size} busy={action.busy} prices={!drawing} />
    </Screen>
  );
}

const makeStyles = ({ fonts, figures }: Typography) =>
  StyleSheet.create({
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    footRow: { flexDirection: 'row', gap: space.sm },
    code: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 6, fontVariant: figures },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    tile: { flexBasis: '22%', flexGrow: 1, borderRadius: radius.lg, borderWidth: 1, paddingVertical: space.md, alignItems: 'center', gap: 2 },
    tileNum: { fontFamily: fonts.display, fontSize: 24, fontVariant: figures },
    way: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, minHeight: 64 },
  });
