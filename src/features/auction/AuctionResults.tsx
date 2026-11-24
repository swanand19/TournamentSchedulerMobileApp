import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

import { api } from '@/api/client';
import type { AuctionFillPreview, AuctionSale, AuctionState, AuctionUnsold } from '@/api/types';
import Button from '@/components/Button';
import { Card, Deck, Panel } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import SegmentedControl from '@/components/SegmentedControl';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Sheet from '@/components/Sheet';
import TextField from '@/components/TextField';
import { amount, Avatar } from '@/features/auction/AuctionParts';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// After a round: the auctioneer chooses another round of the unsold (at the same or a lower base
// price — never higher, D-7) or the end. After the end: every team's squad and purse, teams short
// of their minimum first, the unsold players to assign by hand (a team that can't afford a player's
// price can't be picked at it; the price may be lowered to 0, never above the team's purse — D-8),
// or all at once by "Fill the gaps by draw" (the draw's dealing rule, to the teams short only),
// then "Confirm teams", which makes the squads. Everyone else sees the same results, read-only.

type Props = { state: AuctionState; tournamentId: number; tournamentName: string; onState: (s: AuctionState) => void };

const call = (id: number, service: Parameters<typeof api.call>[0], body?: object) =>
  api.call<AuctionState>(service, { routeParams: { id }, body: body ?? {} });

