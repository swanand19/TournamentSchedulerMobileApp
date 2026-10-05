import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Tournament, TournamentMember } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import DateField, { formatDay, todayValue } from '@/components/DateField';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import TextField from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// A tournament's people and settings: its name and dates, completing it, its owners and scorers,
// and leaving. What each person may do comes from the tournament's `access` — the server decides;
// this screen only shows what it allows.

const STATUS_TEXT: Record<string, string> = {
  Upcoming: 'Not started yet.',
  Live: 'In play.',
  Completed: 'Completed — nothing can be started or changed any more.',
  Cancelled: 'Cancelled — it never started and its dates have passed.',
};

type Role = 'Scorer' | 'Owner';

export default function PeopleScreen() {
  const router = useRouter();
  const theme = useSportTheme();
  const t = useTournament();
  const tournament = t.query.data;
  const access = t.access;
  const action = useAction();

  const membersFetcher = useCallback(() => api.call<TournamentMember[]>('TOURNAMENT_MEMBER_LIST', { routeParams: { id: t.id } }), [t.id]);
  const members = useQuery(membersFetcher);

  // What's typed, or — until something is — what's saved.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [startDraft, setStartDraft] = useState<string | null>(null);
  const [endDraft, setEndDraft] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('Scorer');

  if (!tournament) return <Screen error={t.query.error} onRetry={t.query.refresh}><Skeleton rows={3} height={120} /></Screen>;

  // Tournaments from before dates existed start the pickers at today and a week on.
  const name = nameDraft ?? tournament.name;
  const startDate = startDraft ?? tournament.startDate ?? todayValue();
  const endDate = endDraft ?? tournament.endDate ?? todayValue(7);
  const changed = name.trim() !== tournament.name || startDate !== (tournament.startDate ?? '') || endDate !== (tournament.endDate ?? '');

  const saveDetails = async () => {
    const res = await action.run(() =>
      api.call<Tournament>('TOURNAMENT_UPDATE', { routeParams: { id: t.id }, body: { name: name.trim(), startDate, endDate } }),
    );
    if (!res.ok) return;
    haptic.success();
    t.query.setData(res.value);
    setNameDraft(null);
    setStartDraft(null);
    setEndDraft(null);
  };

  const complete = async () => {
    const ok = await confirm({
      title: `Mark ${tournament.name} complete?`,
      message: "Nothing can be started or changed afterwards. This can't be undone.",
      confirmLabel: 'Mark complete',
    });
    if (!ok) return;
    const res = await action.run(() => api.call<Tournament>('TOURNAMENT_COMPLETE', { routeParams: { id: t.id }, body: {} }));
    if (res.ok) {
      haptic.success();
      t.query.setData(res.value);
    }
  };

  const add = async () => {
    const res = await action.run(() =>
      api.call<TournamentMember[]>('TOURNAMENT_MEMBER_ADD', { routeParams: { id: t.id }, body: { email: email.trim(), role } }),
    );
    if (!res.ok) return;
    haptic.success();
    members.setData(res.value);
    setEmail('');
  };

  const remove = async (m: TournamentMember) => {
    const ok = await confirm({ title: `Remove ${m.name}?`, message: 'They lose access to this tournament.', confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
    const res = await action.run(() => api.call<TournamentMember[]>('TOURNAMENT_MEMBER_REMOVE', { routeParams: { id: t.id, userId: m.userId } }));
    if (res.ok) members.setData(res.value);
  };

  const leave = async () => {
    const ok = await confirm({
      title: `Leave ${tournament.name}?`,
      message: 'It disappears from your list until an owner adds you again.',
      confirmLabel: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call('TOURNAMENT_LEAVE', { routeParams: { id: t.id }, body: {} }));
    if (res.ok) router.dismissTo('/');
  };

  return (
    <Screen error={action.error ?? members.error} onRetry={members.refresh} onRefresh={members.refresh} refreshing={members.refreshing}>
      {/* --- The tournament itself --- */}
      <Card>
        <SectionHeader onCard title="Tournament" />
        <Text style={[type.body, { color: theme.muted }]}>{STATUS_TEXT[tournament.status] ?? ''}</Text>
        {access.canEdit ? (
          <>
            <TextField label="Name" value={name} onChangeText={setNameDraft} editable={!action.busy} maxLength={200} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DateField label="Starts" value={startDate} onChange={setStartDraft} disabled={action.busy} />
              </View>
              <View style={{ flex: 1 }}>
                <DateField label="Ends" value={endDate} onChange={setEndDraft} disabled={action.busy} />
              </View>
            </View>
            <Text style={[type.caption, { color: theme.muted }]}>Rain delay? Move the end date. It completes by itself the day after it ends.</Text>
            <Button label="Save" variant="secondary" busy={action.busy} disabled={!changed} onPress={saveDetails} />
          </>
        ) : (
          <Text style={[type.bodyStrong, { color: theme.ink }]}>
            {tournament.startDate && tournament.endDate ? `${formatDay(tournament.startDate)} – ${formatDay(tournament.endDate)}` : 'No dates set.'}
          </Text>
        )}
        {access.canComplete && (
          <Button label="Mark tournament complete" icon="flag-checkered" variant="success" busy={action.busy} onPress={complete} />
        )}
        {!access.canComplete && access.canEdit && tournament.status === 'Live' && (
          <Text style={[type.caption, { color: theme.muted }]}>A match is being played. Finish it before completing the tournament.</Text>
        )}
      </Card>

      {/* --- People --- */}
      <Card>
        <SectionHeader onCard title="Owners and scorers" />
        <Text style={[type.body, { color: theme.muted }]}>Owners run the tournament. Scorers can only set up and score matches.</Text>
        {!members.data ? (
          members.error ? null : <Skeleton rows={2} height={48} />
        ) : (
          members.data.map((m) => (
            <View key={m.userId} style={[styles.member, { borderTopColor: theme.cardDivider }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.bodyStrong, { color: theme.ink }]}>
                  {m.name}
                  {m.isMe ? <Text style={[type.body, { color: theme.muted }]}> (you)</Text> : null}
                </Text>
                {m.email ? <Text style={[type.caption, { color: theme.muted }]}>{m.email}</Text> : null}
                <Text style={[type.label, { color: theme.muted }]}>{m.role === 'Creator' ? 'CREATOR · OWNER' : m.role.toUpperCase()}</Text>
              </View>
              {m.canRemove && <Button label="Remove" size="sm" variant="secondary" disabled={action.busy} onPress={() => remove(m)} />}
            </View>
          ))
        )}

        {access.canManageMembers && (
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <TextField
              label="Add someone by the email they signed in with"
              value={email}
              onChangeText={setEmail}
              placeholder="friend@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!action.busy}
            />
            <SegmentedControl
              accessibilityLabel="Role"
              segments={[{ key: 'Scorer', label: 'Scorer' }, { key: 'Owner', label: 'Owner' }]}
              value={role}
              onChange={(r) => setRole(r as Role)}
            />
            <Button label="Add" icon="account-plus-outline" busy={action.busy} disabled={!email.trim()} onPress={add} />
          </View>
        )}
      </Card>

      {access.canLeave && <Button label="Leave this tournament" variant="ghost" disabled={action.busy} onPress={leave} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
});
