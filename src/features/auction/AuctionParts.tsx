import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { api } from '@/api/client';
import type { AuctionLot, AuctionResult, AuctionState, AuctionTeam } from '@/api/types';
import Bump from '@/components/Bump';
import { Deck } from '@/components/Card';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useQuery } from '@/hooks/useQuery';
import { initials, parseUtc } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { CSS_EASE_OUT, dematerialize, EASE_OUT, materialize } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The pieces every auction screen shares — the auctioneer's console, a bidder's screen and the
// board everyone else watches all draw the same player, bid, clock and teams, so a glance at any
// phone in the hall reads the same.
//
// Motion (animate-expo rules; everything on the UI thread):
//  - The bid clock drains linearly to the server's deadline: constant motion, so `linear`, a
//    childless absolute fill scaled from its left edge. Under five seconds it turns amber (a colour
//    transition, 200ms). It's a progress indicator, so it keeps running under Reduce Motion.
//  - A new player under the hammer arrives from just below with a fade (260ms strong ease-out):
//    spatial consistency, "the next card was dealt". Reduce Motion: no entrance.
//  - The bid figure punches when it changes (Bump, 300ms) — a few dozen times a lot, so short.
//  - A team tile's highlight moves to the highest bidder with a 180ms colour transition.
//  - SOLD is the one delight moment: glass materializes with one soft overshoot, with a success
//    haptic for the team that bought (and the player bought), in the same frame. It leaves by
//    itself after a beat, or at a tap.

/** "1,250" — the same grouping the server writes in its messages. */
export function amount(n: number | null | undefined): string {
  if (n == null) return '—';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

type Timed = AuctionState & { clockOffset: number };

/** The server's clock minus the phone's, measured the moment an answer arrives: every countdown runs on the server's time. */
const timed = (state: AuctionState): Timed => ({ ...state, clockOffset: (parseUtc(state.serverNow)?.getTime() ?? Date.now()) - Date.now() });

/** The auction's state, live: reloaded on every nudge (a bid lands on other phones in well under a second). */
export function useAuction(tournamentId: number) {
  const fetcher = useCallback(
    async () => timed(await api.call<AuctionState>('AUCTION_GET', { routeParams: { id: tournamentId } })),
    [tournamentId],
  );
  const query = useQuery(fetcher, { pollMs: 3000, live: { kind: 'tournament', tournamentId }, bunchMs: 80 });
  const { setData } = query;
  const show = useCallback((state: AuctionState) => setData(timed(state)), [setData]);
  return { ...query, setData: show, offset: query.data?.clockOffset ?? 0 };
}

// -----------------------------------------------------------------
// The bid clock
// -----------------------------------------------------------------

type ClockProps = {
  closesAt: string | null;
  offset: number;
  /** The full length of this clock (first bid, or after a bid), for the bar. */
  totalSeconds: number;
  pausedSeconds?: number | null;
  clockOn: boolean;
};

export function BidClock({ closesAt, offset, totalSeconds, pausedSeconds, clockOn }: ClockProps) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const progress = useSharedValue(1);
  const end = closesAt ? (parseUtc(closesAt)?.getTime() ?? 0) - offset : null; // when it closes, on this phone's clock
  // The figure, for the deadline it was counted against (a new deadline starts blank for a frame).
  const [count, setCount] = useState<{ end: number; seconds: number } | null>(null);
  const seconds = end == null ? (pausedSeconds ?? null) : count?.end === end ? count.seconds : null;

  useEffect(() => {
    const total = Math.max(1, totalSeconds) * 1000;
    if (end == null) {
      cancelAnimation(progress);
      progress.set(pausedSeconds != null ? Math.min(1, (pausedSeconds * 1000) / total) : 1);
      return undefined;
    }
    const left = Math.max(0, end - Date.now());
    progress.set(Math.min(1, left / total));
    progress.set(withTiming(0, { duration: left, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));

    // The figure changes once a second; checking a few times a second keeps it on the beat.
    const tick = () => setCount({ end, seconds: Math.max(0, Math.ceil((end - Date.now()) / 1000)) });
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 200);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [end, totalSeconds, pausedSeconds, progress]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  if (!clockOn) {
    return (
      <View style={styles.clockRow}>
        <Icon name="gavel" size={18} color={theme.onDarkSoft} />
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>No clock: the auctioneer sells by hand</Text>
      </View>
    );
  }

  const low = seconds != null && seconds <= 5;
  const paused = closesAt == null && pausedSeconds != null;
  return (
    <View style={styles.clockRow} accessible accessibilityRole="timer" accessibilityLabel={paused ? `Paused, ${seconds} seconds left` : `${seconds ?? 0} seconds left`}>
      <View style={[styles.track, { backgroundColor: theme.chip }]}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: low ? theme.warnInk : theme.accent, transitionProperty: 'backgroundColor', transitionDuration: 200, transitionTimingFunction: CSS_EASE_OUT },
            fill,
          ]}
        />
      </View>
      <Text style={[styles.seconds, { color: low ? theme.warnInk : theme.onDark }]}>{paused ? 'II' : seconds == null ? '' : `${seconds}s`}</Text>
    </View>
  );
}