export function AuctionResults({ state, tournamentId, tournamentName, onState }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const [roundOpen, setRoundOpen] = useState(false);
  const [assigning, setAssigning] = useState<AuctionUnsold | null>(null);
  const [moving, setMoving] = useState<AuctionSale | null>(null);
  const [filling, setFilling] = useState(false);
  const a = state.actions;
  const unit = state.settings.unit;
  const sales = state.sales ?? [];
  const unsold = state.unsold ?? [];
  const top = [...sales].sort((x, y) => y.price - x.price)[0];
  const short = state.teams.filter((t) => t.needs > 0 && !t.isFull);
  const roundOver = state.status === 'RoundOver';
  const confirmed = state.status === 'Confirmed';

  const act = async (service: Parameters<typeof api.call>[0], body?: object) => {
    const res = await action.run(() => call(tournamentId, service, body));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
  };

  const finish = async () => {
    const ok = await confirm({
      title: 'End the auction?',
      message: `${plural(unsold.length, 'player')} stay unsold. You can then assign them to teams with room, by hand.`,
      confirmLabel: 'End auction',
    });
    if (ok) await act('AUCTION_FINISH');
  };

  const confirmTeams = async () => {
    const ok = await confirm({
      title: 'Confirm the teams?',
      message: `Every sale becomes a place in its team's squad${unsold.length ? `; ${plural(unsold.length, 'player')} left unsold get no team` : ''}. The auction can't be changed afterwards.`,
      confirmLabel: 'Confirm teams',
    });
    if (ok) await act('AUCTION_CONFIRM');
  };

  const undo = async (sale: AuctionSale) => {
    if (!a.canUndoSale) return;
    const team = state.teams.find((t) => t.teamId === sale.teamId);
    const ok = await confirm({
      title: `Undo ${sale.name}'s ${sale.assigned ? 'assignment' : 'sale'}?`,
      message: `${team?.name ?? 'The team'} get ${amount(sale.price)} ${unit} back, and ${sale.name} is unsold again.`,
      confirmLabel: 'Undo',
    });
    if (ok) await act('AUCTION_UNDO_SALE', { lotId: sale.lotId });
  };

  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel the auction?',
      message: 'Every sale is undone and everyone goes back to the pool. The rules and bidders stay, so you can start again. The bids are kept for the record.',
      confirmLabel: 'Cancel auction',
      destructive: true,
    });
    if (ok) await act('AUCTION_CANCEL');
  };

  const offerRoundFirst = state.settings.unsoldPlan === 'AnotherRound';
  const roundButtons = roundOver && (a.canStartRound || a.canFinish) && (
    <View style={{ gap: space.sm }}>
      {offerRoundFirst && a.canStartRound && <Button label="Another round for the unsold" icon="refresh" size="lg" onPress={() => setRoundOpen(true)} />}
      {a.canFinish && <Button label="End and assign by hand" icon="hand-pointing-right" variant={offerRoundFirst ? 'secondary' : 'primary'} size="lg" onPress={finish} busy={action.busy} />}
      {!offerRoundFirst && a.canStartRound && <Button label="Another round for the unsold" icon="refresh" variant="secondary" size="lg" onPress={() => setRoundOpen(true)} />}
    </View>
  );

  return (
    <Screen
      footer={
        roundButtons ||
        (state.status === 'Finished' && a.canConfirm ? (
          <Button label="Confirm teams" icon="check-decagram" size="lg" onPress={confirmTeams} busy={action.busy} />
        ) : undefined)
      }
    >
      <SectionHeader
        eyebrow={tournamentName}
        title={roundOver ? `Round ${state.round} is over` : confirmed ? 'Teams confirmed' : 'Auction finished'}
        large
      />
      <Text style={[type.body, { color: theme.onDarkSoft }]}>
        {plural(state.counts.sold, 'player')} sold, {state.counts.unsold} unsold.{' '}
        {roundOver
          ? state.me.isAuctioneer
            ? 'Give the unsold another round, or end the auction and assign them by hand.'
            : 'The auctioneer is deciding what happens to the unsold players.'
          : confirmed
            ? 'The squads are made: changes are now done on the teams, as usual.'
            : state.me.isAuctioneer
              ? 'Check the squads, then confirm the teams.'
              : 'The auctioneer is checking the squads before confirming the teams.'}
      </Text>
      <ErrorBanner message={roundOpen || assigning || moving || filling ? null : action.error?.message} />

      {top && (
        <Animated.View entering={FadeInDown.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
          <Deck>
            <View style={styles.line}>
              <Icon name="trophy" size={28} color={theme.warnInk} />
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: theme.onDarkSoft }]}>Most expensive</Text>
                <Text style={[type.bodyStrong, { color: theme.onDark }]}>
                  {top.name} · {amount(top.price)} {unit}
                </Text>
                <Text style={[type.caption, { color: theme.onDarkSoft }]}>
                  {[top.role, `to ${state.teams.find((t) => t.teamId === top.teamId)?.name ?? ''}`].filter(Boolean).join(', ')}
                </Text>
              </View>
            </View>
          </Deck>
        </Animated.View>
      )}

      {!roundOver && !confirmed && short.length > 0 && unsold.length > 0 && (
        <Card style={{ borderWidth: 1, borderColor: theme.warnInk }}>
          {short.map((t) => (
            <Text key={t.teamId} style={[type.bodyStrong, { color: theme.warnInk }]}>
              {t.name} need {plural(t.needs, 'more player')} · {amount(t.purseLeft)} {unit} left
            </Text>
          ))}
          <Text style={[type.caption, { color: theme.muted }]}>
            {a.canFill ? 'Draw the unsold players into these teams, or give them players one by one below.' : 'Give them unsold players below. A price can be lowered to fit what a team has left.'}
          </Text>
          {a.canFill && <Button label="Fill the gaps by draw" icon="shuffle-variant" variant="secondary" onPress={() => setFilling(true)} />}
        </Card>
      )}
      {a.confirmProblem && !(short.length > 0 && unsold.length > 0) && <Text style={[type.body, { color: theme.warnInk }]}>{a.confirmProblem}</Text>}

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>Purses</Text>
        {state.teams.map((t) => (
          <View key={t.teamId} style={styles.line}>
            <Text style={[type.bodyStrong, { color: theme.ink, flex: 1 }]}>{t.name}</Text>
            <Text style={[type.caption, styles.num, { color: t.needs > 0 ? theme.warnInk : theme.muted }]}>{plural(t.players, 'player')}</Text>
            <Text style={[type.caption, styles.num, { color: theme.muted, width: 92, textAlign: 'right' }]}>{amount(t.spent)} spent</Text>
            <Text style={[type.bodyStrong, styles.num, { color: theme.ink, width: 76, textAlign: 'right' }]}>{amount(t.purseLeft)} left</Text>
          </View>
        ))}
      </Card>

      {state.teams.map((t) => {
        const bought = sales.filter((s) => s.teamId === t.teamId);
        return (
          <Panel key={t.teamId}>
            <View style={styles.between}>
              <Text style={[type.headline, { color: theme.onDark }]}>
                {t.name} · {t.players}
              </Text>
              <Text style={[type.caption, styles.num, { color: theme.onDarkSoft }]}>
                {amount(t.spent)} of {amount(state.settings.purse)}
              </Text>
            </View>
            {bought.length === 0 ? (
              <Text style={[type.caption, { color: theme.onDarkSoft }]}>Nobody bought yet{t.players > 0 ? ' — only the players already in the team' : ''}.</Text>
            ) : (
              bought.map((s) => (
                <PressableScale
                  key={s.lotId}
                  onPress={a.canMoveSales ? () => setMoving(s) : a.canUndoSale ? () => undo(s) : undefined}
                  disabled={!a.canUndoSale && !a.canMoveSales}
                  accessibilityRole={a.canUndoSale || a.canMoveSales ? 'button' : undefined}
                  accessibilityLabel={`${s.name}, ${amount(s.price)} ${unit}${a.canMoveSales ? '. Move, swap or undo' : a.canUndoSale ? '. Tap to undo' : ''}`}
                >
                  <View style={styles.line}>
                    <Avatar name={s.name} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.bodyStrong, { color: theme.onDark }]} numberOfLines={1}>
                        {s.name}
                      </Text>
                      <Text style={[type.caption, { color: s.movedFromTeamName ? theme.warnInk : theme.onDarkSoft }]}>
                        {s.movedFromTeamName
                          ? `Moved from ${s.movedFromTeamName}`
                          : [s.role, s.tierName, s.byDraw ? 'drawn' : s.assigned ? 'assigned' : s.round > 1 ? `round ${s.round}` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={[type.figure, { color: theme.onDark }]}>{amount(s.price)}</Text>
                  </View>
                </PressableScale>
              ))
            )}
          </Panel>
        );
      })}

      {unsold.length > 0 && (
        <Card>
          <Text style={[type.headline, { color: theme.ink }]}>Unsold · {unsold.length}</Text>
          {unsold.map((u) => (
            <View key={u.poolPlayerId} style={styles.line}>
              <Avatar name={u.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: theme.ink }]}>{u.name}</Text>
                <Text style={[type.caption, { color: theme.muted }]}>
                  {[u.role, u.tierName ? `tier ${u.tierName}` : null, `base ${amount(u.basePrice)}`].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {a.canAssign && <Button label="Assign" size="sm" variant="secondary" onPress={() => setAssigning(u)} />}
            </View>
          ))}
        </Card>
      )}

      {a.canCancel && <Button label="Cancel the auction" icon="close-circle-outline" variant="ghost" onPress={cancel} />}

      {roundOpen && <RoundSheet state={state} tournamentId={tournamentId} onState={onState} onClose={() => setRoundOpen(false)} />}
      {moving && (
        <SaleSheet
          state={state}
          sale={moving}
          tournamentId={tournamentId}
          onState={onState}
          onUndo={() => {
            setMoving(null);
            void undo(moving);
          }}
          onClose={() => setMoving(null)}
        />
      )}
      {filling && <FillSheet state={state} tournamentId={tournamentId} onState={onState} onClose={() => setFilling(false)} />}
      {assigning && <AssignSheet state={state} player={assigning} tournamentId={tournamentId} onState={onState} onClose={() => setAssigning(null)} />}
    </Screen>
  );
}

