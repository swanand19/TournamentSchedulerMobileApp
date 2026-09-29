import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import type { Team } from '@/api/types';
import { TeamBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useAction } from '@/hooks/useAction';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, lip, radius, space, type } from '@/theme/theme';

// The tournament's teams. Before kick-off the organiser adds and removes sides here; once the
// tournament has started the fixtures depend on them, so the list becomes read-only (squads stay
// editable — players still get injured).

type Props = {
  tournamentId: number;
  teams: Team[];
  editable: boolean;
  onChanged: () => void;
};

export default function TeamsList({ tournamentId, teams, editable, onChanged }: Props) {
  const router = useRouter();
  const theme = useSportTheme();
  const action = useAction();
  const [name, setName] = useState('');

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await action.run(() => api.call('TEAM_CREATE', { routeParams: { id: tournamentId }, body: { name: trimmed } }));
    if (!res.ok) return;
    haptic.success();
    setName('');
    onChanged();
  };

  const remove = async (team: Team) => {
    const ok = await confirm({
      title: `Remove ${team.name}?`,
      message: `${plural(team.players.length, 'player')} will be removed with the team. Any schedule already built that includes them will need rebuilding.`,
      confirmLabel: 'Remove team',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call('TEAM_DELETE', { routeParams: { id: tournamentId, teamId: team.id } }));
    if (res.ok) {
      haptic.heavy();
      onChanged();
    }
  };

  const open = (team: Team) =>
    router.push({ pathname: '/tournament/[id]/team/[teamId]', params: { id: String(tournamentId), teamId: String(team.id) } });

  return (
    <View style={{ gap: space.md }}>
      <ErrorBanner message={action.error?.message} />

      {editable && (
        <Card>
          <Text style={[type.headline, { color: theme.ink }]} nativeID="add-team-label">
            Add a team
          </Text>
          <View style={styles.addRow}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rovers FC"
              placeholderTextColor={theme.placeholderInk}
              returnKeyType="done"
              onSubmitEditing={add}
              editable={!action.busy}
              accessibilityLabelledBy="add-team-label"
              style={[styles.input, { backgroundColor: theme.chip, color: theme.ink }]}
            />
            <Button label="Add" icon="plus" onPress={add} busy={action.busy} disabled={!name.trim()} />
          </View>
        </Card>
      )}

      {teams.length === 0 ? (
        <EmptyState icon="shield-outline" title="No teams yet" message="Add at least two teams to draw groups and build the fixtures." />
      ) : (
        teams.map((team) => {
          const captain = team.players.find((p) => p.id === team.defaultCaptainPlayerId);
          return (
            <PressableScale
              key={team.id}
              onPress={() => open(team)}
              onLongPress={editable ? () => remove(team) : undefined}
              accessibilityLabel={`${team.name}, ${plural(team.players.length, 'player')}`}
              accessibilityHint="Opens the squad"
              accessibilityActions={editable ? [{ name: 'delete', label: 'Remove team' }] : undefined}
              onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && remove(team)}
              style={[styles.row, { backgroundColor: theme.cream }, lip(theme)]}
            >
              <TeamBadge name={team.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
                  {team.name}
                </Text>
                <Text style={[type.caption, { color: theme.muted }]}>
                  {plural(team.players.length, 'player')}
                  {captain ? ` · Capt: ${captain.name}` : ''}
                </Text>
              </View>
              <Icon name="chevron-right" size={24} color={theme.muted} />
            </PressableScale>
          );
        })
      )}
      {editable && teams.length > 0 && (
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>Press and hold a team to remove it.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.md, fontFamily: fonts.bodyMedium, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.md, minHeight: 72 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22 },
});