// -----------------------------------------------------------------
// The player under the hammer, and the bid
// -----------------------------------------------------------------

export function Avatar({ name, size = 48, tint }: { name: string; size?: number; tint?: boolean }) {
  const { fonts } = useTypography();
  const theme = useSportTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: tint ? theme.accentSoft : theme.glassFill,
        borderWidth: 1,
        borderColor: tint ? theme.accent : theme.glassBorder,
      }}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: size * 0.36, color: theme.onDark }}>{initials(name)}</Text>
    </View>
  );
}

/** The player's card. The parent keys it by lot, so each new player is dealt in. */
export function LotCard({ lot, unit, detail }: { lot: AuctionLot; unit: string; detail?: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const what = [lot.player.role, lot.player.tierName ? `tier ${lot.player.tierName}` : null].filter(Boolean).join(' · ');
  return (
    <Animated.View entering={FadeInDown.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}>
      <Deck accessibilityLabel={`${lot.player.name}${what ? `, ${what}` : ''}. Base price ${amount(lot.basePrice)} ${unit}`}>
        <View style={styles.lotRow}>
          <Avatar name={lot.player.name} size={56} tint={lot.player.isMe} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.headline, { color: theme.onDark }]} numberOfLines={1}>
              {lot.player.name}
              {lot.player.isMe ? ' (you)' : ''}
            </Text>
            {what ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{what}</Text> : null}
            {detail ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{detail}</Text> : null}
          </View>
          <View style={[styles.tag, { borderColor: theme.glassBorder }]}>
            <Text style={[type.label, { color: theme.onDark }]}>Base {amount(lot.basePrice)}</Text>
          </View>
        </View>
      </Deck>
    </Animated.View>
  );
}