/**
 * "Fill the gaps by draw" (plan 9.7): the server's preview first — how many each short team gets,
 * at what prices, who stays unsold — then the fill, which draws who goes where.
 */
function FillSheet({ state, tournamentId, onState, onClose }: { state: AuctionState; tournamentId: number; onState: (s: AuctionState) => void; onClose: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const fetcher = useCallback(() => api.call<AuctionFillPreview>('AUCTION_FILL_PREVIEW', { routeParams: { id: tournamentId } }), [tournamentId]);
  const preview = useQuery(fetcher);
  const p = preview.data;

  const fill = async () => {
    const res = await action.run(() => call(tournamentId, 'AUCTION_FILL'));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Fill the gaps by draw"
      subtitle={`To teams short of ${state.settings.minSquad}`}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Draw them in" icon="shuffle-variant" onPress={fill} busy={action.busy} disabled={!p || p.teams.every((t) => t.gets === 0)} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message ?? preview.error?.message} />
      {p ? (
        <>
          <Text style={[type.bodyStrong, { color: theme.ink }]}>{p.line}</Text>
          {p.teams.map((t) => (
            <View key={t.teamId} style={styles.line}>
              <Text style={[type.bodyStrong, { color: theme.ink, flex: 1 }]}>{t.name}</Text>
              <Text style={[type.caption, styles.num, { color: theme.muted }]}>
                {t.has} → {t.has + t.gets}
              </Text>
              <Text style={[type.bodyStrong, styles.num, { color: t.gets > 0 ? theme.accent : theme.muted, width: 64, textAlign: 'right' }]}>
                {t.gets > 0 ? `+${t.gets}` : 'none'}
              </Text>
            </View>
          ))}
          <Text style={[type.caption, { color: theme.muted }]}>{p.note}</Text>
        </>
      ) : (
        !preview.error && <Text style={[type.caption, { color: theme.muted }]}>Working it out…</Text>
      )}
    </Sheet>
  );
}

/** The next round's base price per tier: the same as before or lower. */
function RoundSheet({ state, tournamentId, onState, onClose }: { state: AuctionState; tournamentId: number; onState: (s: AuctionState) => void; onClose: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const unsold = state.unsold ?? [];
  const groups = [...new Map(unsold.map((u) => [u.tierId ?? 0, u])).values()].map((u) => ({
    tierId: u.tierId,
    name: u.tierName ?? 'No tier',
    count: unsold.filter((x) => (x.tierId ?? 0) === (u.tierId ?? 0)).length,
    was: Math.max(...unsold.filter((x) => (x.tierId ?? 0) === (u.tierId ?? 0)).map((x) => x.basePrice)),
  }));
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((g) => [String(g.tierId ?? 0), String(g.was)])));
  const tooHigh = groups.some((g) => Number(prices[String(g.tierId ?? 0)] || 0) > g.was);

  const start = async () => {
    const body = { prices: groups.map((g) => ({ tierId: g.tierId, price: Number(prices[String(g.tierId ?? 0)] || 0) })) };
    const res = await action.run(() => call(tournamentId, 'AUCTION_ROUND_START', body));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Round ${state.round + 1}`}
      subtitle={`${plural(unsold.length, 'unsold player')}, offered once more`}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Start the round" icon="play" onPress={start} busy={action.busy} disabled={tooHigh} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <Text style={[type.body, { color: theme.muted }]}>
        Keep each base price or lower it so a team is more likely to buy. It can&apos;t go higher: nobody paid it last time.
      </Text>
      {groups.map((g) => {
        const key = String(g.tierId ?? 0);
        const value = Number(prices[key] || 0);
        return (
          <TextField
            key={key}
            label={`${g.name} · ${plural(g.count, 'player')} · was ${amount(g.was)}`}
            value={prices[key]}
            onChangeText={(v) => setPrices({ ...prices, [key]: v.replace(/[^0-9]/g, '') })}
            keyboardType="number-pad"
            maxLength={9}
            error={value > g.was ? `At most ${amount(g.was)}` : undefined}
          />
        );
      })}
    </Sheet>
  );
}

/** Giving an unsold player to a team with room, at their base price or lower — never more than the team has left. */
function AssignSheet({ state, player, tournamentId, onState, onClose }: { state: AuctionState; player: AuctionUnsold; tournamentId: number; onState: (s: AuctionState) => void; onClose: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const unit = state.settings.unit;
  // Teams short of their minimum first.
  const teams = [...state.teams].sort((x, y) => Number(y.needs > 0) - Number(x.needs > 0) || y.purseLeft - x.purseLeft);
  const [teamId, setTeamId] = useState<number | null>(teams.find((t) => !t.isFull && t.purseLeft >= player.basePrice)?.teamId ?? null);
  const [price, setPrice] = useState(String(player.basePrice));
  const team = state.teams.find((t) => t.teamId === teamId);
  const value = Number(price || 0);
  const tooMuch = value > player.basePrice ? `At most the base price, ${amount(player.basePrice)}` : team && value > team.purseLeft ? `${team.name} has ${amount(team.purseLeft)} ${unit} left` : undefined;

  const assign = async () => {
    if (teamId == null) return;
    const res = await action.run(() => call(tournamentId, 'AUCTION_ASSIGN', { poolPlayerId: player.poolPlayerId, teamId, price: value }));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
    onClose();
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Assign ${player.name}`}
      subtitle={`Base ${amount(player.basePrice)} ${unit}`}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label={team ? `Give to ${team.name}` : 'Pick a team'} icon="check" onPress={assign} busy={action.busy} disabled={!team || !!tooMuch} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      {teams.map((t) => {
        const cant = t.isFull ? 'Squad full' : t.purseLeft < value ? `${amount(t.purseLeft)} ${unit} left: lower the price` : null;
        const chosen = t.teamId === teamId;
        return (
          <PressableScale
            key={t.teamId}
            onPress={() => {
              haptic.select();
              setTeamId(t.teamId);
              if (t.purseLeft < value) setPrice(String(Math.max(0, Math.min(player.basePrice, t.purseLeft))));
            }}
            disabled={t.isFull}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen, disabled: t.isFull }}
          >
            <View style={[styles.choice, { borderColor: chosen ? theme.accent : theme.cardDivider, backgroundColor: chosen ? theme.accentSoft : 'transparent', opacity: t.isFull ? 0.5 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: theme.ink }]}>{t.name}</Text>
                <Text style={[type.caption, { color: cant ? theme.warnInk : theme.muted }]}>
                  {cant ?? `${amount(t.purseLeft)} ${unit} left · ${t.needs > 0 ? `needs ${t.needs}` : `${t.players} players`}`}
                </Text>
              </View>
              {chosen && <Icon name="check-circle" size={22} color={theme.accent} />}
            </View>
          </PressableScale>
        );
      })}
      <TextField
        label={`Price (${unit})`}
        value={price}
        onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={9}
        error={tooMuch}
        hint="Their base price, or lower down to 0 so the team can afford them."
      />
    </Sheet>
  );
}

