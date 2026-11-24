import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { api } from '@/api/client';
import type { AuctionState, AuctionTeam } from '@/api/types';
import Button from '@/components/Button';
import { Card, Deck, Panel } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import LiveDot from '@/components/LiveDot';
import Screen from '@/components/Screen';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import { amount, BidClock, BidFeed, CurrentBid, LotCard, SquadBar, TeamTile } from '@/features/auction/AuctionParts';
import { BidderRow, BidderSheet } from '@/features/auction/AuctionSetup';
import { useAction } from '@/hooks/useAction';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// The auction while it runs, as each person needs it:
//  - the auctioneer's console: open the next player, record a bid heard in the room by tapping
//    the team, sell, mark unsold, undo, pause;
//  - a bidder's screen: one big "Bid 650" button showing the exact amount, the jumps, and what
//    their team can still afford;
//  - everyone else's board: the player, the bid, the clock and the teams.
// Every button comes from the server's `actions` and each team's `canBid`; the screen decides nothing.

type Props = {
  state: AuctionState;
  tournamentId: number;
  offset: number;
  onState: (s: AuctionState) => void;
};

const run = (id: number, service: Parameters<typeof api.call>[0], body?: object) =>
  api.call<AuctionState>(service, { routeParams: { id }, body: body ?? {} });

function StatusLine({ state }: { state: AuctionState }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const paused = state.status === 'Paused';
  const lot = state.lot;
  return (
    <View style={styles.between}>
      <View style={styles.inline}>
        {!paused && <LiveDot color={theme.accent} glow />}
        <Text style={[type.label, { color: paused ? theme.warnInk : theme.accent }]}>
          {paused ? 'Paused' : 'Live'}
          {state.round > 1 ? ` · round ${state.round}` : ''}
          {lot ? ` · player ${lot.number} of ${lot.ofTotal}` : ''}
        </Text>
      </View>
      <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
        {state.me.isAuctioneer ? "You're running it" : state.auctioneer ? `Run by ${state.auctioneer.name}` : ''}
      </Text>
    </View>
  );
}

