import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { FootballMatch, MatchCard, Player, SquadStatus } from '@/api/types';
import { JerseyBadge, TeamBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card, Deck } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import { useFootballMatch } from '@/features/football/useFootballMatch';
import { useAction } from '@/hooks/useAction';
import { useTournament } from '@/hooks/useTournament';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// Rules and line-ups for one football match. Kicking off sends both and starts the clock in one
// call, so nothing can be half set up. The defaults are the website's (small-sided amateur game);
// every rule is a stepper or a switch away.

type Pick = Exclude<SquadStatus, 'SubstitutedOff' | 'SentOff'>;
const PICKS: { key: Pick; label: string }[] = [
  { key: 'Starting', label: 'Start' },
  { key: 'Bench', label: 'Bench' },
  { key: 'Unavailable', label: 'Out' },
];

function byShirt(a: Player, b: Player) {
  return (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999) || a.name.localeCompare(b.name);
}

/** First N by shirt number start, everyone else on the bench — the usual starting point. */
function defaultSquad(match: FootballMatch, starters: number): Record<number, Pick> {
  const picks: Record<number, Pick> = {};
  for (const team of [match.homeTeam, match.awayTeam]) {
    [...(team?.players ?? [])].sort(byShirt).forEach((p, i) => {
      picks[p.id] = i < starters ? 'Starting' : 'Bench';
    });
  }
  return picks;
}

