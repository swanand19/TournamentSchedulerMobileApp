import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketMatchState, CricketRules, CricketSetupOptions } from '@/api/types';
import Button from '@/components/Button';
import { Card, Deck } from '@/components/Card';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import ScoringBanner, { isScoringLocked } from '@/components/ScoringBanner';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import { Coin, CoinFlipSheet } from '@/features/cricket/Coin';
import RulesEditor from '@/features/cricket/RulesEditor';
import XiPicker, { pickFromLast, pickProblems, seedPick, type TeamPick } from '@/features/cricket/XiPicker';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { haptic } from '@/lib/haptics';
import { claimScoring } from '@/lib/scoringClaim';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Format, toss and both XIs, sent in one call — the way the laws treat it: nothing is scored
// until the captains have exchanged teams and the coin has landed. A tournament is played to one
// format, so the last match's rules are the starting point, not a generic T20.
// Two steps on one screen (the user's request, 2026-11-24: one long form was a lot for someone new):
// 1 Teams and rules, 2 The toss. Nothing is sent until Start match; Back on step 2 returns to step 1
// with everything kept. The toss happens on the field — the app records it (the flip sheet is only a
// stand-in coin and decides nothing).

type Loaded = { state: CricketMatchState; options: CricketSetupOptions };

function presetLine(r: CricketRules) {
  const overs = r.oversPerInnings ? `${r.oversPerInnings} ov` : 'Timed';
  return `${overs} · ${r.playersPerSide} a side${r.inningsPerSide > 1 ? ' · 2 inns' : ''}${r.ballsPerOver !== 6 ? ` · ${r.ballsPerOver}-ball overs` : ''}`;
}

