import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { GroupInput, SavedSchedule, Team, TournamentSchedule } from '@/api/types';
import Button from '@/components/Button';
import { Card, Deck } from '@/components/Card';
import DateField, { todayValue } from '@/components/DateField';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { groupLabel, plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, lip, radius, space, type } from '@/theme/theme';

// Building the fixtures, in four steps: which teams play, how they're grouped, how many matches
// each, then a preview to approve. The server generates the round-robin and explains anything it
// had to cap; this screen collects the choices and shows the answer.

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Teams', 'Groups', 'Format', 'Preview'];

// Module scope: layout-animation builders are rebuilt on every render if made inline.
const STEP_IN = FadeIn.duration(180);

export default function ScheduleWizard() {
  const router = useRouter();
  const theme = useSportTheme();
  const tournament = useTournament();
  const { id } = tournament;
  const teams = useTeams(id);
  const action = useAction();

  // What's picked, or the dates it already has, or today and a week on.
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [endDraft, setEndDraft] = useState<string | null>(null);
  const startDate = startDraft ?? tournament.query.data?.startDate ?? todayValue();
  const endDate = endDraft ?? tournament.query.data?.endDate ?? todayValue(7);

  const fetchExisting = useCallback(async () => {
    try {
      return await api.call<SavedSchedule>('SCHEDULE_ACTIVE', { routeParams: { id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }, [id]);
  const existing = useQuery(fetchExisting);

  const [step, setStep] = useState<Step>(0);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [groupCount, setGroupCount] = useState(1);
  const [groups, setGroups] = useState<GroupInput[]>([]);
  const [moving, setMoving] = useState<string | null>(null);
  const [perTeam, setPerTeam] = useState(3);
  const [repeats, setRepeats] = useState(false);
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(null);

  if (!teams.data) {
    return (
      <Screen error={teams.error} onRetry={teams.refresh}>
        {teams.loading && <Skeleton rows={5} />}
      </Screen>
    );
  }

  const selected = teams.data.filter((t) => !excluded.has(t.id)).map((t) => t.name);
  const maxGroups = Math.max(1, Math.floor(selected.length / 2));
  const smallest = groups.length ? Math.min(...groups.map((g) => g.teams.length)) : 0;
  const maxWithoutRepeats = Math.max(1, smallest - 1);

  const go = (next: Step) => {
    action.clearError();
    setStep(next);
  };

  /** Spread the teams across the groups in order — the starting point for manual assignment. */
  const manual = () => {
    const built = Array.from({ length: groupCount }, (_, i) => ({
      name: groupLabel(i),
      teams: selected.filter((_, j) => j % groupCount === i),
    }));
    setGroups(built);
    setMoving(null);
    haptic.select();
  };

  const randomise = async () => {
    const res = await action.run(() =>
      api.call<{ groups: GroupInput[] }>('TOURNAMENT_GROUPS_RANDOMIZE', { body: { teamNames: selected, groupCount } }),
    );
    if (res.ok) {
      setGroups(res.value.groups);
      setMoving(null);
      haptic.success();
    }
  };

  const moveTo = (groupName: string) => {
    if (!moving) return;
    setGroups((gs) =>
      gs.map((g) => ({
        ...g,
        teams: g.name === groupName ? [...g.teams.filter((t) => t !== moving), moving] : g.teams.filter((t) => t !== moving),
      })),
    );
    setMoving(null);
    haptic.tap();
  };

  const continueFromGroups = async () => {
    // The server checks for duplicates and empty groups; its message says which.
    const res = await action.run(() => api.call('TOURNAMENT_GROUPS_MANUAL', { body: { groups } }));
    if (res.ok) {
      setPerTeam((n) => (repeats ? n : Math.min(n, maxWithoutRepeats)));
      go(2);
    }
  };

  const generate = async () => {
    const res = await action.run(() =>
      api.call<TournamentSchedule>('TOURNAMENT_SCHEDULE_GENERATE', {
        body: { groups, matchesPerTeam: perTeam, allowRepeatFixtures: repeats },
      }),
    );
    if (res.ok) {
      setSchedule(res.value);
      haptic.success();
      go(3);
    }
  };

  const approve = async () => {
    if (!schedule) return;
    if (existing.data) {
      const ok = await confirm({
        title: 'Replace the current schedule?',
        message: 'The current schedule is kept in history but stops being the active one.',
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    const res = await action.run(() =>
      api.call('TOURNAMENT_SCHEDULE_APPROVE', { body: { tournamentId: id, schedule, startDate, endDate } }),
    );
    if (res.ok) {
      haptic.success();
      tournament.query.reload(); // its dates are set now
      router.back();
    }
  };

  // What the chosen format will produce, before generating — so the caps aren't a surprise.
  const hints: { tone: 'warn' | 'info'; text: string }[] = [];
  if (!repeats && perTeam > maxWithoutRepeats) {
    hints.push({
      tone: 'warn',
      text: `${perTeam} per team needs repeat fixtures — without them it's capped at ${maxWithoutRepeats}. Turn on repeat fixtures to schedule ${perTeam}.`,
    });
  }
  const effective = repeats ? perTeam : Math.min(perTeam, maxWithoutRepeats);
  const odd = groups.filter((g) => g.teams.length > 1 && (g.teams.length * effective) % 2 !== 0);
  if (odd.length) {
    hints.push({
      tone: 'warn',
      text: `Group ${odd.map((g) => g.name).join(', ')}: ${effective} each can't split evenly — one team will play ${effective - 1}.`,
    });
  }
  const estimate = groups.reduce((sum, g) => sum + Math.floor((g.teams.length * effective) / 2), 0);
  if (estimate > 0) hints.push({ tone: 'info', text: `About ${plural(estimate, 'match', 'matches')} in total.` });

  const footer = (
    <View style={styles.footerRow}>
      {step > 0 && (
        <Button label="Back" icon="arrow-left" variant="deck" onPress={() => go((step - 1) as Step)} style={{ flex: 1 }} />
      )}
      {step === 0 && (
        <Button
          label="Continue to groups"
          onPress={() => {
            setGroupCount((c) => Math.min(c, maxGroups));
            setGroups([]);
            go(1);
          }}
          disabled={selected.length < 2}
          style={{ flex: 2 }}
        />
      )}
      {step === 1 && (
        <Button label="Continue to format" onPress={continueFromGroups} busy={action.busy} disabled={groups.length === 0 || smallest < 2} style={{ flex: 2 }} />
      )}
      {step === 2 && <Button label="Generate fixtures" icon="calendar-sync" onPress={generate} busy={action.busy} style={{ flex: 2 }} />}
      {step === 3 && <Button label="Approve schedule" icon="lightning-bolt" onPress={approve} busy={action.busy} style={{ flex: 2 }} />}
    </View>
  );

  return (
    <Screen footer={footer} error={action.error}>
      <Progress step={step} />

      <Animated.View key={step} entering={STEP_IN} style={{ gap: space.lg }}>
        {step === 0 && <TeamsStep teams={teams.data} excluded={excluded} setExcluded={setExcluded} count={selected.length} />}

        {step === 1 && (
          <>
            <SectionHeader eyebrow="Step 2 of 4 · Group allocation" title="Divide into groups" />
            <Deck>
              <Stepper
                label="Number of groups"
                hint={`${plural(selected.length, 'team')} · at least 2 per group`}
                value={groupCount}
                min={1}
                max={maxGroups}
                onChange={(n) => {
                  setGroupCount(n);
                  setGroups([]);
                }}
                onDark
              />
              <View style={styles.footerRow}>
                <Button label="Randomise" icon="dice-5" variant="deck" onPress={randomise} busy={action.busy} style={{ flex: 1 }} />
                <Button label="Assign manually" icon="gesture-tap" variant="deck" onPress={manual} style={{ flex: 1 }} />
              </View>
              {groups.length > 0 && (
                <Text style={[type.caption, { color: theme.onDarkSoft }]}>
                  To move a team: tap it, then tap “Move here” on another group.
                </Text>
              )}
            </Deck>
            {groups.map((g) => (
              <GroupCard key={g.name} group={g} moving={moving} onPickTeam={setMoving} onMoveHere={() => moveTo(g.name)} />
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <SectionHeader eyebrow="Step 3 of 4 · Format" title="Matches per team" />
            <Card>
              <Stepper label="Matches per team" value={perTeam} min={1} max={60} onChange={setPerTeam} />
              <SwitchRow
                label="Allow repeat fixtures"
                hint={`Without repeats a team meets each opponent once, so the most is ${maxWithoutRepeats}.`}
                value={repeats}
                onChange={setRepeats}
              />
            </Card>
            {hints.map((h, i) => (
              <Callout key={i} tone={h.tone} text={h.text} />
            ))}
          </>
        )}

        {step === 3 && schedule && (
          <>
            {/* The dates are settled with the fixtures, now that it's clear how many matches there are. */}
            <Card>
              <SectionHeader onCard title="When is it played?" />
              <View style={styles.footerRow}>
                <View style={{ flex: 1 }}>
                  <DateField label="Starts" value={startDate} onChange={setStartDraft} disabled={action.busy} />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField label="Ends" value={endDate} onChange={setEndDraft} disabled={action.busy} />
                </View>
              </View>
              <Text style={[type.caption, { color: theme.muted }]}>
                {"It completes by itself the day after it ends, if you haven't marked it complete."}
              </Text>
            </Card>
            <Preview schedule={schedule} onRegenerate={generate} busy={action.busy} />
          </>
        )}
      </Animated.View>
    </Screen>
  );
}

function Progress({ step }: { step: Step }) {
  const theme = useSportTheme();
  return (
    <View style={styles.progress} accessible accessibilityLabel={`Step ${step + 1} of 4, ${STEPS[step]}`}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <View key={label} style={styles.progressItem}>
            {/* The dot's colour eases between states — the one cue that the step changed. */}
            <Animated.View
              style={[
                styles.progressDot,
                {
                  backgroundColor: done ? theme.successSolid : active ? theme.accent : theme.deckRaised,
                  transitionProperty: 'backgroundColor',
                  transitionDuration: 200,
                },
              ]}
            >
              {done ? (
                <Icon name="check" size={16} color="#FFFFFF" />
              ) : (
                <Text style={[styles.progressNum, { color: active ? theme.accentInk : theme.onDarkSoft }]}>{i + 1}</Text>
              )}
            </Animated.View>
            <Text style={[type.label, { color: active ? theme.accent : theme.onDarkSoft }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TeamsStep({
  teams,
  excluded,
  setExcluded,
  count,
}: {
  teams: Team[];
  excluded: Set<number>;
  setExcluded: (s: Set<number>) => void;
  count: number;
}) {
  const theme = useSportTheme();
  return (
    <>
      <SectionHeader eyebrow="Step 1 of 4 · Teams in play" title={`${count} of ${teams.length} selected`} />
      {teams.length < 2 && (
        <Callout tone="warn" text="Add at least two teams to the tournament before building a schedule." />
      )}
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {teams.map((t, i) => {
          const on = !excluded.has(t.id);
          return (
            <PressableScale
              key={t.id}
              onPress={() => {
                haptic.select();
                const next = new Set(excluded);
                if (on) next.add(t.id);
                else next.delete(t.id);
                setExcluded(next);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={t.name}
              style={[styles.checkRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.cardDivider }]}
            >
              <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={on ? theme.successSolid : theme.muted} />
              <Text style={[type.lead, { color: theme.ink, flex: 1 }]}>{t.name}</Text>
              <Text style={[type.caption, { color: theme.muted }]}>{plural(t.players.length, 'player')}</Text>
            </PressableScale>
          );
        })}
      </Card>
    </>
  );
}

function GroupCard({
  group,
  moving,
  onPickTeam,
  onMoveHere,
}: {
  group: GroupInput;
  moving: string | null;
  onPickTeam: (team: string | null) => void;
  onMoveHere: () => void;
}) {
  const theme = useSportTheme();
  const canReceive = moving !== null && !group.teams.includes(moving);
  return (
    <Card>
      <View style={styles.groupHead}>
        <Text style={[type.headline, { color: theme.ink, flex: 1 }]}>Group {group.name}</Text>
        <Text style={[type.label, { color: group.teams.length < 2 ? theme.warnInk : theme.successInk }]}>
          {plural(group.teams.length, 'team', 'teams')}
        </Text>
      </View>
      {group.teams.map((team) => {
        const picked = moving === team;
        return (
          <PressableScale
            key={team}
            onPress={() => {
              haptic.select();
              onPickTeam(picked ? null : team);
            }}
            accessibilityLabel={picked ? `${team}, selected to move` : `${team}. Tap to move to another group`}
            accessibilityState={{ selected: picked }}
            style={[styles.teamRow, { backgroundColor: picked ? theme.ink : theme.chip }]}
          >
            <Icon name="shield-outline" size={20} color={picked ? theme.accent : theme.muted} />
            <Text style={[type.bodyStrong, { color: picked ? theme.cream : theme.ink, flex: 1 }]}>{team}</Text>
            {picked && <Text style={[type.label, { color: theme.accent }]}>Ready to move</Text>}
          </PressableScale>
        );
      })}
      {group.teams.length < 2 && <Text style={[type.caption, { color: theme.warnInk }]}>Every group needs at least 2 teams.</Text>}
      {canReceive && (
        <Button label={`Move ${moving} here`} icon="plus-circle-outline" variant="secondary" onPress={onMoveHere} />
      )}
    </Card>
  );
}

function Preview({ schedule, onRegenerate, busy }: { schedule: TournamentSchedule; onRegenerate: () => void; busy: boolean }) {
  const theme = useSportTheme();
  return (
    <>
      <SectionHeader
        eyebrow="Step 4 of 4 · Review"
        title="Generated fixtures"
        right={<Text style={[type.label, { color: theme.onDarkSoft }]}>{plural(schedule.totalMatches, 'match', 'matches')}</Text>}
      />
      {schedule.groups.map((g) => (
        <Deck key={g.groupName} style={styles.summary}>
          <View style={[styles.groupLetter, { backgroundColor: theme.deckRaised }]}>
            <Text style={[type.heading, { color: theme.accent }]}>{g.groupName}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyStrong, { color: theme.onDark }]}>Group {g.groupName}</Text>
            <Text style={[type.caption, { color: theme.onDarkSoft }]}>
              {plural(g.teamCount, 'team')} · {plural(g.roundsUsed, 'round')} ·{' '}
              {g.minMatchesPerTeam === g.maxMatchesPerTeam ? `${g.minMatchesPerTeam}` : `${g.minMatchesPerTeam}–${g.maxMatchesPerTeam}`} each
            </Text>
          </View>
          <Text style={[type.figure, { color: theme.onDark }]}>{g.fixtures.length}</Text>
        </Deck>
      ))}
      {schedule.groups.flatMap((g) => g.warnings.map((w, i) => <Callout key={`${g.groupName}-${i}`} tone="warn" text={`Group ${g.groupName}: ${w}`} />))}

      <Button label="Regenerate" icon="refresh" variant="ghost" onPress={onRegenerate} busy={busy} />

      {schedule.groups.map((g) => {
        const rounds = [...new Set(g.fixtures.map((f) => f.round))].sort((a, b) => a - b);
        return rounds.map((r) => (
          <View key={`${g.groupName}-${r}`} style={{ gap: space.sm }}>
            <Text style={[type.eyebrow, { color: theme.accent }]}>
              Group {g.groupName}, round {r}
            </Text>
            {g.fixtures
              .filter((f) => f.round === r)
              .map((f) => (
                <View key={f.id} style={[styles.fixture, { backgroundColor: theme.cream }, lip(theme)]} accessible accessibilityLabel={`${f.home} against ${f.away}`}>
                  <Text style={[styles.fixtureTeam, { color: theme.ink }]} numberOfLines={1}>
                    {f.home.toUpperCase()}
                  </Text>
                  <Text style={[type.label, { color: theme.warnInk }]}>VS</Text>
                  <Text style={[styles.fixtureTeam, { color: theme.ink, textAlign: 'right' }]} numberOfLines={1}>
                    {f.away.toUpperCase()}
                  </Text>
                </View>
              ))}
          </View>
        ));
      })}
    </>
  );
}

function Callout({ tone, text }: { tone: 'warn' | 'info'; text: string }) {
  const theme = useSportTheme();
  return (
    <View
      style={[styles.callout, { backgroundColor: tone === 'warn' ? theme.tintAlt : theme.surfaceOnDark, borderColor: tone === 'warn' ? theme.accent : theme.borderOnDark }]}
      accessibilityRole={tone === 'warn' ? 'alert' : undefined}
    >
      <Icon name={tone === 'warn' ? 'alert-outline' : 'information-outline'} size={20} color={tone === 'warn' ? theme.warnInk : theme.accent} />
      <Text style={[type.body, { color: tone === 'warn' ? theme.warnInk : theme.onDark, flex: 1 }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', gap: space.sm },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  progressItem: { alignItems: 'center', gap: 4, flex: 1 },
  progressDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  progressNum: { fontFamily: fonts.display, fontSize: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  groupHead: { flexDirection: 'row', alignItems: 'center' },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  groupLetter: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  fixture: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, padding: space.md, minHeight: 56 },
  fixtureTeam: { flex: 1, fontFamily: fonts.display, fontSize: 18 },
  callout: { flexDirection: 'row', gap: space.sm, borderRadius: radius.lg, borderWidth: 1, padding: space.md },
});