function UpNext({ state, onPick }: { state: AuctionState; onPick?: (lotId: number) => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  if (state.upNext.length === 0) return null;
  return (
    <Panel>
      <Text style={[type.label, { color: theme.onDarkSoft }]}>Up next</Text>
      {state.upNext.map((u, i) => (
        <View key={u.lotId} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={[type.bodyStrong, { color: i === 0 ? theme.onDark : theme.onDarkSoft, flex: 1 }]} numberOfLines={1}>
            {u.name}
            <Text style={[type.caption, { color: theme.onDarkSoft }]}>
              {' '}
              {[u.role, u.tierName ? `tier ${u.tierName}` : null].filter(Boolean).join(' · ')}
            </Text>
          </Text>
          {onPick ? <Button label="Open" size="sm" variant="ghost" onPress={() => onPick(u.lotId)} /> : null}
        </View>
      ))}
    </Panel>
  );
}

/** Between players: who's next, and (for the auctioneer) the button that opens them. */
function Between({ state }: { state: AuctionState }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return (
    <Animated.View entering={FadeIn.duration(200).reduceMotion(ReduceMotion.System)}>
      <Deck>
        <Text style={[type.headline, { color: theme.onDark }]}>
          {state.me.isAuctioneer ? 'Ready for the next player' : 'Waiting for the next player'}
        </Text>
        <Text style={[type.body, { color: theme.onDarkSoft }]}>
          {state.counts.sold} sold · {state.counts.waiting} still to come this round
          {state.counts.unsold > 0 ? ` · ${state.counts.unsold} unsold so far` : ''}
        </Text>
      </Deck>
    </Animated.View>
  );
}

export function AuctionConsole({ state, tournamentId, offset, onState }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const [clockOpen, setClockOpen] = useState(false);
  const [bidderFor, setBidderFor] = useState<AuctionTeam | null>(null);
  const lot = state.lot;
  const a = state.actions;
  const unit = state.settings.unit;

  const act = async (service: Parameters<typeof api.call>[0], body?: object, buzz: () => void = haptic.tap) => {
    const res = await action.run(() => run(tournamentId, service, body));
    if (!res.ok) return false;
    buzz();
    onState(res.value);
    return true;
  };

  const roomBid = (teamId: number) => lot && act('AUCTION_BID', { teamId, amount: lot.nextBid });
  const undoSale = async () => {
    if (!state.last?.sold) return;
    const ok = await confirm({
      title: `Undo the sale of ${state.last.playerName}?`,
      message: `${state.last.teamName} get their ${amount(state.last.price)} ${unit} back, and ${state.last.playerName} goes back in line at the end of this round.`,
      confirmLabel: 'Undo sale',
    });
    if (ok) await act('AUCTION_UNDO_SALE', { lotId: state.last.lotId });
  };
  const finish = async () => {
    const ok = await confirm({
      title: 'End the auction now?',
      message: `${state.counts.waiting > 0 ? `The ${state.counts.waiting} players still to come aren't offered. ` : ''}Players left unsold can be assigned to teams by hand.`,
      confirmLabel: 'End auction',
    });
    if (ok) await act('AUCTION_FINISH', undefined, haptic.heavy);
  };
  const cancel = async () => {
    const ok = await confirm({
      title: 'Cancel the auction?',
      message: 'Every sale is undone and everyone goes back to the pool. The rules and bidders stay, so you can start again.',
      confirmLabel: 'Cancel auction',
      destructive: true,
    });
    if (ok) await act('AUCTION_CANCEL', undefined, haptic.heavy);
  };

  const footer = lot ? (
    <View style={styles.row}>
      <Button label="Unsold" variant="secondary" size="lg" onPress={() => act('AUCTION_UNSOLD')} disabled={!a.canMarkUnsold || action.busy} style={{ flex: 1 }} />
      <Button label="Undo" icon="undo" variant="secondary" size="lg" onPress={() => act('AUCTION_UNDO_BID')} disabled={!a.canUndoBid || action.busy} style={{ flex: 1 }} />
      <Button
        label={lot.currentBid != null ? `Sold · ${amount(lot.currentBid)}` : 'Sold'}
        icon="gavel"
        size="lg"
        onPress={() => act('AUCTION_SELL', undefined, haptic.success)}
        disabled={!a.canSell || action.busy}
        style={{ flex: 1.4 }}
      />
    </View>
  ) : (
    <Button
      label="Next player"
      icon="account-arrow-right"
      size="lg"
      onPress={() => act('AUCTION_NEXT', {})}
      disabled={!a.canOpenNext}
      busy={action.busy}
    />
  );

  return (
    <Screen footer={footer}>
      <StatusLine state={state} />
      <ErrorBanner message={clockOpen || bidderFor ? null : action.error?.message} />
      {lot ? (
        <>
          <LotCard key={lot.lotId} lot={lot} unit={unit} />
          <View style={{ gap: space.md }}>
            <CurrentBid lot={lot} unit={unit} />
            <BidClock
              closesAt={lot.closesAt}
              offset={offset}
              totalSeconds={lot.currentBid == null ? state.settings.firstBidSeconds : state.settings.nextBidSeconds}
              pausedSeconds={lot.secondsLeftWhenPaused}
              clockOn={state.settings.clockOn}
            />
            <BidFeed lot={lot} />
          </View>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>Bid in the room? Tap the team to record {amount(lot.nextBid)}</Text>
        </>
      ) : (
        <Between state={state} />
      )}

      <View style={styles.tiles}>
        {state.teams.map((team) => (
          <TeamTile
            key={team.teamId}
            team={team}
            unit={unit}
            onPress={lot ? () => roomBid(team.teamId) : undefined}
            disabled={!lot || !team.canBid || action.busy}
            label={lot && !team.canBid && !team.isHighest ? team.cantBidReason ?? undefined : undefined}
          />
        ))}
      </View>

      <UpNext state={state} onPick={!lot && a.canOpenNext ? (lotId) => act('AUCTION_NEXT', { lotId }) : undefined} />

      <Card>
        <View style={styles.row}>
          {a.canPause && <Button label="Pause" icon="pause" variant="secondary" onPress={() => act('AUCTION_PAUSE')} style={{ flex: 1 }} />}
          {a.canResume && <Button label="Resume" icon="play" onPress={() => act('AUCTION_RESUME')} style={{ flex: 1 }} />}
          {a.canEditClock && <Button label="Clock" icon="timer-outline" variant="secondary" onPress={() => setClockOpen(true)} style={{ flex: 1 }} />}
        </View>
        {state.status === 'Paused' && (
          <Text style={[type.caption, { color: theme.muted }]}>
            Paused: the clock has stopped and bidders can’t bid. You can still record a bid from the room, change the clock, or replace a
            bidder whose phone is down.
          </Text>
        )}
        {a.canSetBidders && state.teams.map((t) => <BidderRow key={t.teamId} team={t} onChange={() => setBidderFor(t)} />)}
        {state.last?.sold && a.canUndoSale && (
          <Button label={`Undo the sale of ${state.last.playerName}`} icon="undo-variant" variant="ghost" onPress={undoSale} />
        )}
        {a.canFinish && <Button label="End the auction" icon="flag-checkered" variant="ghost" onPress={finish} />}
        {a.canCancel && <Button label="Cancel the auction" icon="close-circle-outline" variant="ghost" onPress={cancel} />}
      </Card>

      {clockOpen && <ClockSheet state={state} tournamentId={tournamentId} onState={onState} onClose={() => setClockOpen(false)} />}
      {bidderFor && <BidderSheet team={bidderFor} tournamentId={tournamentId} onState={onState} onClose={() => setBidderFor(null)} />}
    </Screen>
  );
}

/** The bid clock, the one rule that may change while paused. */
function ClockSheet({ state, tournamentId, onState, onClose }: { state: AuctionState; tournamentId: number; onState: (s: AuctionState) => void; onClose: () => void }) {
  const action = useAction();
  const [on, setOn] = useState(state.settings.clockOn);
  const [first, setFirst] = useState(state.settings.firstBidSeconds);
  const [next, setNext] = useState(state.settings.nextBidSeconds);
  const save = async () => {
    const res = await action.run(() => run(tournamentId, 'AUCTION_SETTINGS', { clockOn: on, firstBidSeconds: first, nextBidSeconds: next }));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
    onClose();
  };
  return (
    <Sheet
      visible
      onClose={onClose}
      title="Bid clock"
      subtitle="Sells to the highest bid when it runs out"
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Save" icon="check" onPress={save} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <SwitchRow label="Bid clock on" hint="Off: you sell each player by hand" value={on} onChange={setOn} />
      {on && (
        <>
          <Stepper label="For the first bid" value={first} min={5} max={120} step={5} display={`${first} s`} onChange={setFirst} />
          <Stepper label="After each bid" hint="Resets, so nobody can snipe" value={next} min={3} max={60} display={`${next} s`} onChange={setNext} />
        </>
      )}
    </Sheet>
  );
}

export function AuctionBidder({ state, tournamentId, offset, onState }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const lot = state.lot;
  const unit = state.settings.unit;
  const mine = state.teams.find((t) => t.teamId === state.me.bidderForTeamId)!;
  const others = state.teams.filter((t) => t.teamId !== mine.teamId);
  const paused = state.status === 'Paused';

  const bid = async (amountToBid: number) => {
    const res = await action.run(() => run(tournamentId, 'AUCTION_BID', { teamId: mine.teamId, amount: amountToBid }));
    if (!res.ok) return;
    haptic.tap();
    onState(res.value);
  };

  const highest = lot?.currentTeamId === mine.teamId;
  const outbid = !!lot && !highest && lot.bids.some((b) => b.teamId === mine.teamId);
  const note = highest ? { text: "You're highest", tone: 'accent' as const } : outbid ? { text: "You've been outbid", tone: 'warn' as const } : null;
  const canBid = !!lot && mine.canBid && !paused;
  const bidLabel = !lot
    ? 'Waiting for the next player'
    : paused
      ? 'Paused'
      : highest
        ? "You're highest"
        : mine.canBid
          ? `Bid ${amount(lot.nextBid)}`
          : (mine.cantBidReason ?? "Can't bid");

  return (
    <Screen>
      <View style={styles.between}>
        <StatusLine state={state} />
      </View>
      <View style={[styles.badge, { borderColor: theme.accent, backgroundColor: theme.accentSoft }]}>
        <Text style={[type.label, { color: theme.onDark }]}>Bidding for {mine.name}</Text>
      </View>
      <ErrorBanner message={action.error?.message} />

      {lot ? (
        <>
          <LotCard key={lot.lotId} lot={lot} unit={unit} />
          <CurrentBid lot={lot} unit={unit} note={note} />
          <BidClock
            closesAt={lot.closesAt}
            offset={offset}
            totalSeconds={lot.currentBid == null ? state.settings.firstBidSeconds : state.settings.nextBidSeconds}
            pausedSeconds={lot.secondsLeftWhenPaused}
            clockOn={state.settings.clockOn}
          />
          <Button
            label={bidLabel}
            size="xl"
            display
            onPress={() => bid(lot.nextBid)}
            disabled={!canBid || action.busy}
            accessibilityHint={canBid ? `Bids ${amount(lot.nextBid)} ${unit} for ${mine.name}` : undefined}
          />
          {canBid && (
            <View style={styles.row}>
              <Button
                label={`+2 steps · ${amount(lot.twoStepsBid)}`}
                variant="secondary"
                onPress={() => bid(lot.twoStepsBid)}
                disabled={lot.twoStepsBid > mine.maxBid || action.busy}
                style={{ flex: 1 }}
              />
              <Button
                label={`+5 steps · ${amount(lot.fiveStepsBid)}`}
                variant="secondary"
                onPress={() => bid(lot.fiveStepsBid)}
                disabled={lot.fiveStepsBid > mine.maxBid || action.busy}
                style={{ flex: 1 }}
              />
            </View>
          )}
          <BidFeed lot={lot} />
        </>
      ) : (
        <>
          <Between state={state} />
          <UpNext state={state} />
        </>
      )}

      <Card>
        <SquadBar team={mine} min={state.settings.minSquad} max={state.settings.maxSquad} unit={unit} />
      </Card>
      <View style={styles.tiles}>
        {others.map((team) => (
          <TeamTile key={team.teamId} team={team} unit={unit} />
        ))}
      </View>
    </Screen>
  );
}

export function AuctionWatch({ state, tournamentId, offset, onState }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const action = useAction();
  const lot = state.lot;
  const unit = state.settings.unit;

  const takeOver = async () => {
    const ok = await confirm({
      title: 'Run the auction yourself?',
      message: `${state.auctioneer?.name ?? 'The auctioneer'} stops running it, and the console moves to your phone.`,
      confirmLabel: 'Take over',
    });
    if (!ok) return;
    const res = await action.run(() => run(tournamentId, 'AUCTION_TAKE_OVER'));
    if (res.ok) {
      haptic.success();
      onState(res.value);
    }
  };

  return (
    <Screen>
      <StatusLine state={state} />
      <ErrorBanner message={action.error?.message} />
      {state.me.poolPlayerId != null && (
        <Animated.View entering={FadeIn.duration(220).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
          <Card style={{ borderWidth: 1, borderColor: theme.accent }}>
            <Text style={[type.bodyStrong, { color: theme.ink }]}>
              {lot?.player.isMe ? "You're under the hammer" : "You're in the pool"}
            </Text>
            <Text style={[type.caption, { color: theme.muted }]}>We&apos;ll tell you which team buys you.</Text>
          </Card>
        </Animated.View>
      )}
      {lot ? (
        <>
          <LotCard key={lot.lotId} lot={lot} unit={unit} />
          <CurrentBid lot={lot} unit={unit} />
          <BidClock
            closesAt={lot.closesAt}
            offset={offset}
            totalSeconds={lot.currentBid == null ? state.settings.firstBidSeconds : state.settings.nextBidSeconds}
            pausedSeconds={lot.secondsLeftWhenPaused}
            clockOn={state.settings.clockOn}
          />
          <BidFeed lot={lot} />
        </>
      ) : (
        <>
          <Between state={state} />
          <UpNext state={state} />
        </>
      )}
      <View style={styles.tiles}>
        {state.teams.map((team) => (
          <TeamTile key={team.teamId} team={team} unit={unit} />
        ))}
      </View>
      {state.actions.canTakeOver && <Button label="Take over the auction" icon="account-switch-outline" variant="ghost" onPress={takeOver} busy={action.busy} />}
    </Screen>
  );
}

const makeStyles = (_: Typography) =>
  StyleSheet.create({
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    row: { flexDirection: 'row', gap: space.sm },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  });