export default function CricketSetup() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const theme = useSportTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { id: tournamentId } = useTournament();
  const action = useAction();

  // Opening setup takes the match if nobody has it (lib/scoringClaim). Polled now and then: it keeps
  // the holder "seen" while they pick the XIs, and moves anyone else on once the match starts.
  const claimed = useRef(false);
  const fetcher = useCallback(async (): Promise<Loaded> => {
    if (!claimed.current) {
      claimed.current = true;
      await claimScoring('cricket', matchId);
    }
    const [state, options] = await Promise.all([
      api.call<CricketMatchState>('CRICKET_MATCH_GET', { routeParams: { matchId } }),
      api.call<CricketSetupOptions>('CRICKET_SETUP_OPTIONS', { routeParams: { matchId } }),
    ]);
    return { state, options };
  }, [matchId]);
  const data = useQuery(fetcher, { pollMs: 30000, live: { kind: 'match', sport: 'cricket', matchId: Number(matchId) } });

  const [preset, setPreset] = useState<string>('');
  const [rules, setRules] = useState<CricketRules | null>(null);
  const [editing, setEditing] = useState(false);
  const [tossWinner, setTossWinner] = useState<number | null>(null);
  const [decision, setDecision] = useState<'Bat' | 'Bowl' | ''>('');
  const [step, setStep] = useState<1 | 2>(1);
  const [flipOpen, setFlipOpen] = useState(false);
  // Leaving for the live screen (started here or elsewhere) must not be turned into "back to step 1".
  const leaving = useRef(false);
  const navigation = useNavigation();

  // Back on the toss returns to the teams, never out of the setup.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (step !== 2 || leaving.current) return;
        e.preventDefault();
        setStep(1);
      }),
    [navigation, step],
  );
  const [picks, setPicks] = useState<Record<number, TeamPick>>({});
  const [touched, setTouched] = useState(false);
  const [side, setSide] = useState<'home' | 'away'>('home');

  const loaded = data.data;
  const isSetUp = loaded?.state.isSetUp;

  // Already set up (here or on another phone): go straight to scoring.
  useEffect(() => {
    if (isSetUp) {
      leaving.current = true;
      router.replace({ pathname: '/tournament/[id]/cricket/[matchId]/live', params: { id: String(tournamentId), matchId: String(matchId) } });
    }
  }, [isSetUp, router, tournamentId, matchId]);

  // Seed the form once the options arrive: last match's format if there was one, else T20; XIs by
  // preferred batting order. Re-seed the XIs when the side size changes, until picked by hand.
  if (loaded && !rules) {
    const o = loaded.options;
    const start = o.lastFormat?.rules ?? o.presets.find((p) => p.name === 'T20')?.rules ?? o.presets[0]?.rules;
    if (start) {
      setRules(start);
      setPreset(o.lastFormat ? 'Last match' : 'T20');
    }
  }
  const [seededSize, setSeededSize] = useState<number | null>(null);
  if (loaded && rules && !touched && seededSize !== rules.playersPerSide) {
    setSeededSize(rules.playersPerSide);
    setPicks(Object.fromEntries(loaded.options.teams.map((t) => [t.id, seedPick(t, rules.playersPerSide)])));
  }

  if (!loaded || !rules) {
    return <Screen error={data.error} onRetry={data.refresh}>{data.loading && <Skeleton rows={5} height={100} />}</Screen>;
  }

  const o = loaded.options;
  const teams = [
    { key: 'home' as const, team: o.teams.find((t) => t.id === o.homeTeamId), name: o.homeTeamName, id: o.homeTeamId },
    { key: 'away' as const, team: o.teams.find((t) => t.id === o.awayTeamId), name: o.awayTeamName, id: o.awayTeamId },
  ];
  const size = rules.playersPerSide;
  const problems = teams.map((t) => (t.team && picks[t.team.id] ? pickProblems(picks[t.team.id], size) : ['no players']));
  const current = teams.find((t) => t.key === side)!;
  const xisReady = problems.every((p) => p.length === 0);
  const ready = xisReady && !!tossWinner && !!decision;
  const tossName = tossWinner === o.homeTeamId ? o.homeTeamName : tossWinner === o.awayTeamId ? o.awayTeamName : null;
  const otherName = tossWinner === o.homeTeamId ? o.awayTeamName : o.homeTeamName;
  const batsFirst = decision === 'Bat' ? tossName : otherName;
  const captainOf = (team: (typeof teams)[number]['team']) => {
    const id = team ? picks[team.id]?.captain : null;
    return team?.players.find((p) => p.id === id)?.name ?? null;
  };

  const setPick = (teamId: number, p: TeamPick) => {
    setTouched(true);
    setPicks((all) => ({ ...all, [teamId]: p }));
  };

  const start = async () => {
    const squad = teams.flatMap(({ team }) => {
      if (!team) return [];
      const pick = picks[team.id];
      return team.players.map((p) => {
        const order = pick.playing.indexOf(p.id);
        return {
          playerId: p.id,
          teamId: team.id,
          squadStatus: order >= 0 ? 'Playing' : pick.out.includes(p.id) ? 'Unavailable' : 'Bench',
          isCaptain: pick.captain === p.id,
          isWicketKeeper: pick.keeper === p.id,
          battingOrder: order >= 0 ? order + 1 : null,
        };
      });
    });
    const res = await action.run(() =>
      api.call<CricketMatchState>('CRICKET_SETUP', {
        routeParams: { matchId },
        body: { rules, tossWinnerTeamId: tossWinner, tossDecision: decision, squad },
      }),
    );
    if (res.ok) {
      haptic.success();
      leaving.current = true;
      router.replace({ pathname: '/tournament/[id]/cricket/[matchId]/live', params: { id: String(tournamentId), matchId: String(matchId) } });
    }
  };

  const presets = [
    ...(o.lastFormat ? [{ name: 'Last match', rules: o.lastFormat.rules, note: `Same as match ${o.lastFormat.matchNumber}` }] : []),
    ...o.presets.map((p) => ({ ...p, note: undefined as string | undefined })),
  ];

  // Someone else is setting it up: who, and Watch / Ask / Take over, instead of a form for nothing.
  const locked = isScoringLocked(loaded.state.scoring, false);
  // Taken over mid-toss: back to the first step, where the banner says who has it.
  if (locked && step === 2) setStep(1);

  const missing = teams
    .map((t, i) => (problems[i].length ? `${t.name}: ${problems[i].join(', ')}` : null))
    .filter(Boolean)
    .join(' · ');

  const footer = locked ? undefined : step === 1 ? (
    <>
      {!xisReady && <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>{missing}</Text>}
      <Button label="Next: the toss" icon={xisReady ? 'arrow-right' : 'lock-outline'} size="lg" disabled={!xisReady} onPress={() => setStep(2)} />
    </>
  ) : (
    <>
      {!ready && (
        <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>
          {!tossWinner ? 'Record who won the toss to start' : 'Choose to bat or bowl first'}
        </Text>
      )}
      <View style={styles.row}>
        <Button label="Back" variant="deck" size="lg" onPress={() => setStep(1)} style={{ flex: 1 }} />
        <Button label="Start match" icon={ready ? 'cricket' : 'lock-outline'} size="lg" disabled={!ready} busy={action.busy} onPress={start} style={{ flex: 2 }} />
      </View>
    </>
  );

  return (
    <Screen key={step} error={action.error} footer={footer}>
      <Stack.Screen options={{ title: step === 1 ? 'Set up the match' : 'The toss', gestureEnabled: step === 1 }} />
      {!locked && <SetupSteps step={step} />}

      {step === 2 ? (
        <>
          <View style={styles.coin}>
            <Coin />
            <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center', maxWidth: 280 }]}>
              Toss the coin on the field as usual, then record what happened.
            </Text>
            <Button label="No coin? Flip one here" icon="circle-double" variant="ghost" onPress={() => setFlipOpen(true)} />
          </View>

          <Text style={[type.label, { color: theme.onDarkSoft }]}>Who won the toss?</Text>
          <View style={styles.row} accessibilityRole="radiogroup">
            {teams.map((t) => {
              const on = tossWinner === t.id;
              const captain = captainOf(t.team);
              return (
                <PressableScale
                  key={t.key}
                  onPress={() => {
                    haptic.select();
                    setTossWinner(t.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${t.name} won the toss`}
                  style={[styles.toss, { backgroundColor: on ? theme.accent : theme.deckRaised, borderColor: on ? theme.accent : theme.borderOnDark }]}
                >
                  <View style={styles.tossTop}>
                    <Text style={[styles.tossName, { color: on ? theme.accentInk : theme.onDark }]} numberOfLines={2}>
                      {t.name}
                    </Text>
                    {on && <Icon name="check-circle" size={20} color={theme.accentInk} />}
                  </View>
                  {captain && <Text style={[type.caption, { color: on ? theme.accentInk : theme.onDarkSoft }]} numberOfLines={1}>Captain {captain}</Text>}
                </PressableScale>
              );
            })}
          </View>

          <View style={{ gap: space.sm, opacity: tossWinner ? 1 : 0.42 }} pointerEvents={tossWinner ? 'auto' : 'none'}>
            <Text style={[type.label, { color: theme.onDarkSoft }]}>Elected to</Text>
            <SegmentedControl
              segments={[
                { key: 'Bat', label: 'Bat first' },
                { key: 'Bowl', label: 'Bowl first' },
              ]}
              value={decision}
              onChange={(d) => setDecision(d)}
              accessibilityLabel="Toss decision"
            />
          </View>

          {tossName && decision && (
            <Card style={{ gap: space.xs }}>
              <Text style={[type.title, { color: theme.ink }]}>{batsFirst} bat first</Text>
              <Text style={[type.body, { color: theme.muted }]}>
                {tossName} won the toss and chose to {decision === 'Bat' ? 'bat' : 'bowl'}.
              </Text>
            </Card>
          )}
        </>
      ) : (
      <>
      <Deck>
        <Text style={[type.board, { color: theme.accent }]}>
          {`${loaded.state.roundLabel ?? `Group ${loaded.state.groupName}`} · Match ${loaded.state.matchNumber}`}
        </Text>
        <Text style={[type.title, { color: theme.onDark }]}>
          {o.homeTeamName} <Text style={{ color: theme.mode === 'light' ? theme.muted : theme.accent }}>{'vs'}</Text> {o.awayTeamName}
        </Text>
      </Deck>

      <ScoringBanner
        sport="cricket"
        matchId={matchId}
        scoring={loaded.state.scoring}
        onChanged={data.reload}
        onWatch={() => router.push({ pathname: '/tournament/[id]/cricket/[matchId]/watch', params: { id: String(tournamentId), matchId: String(matchId) } })}
      />

      {!locked && <>
      <SectionHeader title="Match format" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}>
        {presets.map((p) => {
          const on = preset === p.name;
          return (
            <PressableScale
              key={p.name}
              onPress={() => {
                haptic.select();
                setPreset(p.name);
                setRules(p.rules);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${p.name}, ${presetLine(p.rules)}`}
              style={[styles.preset, { backgroundColor: on ? theme.accent : theme.deck, borderColor: on ? theme.accent : theme.borderOnDark }]}
            >
              <View style={styles.presetTop}>
                <Text style={[styles.presetName, { color: on ? theme.accentInk : theme.onDark }]} numberOfLines={1}>
                  {p.name}
                </Text>
                {on && <Icon name="check-circle" size={20} color={theme.accentInk} />}
              </View>
              <Text style={[type.caption, { color: on ? theme.accentInk : theme.onDarkSoft }]}>{presetLine(p.rules)}</Text>
              {p.note ? <Text style={[type.label, { color: on ? theme.accentInk : theme.accent }]}>{p.note}</Text> : null}
            </PressableScale>
          );
        })}
      </ScrollView>

      <Card style={{ gap: space.sm }}>
        <PressableScale
          onPress={() => {
            haptic.select();
            setEditing(!editing);
          }}
          accessibilityState={{ expanded: editing }}
          accessibilityLabel="Edit match rules"
          style={styles.disclosure}
        >
          <Icon name="tune-variant" size={22} color={theme.ink} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: theme.ink }]}>{preset === 'Custom' ? 'Custom rules' : 'Edit match rules'}</Text>
            <Text style={[type.caption, { color: theme.muted }]}>{presetLine(rules)}</Text>
          </View>
          <Icon name={editing ? 'chevron-up' : 'chevron-down'} size={24} color={theme.muted} />
        </PressableScale>
        {editing && (
          <RulesEditor
            rules={rules}
            knockout={!!o.isKnockout}
            onChange={(r) => {
              setRules(r);
              setPreset('Custom');
            }}
          />
        )}
      </Card>

      <SectionHeader
        title="Playing XIs"
        right={<StatusChip label={problems.every((p) => p.length === 0) ? 'Both valid' : 'Incomplete'} tone={problems.every((p) => p.length === 0) ? 'ready' : 'setup'} onDark />}
      />
      <SegmentedControl
        segments={teams.map((t, i) => ({ key: t.key, label: t.name, badge: problems[i].length ? '!' : '✓' }))}
        value={side}
        onChange={setSide}
        accessibilityLabel="Team"
      />
      {current.team ? (
        <>
          {current.team.lastSquad && (
            <Button
              label={`Same as last match vs ${current.team.lastSquad.opponent}`}
              icon="history"
              variant="ghost"
              onPress={() => {
                const last = pickFromLast(current.team!);
                if (last) setPick(current.team!.id, last);
              }}
            />
          )}
          {current.team.players.length === 0 ? (
            <Text style={[type.body, { color: theme.onDarkSoft }]}>{current.name} has no players yet. Add them from the Teams screen.</Text>
          ) : (
            <XiPicker team={current.team} pick={picks[current.team.id] ?? seedPick(current.team, size)} size={size} onChange={(p) => setPick(current.team!.id, p)} />
          )}
        </>
      ) : null}
      </>}
      </>
      )}
      <CoinFlipSheet visible={flipOpen} onClose={() => setFlipOpen(false)} />
    </Screen>
  );
}

