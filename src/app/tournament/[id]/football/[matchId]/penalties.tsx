import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { api } from '@/api/client';
import type { FootballMatch, PenaltyState } from '@/api/types';
import Bump from '@/components/Bump';
import Button from '@/components/Button';
import { Card, Deck } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PlayerGrid from '@/components/PlayerGrid';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Sheet from '@/components/Sheet';
import Skeleton from '@/components/Skeleton';
import { playerIndex } from '@/features/football/useFootballMatch';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// The shootout: whose kick it is, who's taking it, and two big buttons — SCORED or MISSED. The
// server decides when it's over (and whether it's gone to sudden death); this screen draws the
// tally and, when there's a winner, the result.

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
/** A kick's dot landing: the one piece of motion per kick, so the tally visibly moved. */
const POP = { from: { transform: [{ scale: 1.3 }], opacity: 0.4 }, to: { transform: [{ scale: 1 }], opacity: 1 } };
/** The result arriving. Rare — the delight budget lives here — but still short and settled. */
const ARRIVE = {
  from: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.96 }] },
  to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
};

type Data = { match: FootballMatch; pens: PenaltyState };

export default function PenaltiesScreen() {
  const router = useRouter();
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { id: tournamentId } = useTournament();
  const action = useAction();

  const fetcher = useCallback(async (): Promise<Data> => {
    const [match, pens] = await Promise.all([
      api.call<FootballMatch>('MATCH_GET', { routeParams: { matchId } }),
      api.call<PenaltyState>('MATCH_PENALTIES_GET', { routeParams: { matchId } }),
    ]);
    return { match, pens };
  }, [matchId]);
  const data = useQuery(fetcher, { pollMs: 5000 });

  const [taker, setTaker] = useState<number | null | undefined>(undefined);
  const [chosenTeam, setChosenTeam] = useState<number | null>(null);
  const [endOpen, setEndOpen] = useState({ open: false, key: 0 });
  const [kicksAtOpen, setKicksAtOpen] = useState<number | null>(null);

  const d = data.data;
  if (d && kicksAtOpen === null) setKicksAtOpen(d.pens.kicks.length);

  if (!d) return <Screen error={data.error} onRetry={data.refresh}>{data.loading && <Skeleton rows={3} height={160} />}</Screen>;

  const { match, pens } = d;
  const players = playerIndex(match);
  const finished = pens.outcome !== 'InProgress' || match.status === 'Completed';
  const takers = pens.penaltyTakersPerSide ?? 5;
  const kickingTeam = chosenTeam ?? pens.nextTeamId ?? match.homeTeamId;
  const kickingName = kickingTeam === match.homeTeamId ? match.homeTeamName : match.awayTeamName;
  const available = kickingTeam === match.homeTeamId ? pens.homeAvailableTakerIds : pens.awayAvailableTakerIds;
  const suddenDeath = pens.kicks.some((k) => k.isSuddenDeath);
  const winnerId = pens.penaltyWinnerTeamId ?? match.penaltyWinnerTeamId;
  const winnerName = winnerId === match.homeTeamId ? match.homeTeamName : match.awayTeamName;
  const aet = match.currentHalf > 2;

  const kick = async (scored: boolean) => {
    if (!taker || !kickingTeam) return;
    const res = await action.run(() =>
      api.call('MATCH_PENALTY_KICK', { routeParams: { matchId }, body: { teamId: kickingTeam, playerId: taker, scored } }),
    );
    if (res.ok) {
      if (scored) haptic.success();
      else haptic.heavy();
      setTaker(undefined);
      setChosenTeam(null);
      data.reload();
    }
  };

  const declare = async (teamId: number | null, name: string) => {
    if (!teamId) return;
    const ok = await confirm({
      title: `Declare ${name} the winner?`,
      message: 'Ends the shootout now, as it stands. Use this only to correct or override the record.',
      confirmLabel: 'Declare winner',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call('MATCH_PENALTIES_END', { routeParams: { matchId }, body: { winningTeamId: teamId } }));
    if (res.ok) {
      haptic.success();
      setEndOpen((s) => ({ ...s, open: false }));
      data.reload();
    }
  };

  const footer = finished ? (
    <Button label="Back to matches" icon="arrow-left" size="lg" variant="deck" onPress={() => router.dismissTo({ pathname: '/tournament/[id]', params: { id: String(tournamentId) } })} />
  ) : (
    <View style={styles.row}>
      <Button label="Scored" icon="soccer" variant="success" size="xl" display disabled={!taker} busy={action.busy} onPress={() => kick(true)} style={{ flex: 1 }} />
      <Button label="Missed" icon="close-thick" variant="danger" size="xl" display disabled={!taker} busy={action.busy} onPress={() => kick(false)} style={{ flex: 1 }} />
    </View>
  );

  return (
    <Screen footer={footer} onRefresh={data.refresh} refreshing={data.refreshing} error={action.error ?? data.error} onRetry={data.refresh}>
      <Deck>
        <View style={styles.headRow}>
          <Text style={[type.board, { color: theme.accent, flex: 1 }]}>{suddenDeath ? 'SUDDEN DEATH' : 'PENALTY SHOOTOUT'}</Text>
          <Text style={[type.label, { color: theme.onDarkSoft }]}>
            FT {match.homeScore}–{match.awayScore}
            {aet ? ' (AET)' : ''}
          </Text>
        </View>
        <View style={styles.board} accessible accessibilityLiveRegion="polite" accessibilityLabel={`Penalties: ${match.homeTeamName} ${pens.homeScore}, ${match.awayTeamName} ${pens.awayScore}`}>
          <Text style={[styles.team, { color: theme.onDark }]} numberOfLines={2}>
            {match.homeTeamName.toUpperCase()}
          </Text>
          <View style={[styles.score, { backgroundColor: theme.page }]}>
            <Bump value={pens.homeScore} style={[type.scoreLarge, { color: theme.accent }]} />
            <Text style={[type.score, { color: theme.onDarkSoft }]}>:</Text>
            <Bump value={pens.awayScore} style={[type.scoreLarge, { color: theme.onDark }]} />
          </View>
          <Text style={[styles.team, { color: theme.onDark, textAlign: 'right' }]} numberOfLines={2}>
            {match.awayTeamName.toUpperCase()}
          </Text>
        </View>
      </Deck>

      {finished ? (
        <Animated.View
          style={!reduced ? { animationName: ARRIVE, animationDuration: 400, animationTimingFunction: EASE_OUT } : undefined}
        >
          <Card style={{ alignItems: 'center' }}>
            <Icon name="trophy" size={48} color={theme.warnInk} />
            <Text style={[type.title, { color: theme.ink, textAlign: 'center' }]} accessibilityRole="header">
              {winnerName.toUpperCase()} WIN {Math.max(pens.homeScore, pens.awayScore)}–{Math.min(pens.homeScore, pens.awayScore)} ON PENALTIES
            </Text>
            <Text style={[type.body, { color: theme.muted, textAlign: 'center' }]}>
              {aet ? 'After extra time' : 'After full time'} {match.homeScore}–{match.awayScore}
              {suddenDeath ? ' · settled in sudden death' : ''}
            </Text>
          </Card>
        </Animated.View>
      ) : (
        <View style={[styles.toKick, { backgroundColor: theme.accent }]} accessibilityRole="alert">
          <Icon name="lightning-bolt" size={28} color={theme.accentInk} />
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: theme.accentInk }]}>{kickingName.toUpperCase()} TO KICK</Text>
            <Text style={[type.caption, { color: theme.accentInk }]}>
              {suddenDeath ? 'Sudden death — one kick each until someone misses' : `Best of ${takers} each`}
            </Text>
          </View>
        </View>
      )}

      {[
        { id: match.homeTeamId, name: match.homeTeamName },
        { id: match.awayTeamId, name: match.awayTeamName },
      ].map((t) => {
        const kicks = pens.kicks.filter((k) => k.teamId === t.id);
        const regular = kicks.filter((k) => !k.isSuddenDeath);
        const sd = kicks.filter((k) => k.isSuddenDeath);
        const slots = [...regular, ...Array(Math.max(0, takers - regular.length)).fill(null), ...sd] as (typeof kicks[number] | null)[];
        return (
          <Deck key={t.id ?? t.name} style={{ gap: space.sm }}>
            <View style={styles.headRow}>
              <Text style={[type.lead, { color: theme.onDark, flex: 1 }]}>{t.name}</Text>
              <Text style={[type.label, { color: theme.onDarkSoft }]}>Scored {kicks.filter((k) => k.scored).length}</Text>
            </View>
            <View style={styles.dots}>
              {slots.map((k, i) => {
                const globalIndex = k ? pens.kicks.indexOf(k) : -1;
                const fresh = k && kicksAtOpen !== null && globalIndex >= kicksAtOpen && !reduced;
                return (
                  <View key={`${i}-${k ? k.id : 'pending'}`} style={{ alignItems: 'center', gap: 2 }}>
                    <Animated.View
                      style={[
                        styles.dot,
                        {
                          backgroundColor: !k ? 'transparent' : k.scored ? theme.successSolid : theme.dangerSolid,
                          borderColor: !k ? theme.borderOnDark : 'transparent',
                        },
                        fresh && { animationName: POP, animationDuration: 280, animationTimingFunction: EASE_OUT },
                      ]}
                      accessible
                      accessibilityLabel={!k ? 'To come' : `${players.get(k.playerId ?? -1)?.name ?? 'Kick'} ${k.scored ? 'scored' : 'missed'}`}
                    >
                      {k && <Icon name={k.scored ? 'soccer' : 'close-thick'} size={18} color="#FFFFFF" />}
                    </Animated.View>
                    {k?.isSuddenDeath && <Text style={[type.label, { color: theme.onDarkSoft }]}>SD</Text>}
                  </View>
                );
              })}
            </View>
          </Deck>
        );
      })}

      {!finished && (
        <>
          <SectionHeader
            eyebrow={`${available.length} available on the pitch`}
            title={`Taker · ${kickingName}`}
            right={
              <Button
                label="Switch"
                size="sm"
                variant="ghost"
                icon="swap-horizontal"
                onPress={() => {
                  setChosenTeam(kickingTeam === match.homeTeamId ? match.awayTeamId : match.homeTeamId);
                  setTaker(undefined);
                }}
              />
            }
          />
          {available.length === 0 ? (
            <ErrorBanner message="No eligible takers left on the pitch for this side." />
          ) : (
            <PlayerGrid
              label="Penalty taker"
              players={available
                .map((pid) => players.get(pid))
                .filter((p) => !!p)
                .map((p) => ({ id: p!.id, number: p!.jerseyNumber, name: p!.name, sub: p!.position ?? undefined }))}
              selected={taker}
              onSelect={setTaker}
              dark
            />
          )}
          <Button
            label="End shootout manually"
            variant="ghost"
            icon="gavel"
            onPress={() => setEndOpen((s) => ({ open: true, key: s.key + 1 }))}
          />
        </>
      )}

      <Sheet
        key={endOpen.key}
        visible={endOpen.open}
        onClose={() => setEndOpen((s) => ({ ...s, open: false }))}
        dark
        title="Declare a winner"
        subtitle="Overrides the shootout record. The kicks taken so far are kept."
      >
        <Button label={match.homeTeamName} icon="trophy-outline" variant="deck" onPress={() => declare(match.homeTeamId, match.homeTeamName)} />
        <Button label={match.awayTeamName} icon="trophy-outline" variant="deck" onPress={() => declare(match.awayTeamId, match.awayTeamName)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  board: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  team: { flex: 1, fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.lg, paddingHorizontal: space.md },
  toKick: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.xl, padding: space.lg },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  dot: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