/** The highest bid and whose it is, the figure punching as it changes. */
export function CurrentBid({ lot, unit, note }: { lot: AuctionLot; unit: string; note?: { text: string; tone: 'warn' | 'accent' } | null }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={{ gap: 2 }} accessible accessibilityLiveRegion="polite"
      accessibilityLabel={lot.currentBid == null ? `No bids yet. Opening bid ${amount(lot.basePrice)}` : `Highest bid ${amount(lot.currentBid)} ${unit}, ${lot.currentTeamName}`}>
      <Text style={[type.label, { color: theme.onDarkSoft }]}>{lot.currentBid == null ? 'No bids yet' : 'Highest bid'}</Text>
      <View style={styles.bidLine}>
        <Bump value={amount(lot.currentBid ?? lot.basePrice)} style={[styles.big, { color: lot.currentBid == null ? theme.onDarkSoft : theme.onDark }]} />
        <Text style={[type.lead, { color: theme.onDarkSoft }]}>{unit}</Text>
      </View>
      <View style={styles.bidMeta}>
        {lot.currentTeamName ? (
          <View style={[styles.teamTag, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Text style={[type.label, { color: theme.onDark }]}>{lot.currentTeamName}</Text>
          </View>
        ) : null}
        {note ? <Text style={[type.label, { color: note.tone === 'warn' ? theme.warnInk : theme.accent }]}>{note.text}</Text> : null}
      </View>
    </View>
  );
}

/** The last few bids, newest first. */
export function BidFeed({ lot }: { lot: AuctionLot }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  if (lot.bids.length === 0) return null;
  return (
    <Text style={[type.caption, { color: theme.onDarkSoft }]} accessibilityLabel={`Recent bids: ${lot.bids.map((b) => `${b.teamName} ${amount(b.amount)}`).join(', ')}`}>
      {lot.bids.map((b, i) => (
        <Text key={b.bidId} style={i === 0 ? { color: theme.onDark, fontWeight: undefined } : undefined}>
          {i > 0 ? ' · ' : ''}
          {b.teamName} {amount(b.amount)}
          {b.fromRoom ? ' (room)' : ''}
        </Text>
      ))}
    </Text>
  );
}

// -----------------------------------------------------------------
// Teams
// -----------------------------------------------------------------

/**
 * A team's tile: purse left and the most it can bid. On the console it's the "bid in the room"
 * button for that team; the highest bidder's tile lights in the sport's colour.
 */
export function TeamTile({ team, onPress, disabled, unit, label }: { team: AuctionTeam; onPress?: () => void; disabled?: boolean; unit: string; label?: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const body = (
    <Animated.View
      style={[
        styles.tile,
        {
          backgroundColor: team.isHighest ? theme.accentSoft : theme.cream,
          borderColor: team.isHighest ? theme.accent : theme.glassBorder,
          transitionProperty: ['backgroundColor', 'borderColor'],
          transitionDuration: 180,
          transitionTimingFunction: CSS_EASE_OUT,
        },
      ]}
    >
      <Text style={[type.bodyStrong, { color: theme.onDark }]} numberOfLines={1}>
        {team.name}
      </Text>
      <Text style={[type.caption, styles.num, { color: theme.onDarkSoft }]}>
        {amount(team.purseLeft)} {unit} left · {team.players} pl
      </Text>
      <Text style={[type.label, styles.num, { color: team.isHighest ? theme.accent : theme.extraInk }]} numberOfLines={1}>
        {team.isHighest ? 'Highest bid' : label ?? (team.isFull ? 'Squad full' : `Up to ${amount(team.maxBid)}`)}
      </Text>
    </Animated.View>
  );
  // The highest bidder can't bid again, but its tile is the one lit up, so it isn't a (dimmed) button.
  if (!onPress || team.isHighest) return <View style={{ flexBasis: '48%', flexGrow: 1 }} accessible accessibilityLabel={`${team.name}, ${amount(team.purseLeft)} ${unit} left${team.isHighest ? ', highest bid' : ''}`}>{body}</View>;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      style={{ flexBasis: '48%', flexGrow: 1 }}
      accessibilityRole="button"
      accessibilityLabel={`${team.name}, ${amount(team.purseLeft)} ${unit} left. ${team.isHighest ? 'Highest bid' : label ?? ''}`}
      accessibilityState={{ disabled: !!disabled }}
    >
      {body}
    </PressableScale>
  );
}

/** A team's squad and purse as a bar: "4 of 11–15 players". */
export function SquadBar({ team, min, max, unit }: { team: AuctionTeam; min: number; max: number; unit: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const share = Math.min(1, team.players / Math.max(1, max));
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.between}>
        <Text style={[type.bodyStrong, { color: theme.onDark }]}>{team.name}</Text>
        <Text style={[type.caption, styles.num, { color: theme.onDarkSoft }]}>
          {team.players} of {min === max ? max : `${min}–${max}`} players
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.chip }]}>
        <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: team.needs > 0 ? theme.accent : theme.success, transform: [] }]} />
      </View>
      <View style={styles.between}>
        <Text style={[type.body, styles.num, { color: theme.onDark }]}>
          {amount(team.purseLeft)} {unit} left
        </Text>
        <Text style={[type.caption, styles.num, { color: theme.onDarkSoft }]}>
          {team.isFull ? 'Squad full' : `You can bid up to ${amount(team.maxBid)}`}
        </Text>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------
// SOLD
// -----------------------------------------------------------------

/**
 * Watches the state for a sale (or an "unsold") as it lands and shows it for a moment on every
 * phone; and tells a bidder, with a buzz, when they've been outbid. Nothing on the first load.
 */