/** "Teams and rules · Toss": where the scorer is in the two steps, a bar each. */
function SetupSteps({ step }: { step: 1 | 2 }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const items = [
    { n: 1, label: 'Teams and rules' },
    { n: 2, label: 'Toss' },
  ];
  return (
    <View style={styles.steps} accessible accessibilityLabel={`Step ${step} of 2, ${items[step - 1].label}`}>
      {items.map((it) => {
        const reached = it.n <= step;
        const done = it.n < step;
        return (
          <View key={it.n} style={{ flex: 1, gap: 6 }}>
            <View style={[styles.stepBar, { backgroundColor: reached ? theme.accent : theme.borderOnDark }]} />
            <View style={styles.stepLabel}>
              {done ? <Icon name="check" size={14} color={theme.accent} /> : <Text style={[type.label, { color: reached ? theme.onDark : theme.onDarkSoft }]}>{it.n}</Text>}
              <Text style={[type.label, { color: reached ? theme.onDark : theme.onDarkSoft }]}>{it.label}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  preset: { width: 176, borderRadius: radius.lg, borderWidth: 1.5, padding: space.md, gap: 4, borderBottomWidth: 3 },
  presetTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  presetName: { flex: 1, fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  row: { flexDirection: 'row', gap: space.sm },
  toss: { flex: 1, minHeight: 88, borderRadius: radius.lg, borderWidth: 1.5, justifyContent: 'space-between', padding: space.md, gap: space.sm },
  tossTop: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tossName: { flex: 1, fontFamily: fonts.display, fontSize: 19, lineHeight: 23 },
  coin: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  steps: { flexDirection: 'row', gap: space.sm },
  stepBar: { height: 4, borderRadius: 2 },
  stepLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