/**
 * A bought player after the auction (E-4): move them to another team (their price goes with them,
 * or less to fit the new team's purse), swap them with a player of another team (both keep their
 * prices), or undo the sale.
 */
function SaleSheet({ state, sale, tournamentId, onState, onUndo, onClose }: {
  state: AuctionState;
  sale: AuctionSale;
  tournamentId: number;
  onState: (s: AuctionState) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const unit = state.settings.unit;
  const [mode, setMode] = useState<'move' | 'swap'>('move');
  const [teamId, setTeamId] = useState<number | null>(null);
  const [otherLot, setOtherLot] = useState<number | null>(null);
  const [price, setPrice] = useState(String(sale.price));
  const from = state.teams.find((t) => t.teamId === sale.teamId);
  const others = state.teams.filter((t) => t.teamId !== sale.teamId);
  const team = others.find((t) => t.teamId === teamId);
  const value = Number(price || 0);
  const other = (state.sales ?? []).find((x) => x.lotId === otherLot);
  const tooMuch = value > sale.price ? `At most what they went for, ${amount(sale.price)}` : team && value > team.purseLeft ? `${team.name} has ${amount(team.purseLeft)} ${unit} left` : undefined;

  const save = async () => {
    const res = await action.run(() =>
      mode === 'move'
        ? call(tournamentId, 'AUCTION_MOVE', { lotId: sale.lotId, teamId, price: value })
        : call(tournamentId, 'AUCTION_SWAP', { lotId: sale.lotId, otherLotId: otherLot }),
    );
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
    onClose();
  };

  const choice = (key: string, on: boolean, onPress: () => void, title: string, detail: string, warn?: boolean, disabled?: boolean) => (
    <PressableScale key={key} onPress={() => { haptic.select(); onPress(); }} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !!disabled }}>
      <View style={[styles.choice, { borderColor: on ? theme.accent : theme.cardDivider, backgroundColor: on ? theme.accentSoft : 'transparent', opacity: disabled ? 0.5 : 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: theme.ink }]}>{title}</Text>
          <Text style={[type.caption, { color: warn ? theme.warnInk : theme.muted }]}>{detail}</Text>
        </View>
        {on && <Icon name="check-circle" size={22} color={theme.accent} />}
      </View>
    </PressableScale>
  );

  return (
    <Sheet
      visible
      onClose={onClose}
      title={sale.name}
      subtitle={`${from?.name ?? ''} · ${amount(sale.price)} ${unit}`}
      footer={
        <>
          <Button label="Undo sale" variant="secondary" onPress={onUndo} style={{ flex: 1 }} />
          <Button
            label={mode === 'move' ? (team ? `Move to ${team.name}` : 'Pick a team') : other ? `Swap with ${other.name}` : 'Pick a player'}
            icon={mode === 'move' ? 'arrow-right' : 'swap-horizontal'}
            onPress={save}
            busy={action.busy}
            disabled={mode === 'move' ? !team || !!tooMuch : !other}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <SegmentedControl
        segments={[{ key: 'move', label: 'Move to' }, { key: 'swap', label: 'Swap with' }]}
        value={mode}
        onChange={setMode}
        accessibilityLabel="Move or swap"
      />
      {mode === 'move' ? (
        <>
          {others.map((t) =>
            choice(
              `t${t.teamId}`,
              t.teamId === teamId,
              () => {
                setTeamId(t.teamId);
                if (t.purseLeft < value) setPrice(String(Math.max(0, Math.min(sale.price, t.purseLeft))));
              },
              t.name,
              t.isFull ? 'Squad full' : `${amount(t.purseLeft)} ${unit} left · ${t.players} players`,
              t.purseLeft < sale.price,
              t.isFull,
            ),
          )}
          <TextField
            label={`They pay (${unit})`}
            value={price}
            onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={9}
            error={tooMuch}
            hint={`${from?.name ?? 'The team'} get it back. Lower it, down to 0, if the new team can't afford it.`}
          />
        </>
      ) : (
        (state.sales ?? [])
          .filter((x) => x.teamId !== sale.teamId)
          .map((x) =>
            choice(`s${x.lotId}`, x.lotId === otherLot, () => setOtherLot(x.lotId), x.name, `${state.teams.find((t) => t.teamId === x.teamId)?.name ?? ''} · ${amount(x.price)} ${unit}`),
          )
      )}
    </Sheet>
  );
}

const makeStyles = ({ figures }: Typography) =>
  StyleSheet.create({
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
    num: { fontVariant: figures },
    choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1.5, borderRadius: radius.lg, padding: space.md, minHeight: 56 },
  });