export function useAuctionMoments(state: AuctionState | undefined) {
  const [moment, setMoment] = useState<AuctionResult | null>(null);
  const lastSeen = useRef<number | null | undefined>(undefined);
  const wasHighest = useRef<{ lotId: number; highest: boolean } | null>(null);
  const myTeam = state?.me.bidderForTeamId ?? null;

  useEffect(() => {
    if (!state) return undefined;
    const last = state.last;
    const id = last?.lotId ?? null;
    if (lastSeen.current !== undefined && id !== null && id !== lastSeen.current) {
      setMoment(last);
      if (last && last.sold && ((myTeam != null && last.teamId === myTeam) || last.isMe)) haptic.success();
      else if (state.me.isAuctioneer) haptic.tap();
      AccessibilityInfo.announceForAccessibility(
        last!.sold ? `Sold: ${last!.playerName} to ${last!.teamName} for ${amount(last!.price)}` : `${last!.playerName} went unsold`,
      );
    }
    lastSeen.current = id;

    // Outbid: my team was highest on this player, and now someone else is.
    const lot = state.lot;
    if (lot && myTeam != null) {
      const highest = lot.currentTeamId === myTeam;
      if (wasHighest.current?.lotId === lot.lotId && wasHighest.current.highest && !highest && lot.currentTeamId != null) haptic.warn();
      wasHighest.current = { lotId: lot.lotId, highest };
    }
    return undefined;
  }, [state, myTeam]);

  // A beat to take it in, then out of the way.
  useEffect(() => {
    if (!moment) return undefined;
    const timer = setTimeout(() => setMoment(null), 2600);
    return () => clearTimeout(timer);
  }, [moment]);

  return { moment, dismiss: () => setMoment(null) };
}

export function SoldOverlay({ result, unit, myTeamId, teams, min, max, onDismiss }: {
  result: AuctionResult | null;
  unit: string;
  myTeamId: number | null;
  teams: AuctionTeam[];
  min: number;
  max: number;
  onDismiss: () => void;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  if (!result) return null;
  const team = teams.find((t) => t.teamId === result.teamId);
  const mine = myTeamId != null && result.teamId === myTeamId;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
      <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        entering={materialize}
        exiting={dematerialize}
        style={[styles.sold, { backgroundColor: theme.glassSolid, borderColor: theme.glassBorder, boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 80px ${theme.glow}` }]}
        accessibilityViewIsModal
      >
        <Icon name={result.sold ? 'gavel' : 'account-off-outline'} size={34} color={result.sold ? theme.accent : theme.warnInk} />
        <Text style={[type.bodyStrong, { color: result.sold ? theme.accent : theme.warnInk }]}>{result.sold ? 'Sold' : 'Unsold'}</Text>
        <Avatar name={result.playerName} size={64} tint={result.isMe} />
        <Text style={[type.title, { color: theme.onDark, textAlign: 'center' }]} numberOfLines={2}>
          {result.playerName}
        </Text>
        {result.sold ? (
          <>
            <Text style={[type.body, { color: theme.onDarkSoft }]}>
              to <Text style={{ color: theme.onDark }}>{result.teamName}</Text>
              {mine ? ', your team' : result.isMe ? ' — that’s you' : ''}
            </Text>
            <Text style={[styles.big, { color: theme.onDark }]}>
              {amount(result.price)} <Text style={[type.lead, { color: theme.onDarkSoft }]}>{unit}</Text>
            </Text>
            {team ? (
              <Text style={[type.caption, styles.num, { color: theme.onDarkSoft, textAlign: 'center' }]}>
                {team.name} now: {team.players} of {min === max ? max : `${min}–${max}`} players · {amount(team.purseLeft)} {unit} left
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[type.body, { color: theme.onDarkSoft, textAlign: 'center' }]}>Nobody bid. They can come back in a later round.</Text>
        )}
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ fonts, figures }: Typography) =>
  StyleSheet.create({
    clockRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 28 },
    track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: 4, transformOrigin: 'left' },
    seconds: { fontFamily: fonts.display, fontSize: 22, minWidth: 44, textAlign: 'right', fontVariant: figures },
    lotRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
    tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    bidLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
    big: { fontFamily: fonts.display, fontSize: 48, lineHeight: 56, letterSpacing: -1.2, fontVariant: figures },
    bidMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 26 },
    teamTag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
    tile: { borderRadius: 20, borderCurve: 'continuous', borderWidth: 1.5, padding: space.md, gap: 2, minHeight: 84 },
    num: { fontVariant: figures },
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    sold: {
      position: 'absolute',
      left: space.xl,
      right: space.xl,
      top: '18%',
      borderRadius: 36,
      borderCurve: 'continuous',
      borderWidth: 1,
      paddingVertical: space.xl + 4,
      paddingHorizontal: space.xl,
      alignItems: 'center',
      gap: space.md,
    },
  });