export default function FootballSetup() {
  const router = useRouter();
  const theme = useSportTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { id: tournamentId } = useTournament();
  const data = useFootballMatch(Number(matchId));
  const action = useAction();
  const [liveMatchId, setLiveMatchId] = useState<number | null>(null);

  const [maxPlayers, setMaxPlayers] = useState(5);
  const [minPlayers, setMinPlayers] = useState(3);
  const [minutes, setMinutes] = useState(20);
  const [maxSubs, setMaxSubs] = useState(3);
  const [rolling, setRolling] = useState(false);
  const [draw, setDraw] = useState(true);
  const [extraTime, setExtraTime] = useState(false);
  const [etMinutes, setEtMinutes] = useState(10);
  const [squad, setSquad] = useState<Record<number, Pick> | null>(null);
  const [touched, setTouched] = useState(false);
  const [side, setSide] = useState<'home' | 'away'>('home');

  const match = data.data?.match;
  const params = { id: String(tournamentId), matchId: String(matchId) };
  const status = match?.status;

  // Already under way (set up on another phone, or reopened): this isn't the screen for it.
  useEffect(() => {
    if (status && status !== 'NotStarted') {
      router.replace({ pathname: '/tournament/[id]/football/[matchId]/live', params: { id: String(tournamentId), matchId: String(matchId) } });
    }
  }, [status, router, tournamentId, matchId]);

  // 409 means another match in this tournament is live — find it so the scorer can jump there.
  const conflict = action.error instanceof ApiError && action.error.status === 409;
  useEffect(() => {
    if (!conflict) return undefined;
    let cancelled = false;
    api
      .call<MatchCard[]>('TOURNAMENT_MATCHES', { routeParams: { id: tournamentId } })
      .then((ms) => {
        const live = ms.find((m) => m.sport === 'Football' && ['InProgress', 'Paused', 'PenaltyShootout'].includes(m.status));
        if (!cancelled) setLiveMatchId(live?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conflict, tournamentId]);

  // "Adjusting state when a prop changes": seed the squad once the match arrives, and re-seed it
  // when the side size changes — until the scorer has picked players by hand.
  const [seededFor, setSeededFor] = useState<number | null>(null);
  if (match && !touched && seededFor !== maxPlayers) {
    setSeededFor(maxPlayers);
    setSquad(defaultSquad(match, maxPlayers));
  }

  if (!match || !squad) {
    return <Screen error={data.error} onRetry={data.refresh}>{data.loading && <Skeleton rows={5} />}</Screen>;
  }

  const teams = [
    { key: 'home' as const, team: match.homeTeam, name: match.homeTeamName, id: match.homeTeamId },
    { key: 'away' as const, team: match.awayTeam, name: match.awayTeamName, id: match.awayTeamId },
  ];
  const startersOf = (t: (typeof teams)[number]) => (t.team?.players ?? []).filter((p) => squad[p.id] === 'Starting').length;
  const counts = teams.map(startersOf);
  const ready = counts.every((c) => c === maxPlayers);
  const current = teams.find((t) => t.key === side)!;
  const short = teams.find((t) => startersOf(t) !== maxPlayers);

  const setPick = (playerId: number, pick: Pick) => {
    haptic.select();
    setTouched(true);
    setSquad((s) => ({ ...(s ?? {}), [playerId]: pick }));
  };

  const kickOff = async () => {
    const body = {
      maxPlayersPerSide: maxPlayers,
      minPlayersPerSide: minPlayers,
      minutesPerHalf: minutes,
      extraTimeAllowed: extraTime,
      drawAllowed: draw,
      maxSubstitutions: maxSubs,
      rollingSubsAllowed: rolling,
      extraTimeMinutesPerHalf: extraTime ? etMinutes : null,
      squad: teams.flatMap((t) =>
        (t.team?.players ?? []).map((p) => ({ playerId: p.id, teamId: t.id, squadStatus: squad[p.id] ?? 'Bench' })),
      ),
    };
    const res = await action.run(() => api.call('MATCH_SETUP', { routeParams: { matchId }, body }));
    if (res.ok) {
      haptic.success();
      router.replace({ pathname: '/tournament/[id]/football/[matchId]/live', params });
    }
  };

  return (
    <Screen
      footer={
        <>
          {!ready && short && (
            <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>
              {short.name} has {startersOf(short)} of {maxPlayers} starters picked
            </Text>
          )}
          <Button
            label={ready ? 'Kick off' : `${counts[0]}/${maxPlayers} · ${counts[1]}/${maxPlayers} starters`}
            icon={ready ? 'whistle' : 'lock-outline'}
            size="lg"
            disabled={!ready}
            busy={action.busy}
            onPress={kickOff}
          />
        </>
      }
    >
      <ErrorBanner
        message={action.error?.message}
        actionLabel={conflict && liveMatchId ? 'Open live match' : undefined}
        onAction={() =>
          liveMatchId &&
          router.replace({ pathname: '/tournament/[id]/football/[matchId]/live', params: { id: params.id, matchId: String(liveMatchId) } })
        }
      />

      <Deck>
        <Text style={[type.board, { color: theme.accent }]}>
          GROUP {match.groupName} · MATCH {match.matchNumber}
        </Text>
        <View style={styles.versus}>
          <View style={styles.side}>
            <TeamBadge name={match.homeTeamName} size={48} home />
            <Text style={[styles.teamName, { color: theme.onDark }]} numberOfLines={2}>
              {match.homeTeamName.toUpperCase()}
            </Text>
            <Text style={[type.label, { color: theme.onDarkSoft }]}>Home</Text>
          </View>
          <Text style={[type.heading, { color: theme.accent }]}>VS</Text>
          <View style={styles.side}>
            <TeamBadge name={match.awayTeamName} size={48} />
            <Text style={[styles.teamName, { color: theme.onDark }]} numberOfLines={2}>
              {match.awayTeamName.toUpperCase()}
            </Text>
            <Text style={[type.label, { color: theme.onDarkSoft }]}>Away</Text>
          </View>
        </View>
      </Deck>

      <Card>
        <SectionHeader title="Match rules" onCard />
        <Stepper label="Players per side" value={maxPlayers} min={1} max={11} onChange={(n) => { setMaxPlayers(n); setMinPlayers((m) => Math.min(m, n)); }} />
        <Stepper label="Minimum players" hint="Fewer after red cards and the match is abandoned" value={minPlayers} min={1} max={maxPlayers} onChange={setMinPlayers} />
        <Stepper label="Minutes per half" value={minutes} min={1} max={60} onChange={(n) => { setMinutes(n); setEtMinutes((e) => Math.min(e, n)); }} />
        <Stepper label="Max substitutions" value={maxSubs} min={0} max={20} onChange={setMaxSubs} />
        <SwitchRow label="Rolling substitutions" hint="Players taken off can come back on" value={rolling} onChange={setRolling} />
        <SwitchRow
          label="Draw allowed"
          hint="Turn off for a knockout tie"
          value={draw}
          onChange={(v) => {
            setDraw(v);
            if (v) setExtraTime(false); // a draw and extra time can't both apply
          }}
        />
        <SwitchRow
          label="Extra time"
          hint="If level at full time, then penalties"
          value={extraTime}
          onChange={(v) => {
            setExtraTime(v);
            if (v) setDraw(false);
          }}
        />
        {extraTime && (
          <Stepper label="Extra-time half length" hint="No longer than a regular half" value={etMinutes} min={1} max={minutes} onChange={setEtMinutes} />
        )}
      </Card>

      <SectionHeader
        eyebrow="Squads"
        title="Starting line-ups"
        right={<StatusChip label={ready ? 'Both ready' : 'Pick starters'} tone={ready ? 'ready' : 'setup'} onDark />}
      />
      <SegmentedControl
        segments={teams.map((t, i) => ({ key: t.key, label: t.name, badge: `${counts[i]}/${maxPlayers}` }))}
        value={side}
        onChange={setSide}
        accessibilityLabel="Team"
      />

      {(current.team?.players ?? []).length === 0 ? (
        <Text style={[type.body, { color: theme.onDarkSoft }]}>
          {current.name} has no players. Add them from the Teams screen first.
        </Text>
      ) : (
        [...(current.team?.players ?? [])].sort(byShirt).map((p) => {
          const pick = squad[p.id] ?? 'Bench';
          return (
            <View key={p.id} style={[styles.playerRow, { backgroundColor: theme.deck, borderColor: pick === 'Starting' ? theme.accentSoft : theme.borderOnDark }]}>
              <JerseyBadge number={p.jerseyNumber} size={40} highlight={pick === 'Starting'} />
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyStrong, { color: pick === 'Unavailable' ? theme.onDarkSoft : theme.onDark }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {p.position ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{p.position}</Text> : null}
              </View>
              <View style={[styles.picks, { backgroundColor: theme.page }]} accessibilityRole="radiogroup" accessibilityLabel={`${p.name} squad status`}>
                {PICKS.map((o) => {
                  const on = pick === o.key;
                  const bg = !on ? 'transparent' : o.key === 'Starting' ? theme.successSolid : o.key === 'Unavailable' ? theme.dangerSolid : theme.deckRaised;
                  return (
                    <PressableScale
                      key={o.key}
                      onPress={() => setPick(p.id, o.key)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`${o.label}`}
                      hitSlop={4}
                      style={[styles.pick, { backgroundColor: bg }]}
                    >
                      <Text style={[styles.pickText, { color: on ? '#FFFFFF' : theme.onDarkSoft }]}>{o.label.toUpperCase()}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  versus: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  side: { flex: 1, alignItems: 'center', gap: space.xs },
  teamName: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, borderWidth: 1, padding: space.sm, paddingLeft: space.md },
  picks: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 2 },
  pick: { minWidth: 54, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pickText: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.4 },
});
