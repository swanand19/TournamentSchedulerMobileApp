import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketMatchState, CricketRules, CricketSetupOptions } from '@/api/types';
import Button from '@/components/Button';
import { Card, Deck } from '@/components/Card';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import StatusChip from '@/components/StatusChip';
import RulesEditor from '@/features/cricket/RulesEditor';
import XiPicker, { pickFromLast, pickProblems, seedPick, type TeamPick } from '@/features/cricket/XiPicker';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// Format, toss and both XIs, sent in one call — the way the laws treat it: nothing is scored
// until the captains have exchanged teams and the coin has landed. A tournament is played to one
// format, so the last match's rules are the starting point, not a generic T20.

type Loaded = { state: CricketMatchState; options: CricketSetupOptions };

function presetLine(r: CricketRules) {
  const overs = r.oversPerInnings ? `${r.oversPerInnings} ov` : 'Timed';
  return `${overs} · ${r.playersPerSide} a side${r.inningsPerSide > 1 ? ' · 2 inns' : ''}${r.ballsPerOver !== 6 ? ` · ${r.ballsPerOver}-ball overs` : ''}`;
}

export default function CricketSetup() {
  const router = useRouter();
  const theme = useSportTheme();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { id: tournamentId } = useTournament();
  const action = useAction();

  const fetcher = useCallback(async (): Promise<Loaded> => {
    const [state, options] = await Promise.all([
      api.call<CricketMatchState>('CRICKET_MATCH_GET', { routeParams: { matchId } }),
      api.call<CricketSetupOptions>('CRICKET_SETUP_OPTIONS', { routeParams: { matchId } }),
    ]);
    return { state, options };
  }, [matchId]);
  const data = useQuery(fetcher);

  const [preset, setPreset] = useState<string>('');
  const [rules, setRules] = useState<CricketRules | null>(null);
  const [editing, setEditing] = useState(false);
  const [tossWinner, setTossWinner] = useState<number | null>(null);
  const [decision, setDecision] = useState<'Bat' | 'Bowl'>('Bat');
  const [picks, setPicks] = useState<Record<number, TeamPick>>({});
  const [touched, setTouched] = useState(false);
  const [side, setSide] = useState<'home' | 'away'>('home');

  const loaded = data.data;
  const isSetUp = loaded?.state.isSetUp;

  // Already set up (here or on another phone): go straight to scoring.
  useEffect(() => {
    if (isSetUp) {
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
  const ready = !!tossWinner && problems.every((p) => p.length === 0);
  const tossName = tossWinner === o.homeTeamId ? o.homeTeamName : tossWinner === o.awayTeamId ? o.awayTeamName : null;
  const otherName = tossWinner === o.homeTeamId ? o.awayTeamName : o.homeTeamName;

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
      router.replace({ pathname: '/tournament/[id]/cricket/[matchId]/live', params: { id: String(tournamentId), matchId: String(matchId) } });
    }
  };

  const presets = [
    ...(o.lastFormat ? [{ name: 'Last match', rules: o.lastFormat.rules, note: `Same as match ${o.lastFormat.matchNumber}` }] : []),
    ...o.presets.map((p) => ({ ...p, note: undefined as string | undefined })),
  ];

  return (
    <Screen
      error={action.error}
      footer={
        <>
          {!ready && (
            <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>
              {!tossWinner
                ? 'Record the toss to start'
                : teams
                    .map((t, i) => (problems[i].length ? `${t.name}: ${problems[i].join(', ')}` : null))
                    .filter(Boolean)
                    .join(' · ')}
            </Text>
          )}
          <Button label="Start match" icon={ready ? 'cricket' : 'lock-outline'} size="lg" disabled={!ready} busy={action.busy} onPress={start} />
        </>
      }
    >
      <Deck>
        <Text style={[type.board, { color: theme.accent }]}>
          GROUP {loaded.state.groupName} · MATCH {loaded.state.matchNumber}
        </Text>
        <Text style={[type.title, { color: theme.onDark }]}>
          {o.homeTeamName.toUpperCase()} <Text style={{ color: theme.accent }}>VS</Text> {o.awayTeamName.toUpperCase()}
        </Text>
      </Deck>

      <SectionHeader eyebrow="Step 1" title="Match format" />
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
                  {p.name.toUpperCase()}
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
            onChange={(r) => {
              setRules(r);
              setPreset('Custom');
            }}
          />
        )}
      </Card>

      <SectionHeader eyebrow="Step 2" title="Toss" />
      <Deck>
        <Text style={[type.label, { color: theme.onDarkSoft }]}>Who won the toss?</Text>
        <View style={styles.row}>
          {teams.map((t) => {
            const on = tossWinner === t.id;
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
                {on && <Icon name="circle-slice-8" size={18} color={theme.accentInk} />}
                <Text style={[styles.tossName, { color: on ? theme.accentInk : theme.onDark }]} numberOfLines={2}>
                  {t.name.toUpperCase()}
                </Text>
              </PressableScale>
            );
          })}
        </View>
        <Text style={[type.label, { color: theme.onDarkSoft }]}>Elected to</Text>
        <SegmentedControl
          segments={[
            { key: 'Bat', label: 'Bat first' },
            { key: 'Bowl', label: 'Bowl first' },
          ]}
          value={decision}
          onChange={setDecision}
          accessibilityLabel="Toss decision"
        />
        {tossName && (
          <Text style={[type.body, { color: theme.onDark }]}>
            <Text style={{ color: theme.accent }}>{tossName}</Text> won the toss and chose to {decision === 'Bat' ? 'bat' : 'bowl'} first ·{' '}
            {otherName} will {decision === 'Bat' ? 'bowl' : 'bat'}.
          </Text>
        )}
      </Deck>

      <SectionHeader
        eyebrow="Step 3"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  preset: { width: 176, borderRadius: radius.lg, borderWidth: 1.5, padding: space.md, gap: 4, borderBottomWidth: 3 },
  presetTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  presetName: { flex: 1, fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  row: { flexDirection: 'row', gap: space.sm },
  toss: { flex: 1, minHeight: 64, borderRadius: radius.lg, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: space.sm, gap: 2 },
  tossName: { fontFamily: fonts.display, fontSize: 18, textAlign: 'center' },
});

