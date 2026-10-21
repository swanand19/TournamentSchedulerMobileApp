import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { KnockoutFixture, KnockoutPreset, KnockoutStage, MatchCard } from '@/api/types';
import Button from '@/components/Button';
import { Card, Deck } from '@/components/Card';
import DateField, { todayValue } from '@/components/DateField';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import SwitchRow from '@/components/SwitchRow';
import {
  draftOf, emptySlot, FixtureSheet, inBracketOrder, KnockoutCard, slotBody, TeamPickSheet, type FixtureDraft,
} from '@/features/knockouts/KnockoutParts';
import { openMatch } from '@/features/matches/openMatch';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// The knockout stage. Everyone sees it: each side's team, or where it comes from ("Group A winner",
// "Winner of Semi-final 1") until that's known. Owners set it up — a format that fits the groups, or
// one match at a time — and can put a team in a side by hand. The server fills the sides in as
// results come in; this screen only draws what it says.

export default function KnockoutScreen() {
  const router = useRouter();
  const theme = useSportTheme();
  const t = useTournament();
  const canEdit = t.access.canEdit;
  const canScore = t.access.canScore;
  const action = useAction();
  const teams = useTeams(t.id);

  const stageFetcher = useCallback(() => api.call<KnockoutStage>('KNOCKOUT_GET', { routeParams: { id: t.id } }), [t.id]);
  const stage = useQuery(stageFetcher, { pollMs: 15000 });
  const presetsFetcher = useCallback(() => api.call<KnockoutPreset[]>('KNOCKOUT_PRESETS', { routeParams: { id: t.id } }), [t.id]);
  const presets = useQuery(presetsFetcher, { enabled: canEdit && stage.data?.started === false });

  const [thirdPlace, setThirdPlace] = useState<Record<string, boolean>>({});
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [endDraft, setEndDraft] = useState<string | null>(null);
  const [picking, setPicking] = useState<{ fixture: KnockoutFixture; side: 'Home' | 'Away' } | null>(null);
  const [draft, setDraft] = useState<FixtureDraft | null>(null);

  const s = stage.data;
  if (!s) return <Screen error={stage.error} onRetry={stage.refresh}><Skeleton rows={3} height={140} /></Screen>;

  const tournament = t.query.data;
  const needsDates = !tournament?.startDate || !tournament?.endDate;
  const startDate = startDraft ?? tournament?.startDate ?? todayValue();
  const endDate = endDraft ?? tournament?.endDate ?? todayValue(7);
  const show = (next: KnockoutStage) => stage.setData(next);

  const choosePreset = async (p: KnockoutPreset) => {
    if (s.fixtures.length > 0) {
      const ok = await confirm({
        title: `Use "${p.name}"?`,
        message: `It replaces the ${plural(s.fixtures.length, 'knockout match', 'knockout matches')} set up now.`,
        confirmLabel: 'Replace',
      });
      if (!ok) return;
    }
    const res = await action.run(() =>
      api.call<KnockoutStage>('KNOCKOUT_APPLY', {
        routeParams: { id: t.id },
        body: { preset: p.id, thirdPlace: !!thirdPlace[p.id], ...(needsDates ? { startDate, endDate } : {}) },
      }),
    );
    if (!res.ok) return;
    haptic.success();
    show(res.value);
    if (needsDates) t.query.reload();
  };

  const clear = async () => {
    const ok = await confirm({ title: 'Remove the knockout stage?', message: 'Every knockout match goes. You can set it up again any time.', confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
    const res = await action.run(() => api.call<KnockoutStage>('KNOCKOUT_CLEAR', { routeParams: { id: t.id } }));
    if (res.ok) show(res.value);
  };

  const remove = async (f: KnockoutFixture) => {
    const ok = await confirm({ title: `Delete ${f.label}?`, message: 'The match is taken out of the knockout stage.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    const res = await action.run(() => api.call<KnockoutStage>('KNOCKOUT_FIXTURE_DELETE', { routeParams: { id: t.id, fixtureId: f.id } }));
    if (res.ok) show(res.value);
  };

  const pick = async (teamId: number | null) => {
    if (!picking) return;
    const res = await action.run(() =>
      api.call<KnockoutStage>('KNOCKOUT_TEAM_SET', { routeParams: { id: t.id, fixtureId: picking.fixture.id }, body: { side: picking.side, teamId } }),
    );
    if (!res.ok) return;
    haptic.select();
    show(res.value);
    setPicking(null);
  };

  const save = async () => {
    if (!draft) return;
    const body = { round: draft.round, label: draft.label.trim() || null, home: slotBody(draft.home), away: slotBody(draft.away) };
    const res = await action.run(() =>
      draft.fixtureId
        ? api.call<KnockoutStage>('KNOCKOUT_FIXTURE_UPDATE', { routeParams: { id: t.id, fixtureId: draft.fixtureId }, body })
        : api.call<KnockoutStage>('KNOCKOUT_FIXTURE_ADD', { routeParams: { id: t.id }, body }),
    );
    if (!res.ok) return;
    haptic.success();
    show(res.value);
    setDraft(null);
  };

  // The match screens take a match card; the bracket knows enough to make one.
  const open = (f: KnockoutFixture) => {
    if (f.matchId == null || f.status == null) return;
    const card = {
      id: f.matchId,
      sport: t.sport,
      status: f.status,
      groupName: '',
      matchNumber: f.matchNumber ?? 0,
      homeTeamName: f.home.teamName ?? f.home.source,
      awayTeamName: f.away.teamName ?? f.away.source,
      homeTeamId: f.home.teamId,
      awayTeamId: f.away.teamId,
    } as MatchCard;
    openMatch(router, t.id, card, canScore);
  };

  const startTournament = async () => {
    const ok = await confirm({
      title: 'Start the tournament?',
      message: 'This creates every match — groups and knockouts — so they can be scored live.',
      confirmLabel: 'Start',
    });
    if (!ok) return;
    const res = await action.run(() => api.call('TOURNAMENT_START', { routeParams: { id: t.id } }));
    if (!res.ok) return;
    haptic.success();
    t.query.reload();
    stage.reload();
  };

  const fixtures = inBracketOrder(s.fixtures);

  return (
    <Screen onRefresh={stage.refresh} refreshing={stage.refreshing}>
      <SectionHeader eyebrow={t.name} title="Knockout stage" large />
      <ErrorBanner message={(draft || picking ? null : action.error)?.message ?? stage.error?.message} />

      {s.championName && (
        <Deck accessibilityLabel={`${s.championName} won the final`}>
          <View style={styles.champion}>
            <Icon name="trophy" size={32} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: theme.onDark }]}>{s.championName}</Text>
              <Text style={[type.body, { color: theme.onDarkSoft }]}>Won the final — the tournament&apos;s champions.</Text>
            </View>
          </View>
        </Deck>
      )}

      {fixtures.length === 0 ? (
        <EmptyState
          icon="tournament"
          title="No knockout stage yet"
          message={canEdit ? 'Pick a format below, or add the matches one at a time.' : "The organisers set it up when they're ready."}
        />
      ) : (
        fixtures.map((f) => (
          <KnockoutCard
            key={f.id}
            fixture={f}
            canEdit={canEdit}
            canScore={canScore}
            onOpenMatch={() => open(f)}
            onPickTeam={(side) => setPicking({ fixture: f, side })}
            onEdit={() => setDraft({ fixtureId: f.id, order: f.order, round: f.round, label: f.label, home: draftOf(f.home.slot), away: draftOf(f.away.slot) })}
            onDelete={() => remove(f)}
          />
        ))
      )}

      {canEdit && !t.isStarted && s.fixtures.length > 0 && (
        <Card>
          <Text style={[type.body, { color: theme.ink }]}>When the teams are ready, start the tournament: every match is made, groups and knockouts alike.</Text>
          <Button label="Start tournament" icon="lightning-bolt" onPress={startTournament} busy={action.busy} />
        </Card>
      )}

      {canEdit && (
        <View style={styles.row}>
          <Button
            label="Add a match"
            icon="plus"
            variant="ghost"
            onPress={() => setDraft({ fixtureId: null, order: null, round: 'SemiFinal', label: '', home: emptySlot(), away: emptySlot() })}
            style={{ flex: 1 }}
          />
          {s.fixtures.length > 0 && !s.started && (
            <Button label="Remove all" icon="trash-can-outline" variant="ghost" onPress={clear} style={{ flex: 1 }} />
          )}
        </View>
      )}

      {canEdit && !s.started && (presets.data?.length ?? 0) > 0 && (
        <View style={{ gap: space.md }}>
          <SectionHeader
            eyebrow={s.groups.length > 0 ? 'Fills in as each group finishes' : 'No groups: a random draw of every team'}
            title="Formats that fit"
          />
          {needsDates && (
            <Card>
              <Text style={[type.bodyStrong, { color: theme.ink }]}>When is it played?</Text>
              <DateField label="First day" value={startDate} onChange={setStartDraft} />
              <DateField label="Last day" value={endDate} onChange={setEndDraft} />
            </Card>
          )}
          {presets.data!.map((p) => (
            <Card key={p.id}>
              <Text style={[type.heading, { color: theme.ink }]}>{p.name}</Text>
              <Text style={[type.body, { color: theme.muted }]}>{p.description}</Text>
              <View style={{ gap: 2 }}>
                {p.fixtures.map((f, i) => (
                  <Text key={i} style={[type.caption, { color: theme.ink }]}>
                    <Text style={type.bodyStrong}>{f.label}: </Text>
                    {f.home} v {f.away}
                  </Text>
                ))}
              </View>
              {p.offersThirdPlace && (
                <SwitchRow label="Add a 3rd-place match" value={!!thirdPlace[p.id]} onChange={(v) => setThirdPlace({ ...thirdPlace, [p.id]: v })} />
              )}
              <Button label="Use this format" variant="primary" onPress={() => choosePreset(p)} busy={action.busy} />
            </Card>
          ))}
        </View>
      )}

      <TeamPickSheet
        visible={!!picking}
        onClose={() => setPicking(null)}
        fixture={picking?.fixture ?? null}
        side={picking?.side ?? 'Home'}
        teams={teams.data ?? []}
        onPick={pick}
        busy={action.busy}
      />
      <FixtureSheet
        draft={draft}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={save}
        busy={action.busy}
        error={action.error?.message}
        teams={teams.data ?? []}
        stage={s}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  champion: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
});
