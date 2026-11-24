import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Club, Team } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useAction } from '@/hooks/useAction';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// "Keep this team for other tournaments" (C-23, board Team-Keep): for the team's own admins only — never the organiser
// for being organiser — while it isn't kept yet (`team.canKeep`, from the server). Asked once when the tournament ends
// (the KeepTeam notification opens this screen with `keep=1`), and always here. A kept team links to its own page.

export function KeepTeamCard({ team, tournamentName, askNow }: { team: Team; tournamentName: string; askNow: boolean }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const asked = useRef(false);

  // From the notification: open the question once, as soon as the team says it can be kept.
  useEffect(() => {
    if (askNow && team.canKeep && !asked.current) {
      asked.current = true;
      setOpen(true);
    }
  }, [askNow, team.canKeep]);

  if (team.clubId) {
    return (
      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>{team.name} is a lasting team</Text>
        <Text style={[type.caption, { color: theme.muted }]}>Its page has every tournament it has played and its players.</Text>
        <Button
          label="Open the team’s page"
          icon="account-group-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/club/[clubId]', params: { clubId: String(team.clubId) } })}
        />
      </Card>
    );
  }
  if (!team.canKeep) return null;

  return (
    <Card>
      <Text style={[type.headline, { color: theme.ink }]}>Keep {team.name} for other tournaments</Text>
      <Text style={[type.caption, { color: theme.muted }]}>
        It becomes one of your teams. Next time, the same players come along. Only the team’s admins see this.
      </Text>
      <Button label={`Keep ${team.name}`} icon="content-save-outline" variant="secondary" onPress={() => setOpen(true)} />
      <KeepTeamSheet visible={open} onClose={() => setOpen(false)} team={team} tournamentName={tournamentName} />
    </Card>
  );
}

function KeepTeamSheet({ visible, onClose, team, tournamentName }: { visible: boolean; onClose: () => void; team: Team; tournamentName: string }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
  const action = useAction();
  const others = Math.max(0, 3 - (team.admins?.length ?? 1));

  const keep = async () => {
    const res = await action.run(() => api.call<Club>('CLUB_FROM_TEAM', { routeParams: { id: team.tournamentId, teamId: team.id } }));
    if (!res.ok) return;
    haptic.success();
    onClose();
    router.push({ pathname: '/club/[clubId]', params: { clubId: String(res.value.clubId), sport: res.value.sport } });
  };

  const points = [
    `All ${plural(team.players.length, 'player')}, with their shirt numbers and roles`,
    (team.admins?.length ?? 0) > 1
      ? `You and the team’s other admins run it${others > 0 ? `; add up to ${others} more later` : ''}`
      : 'You run it; add up to 2 more admins later',
    `${tournamentName} counts in its record`,
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Keep ${team.name} for your next tournament?`}
      subtitle={`${team.name} becomes one of your teams. Next time, enter a tournament and the same players come along.`}
      footer={
        <>
          <Button label="Not now" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label={`Keep ${team.name}`} icon="check" onPress={keep} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      {points.map((p) => (
        <View key={p} style={styles.point}>
          <Icon name="check" size={20} color={theme.successInk} />
          <Text style={[type.body, { color: theme.ink, flex: 1 }]}>{p}</Text>
        </View>
      ))}
      <Text style={[type.caption, { color: theme.muted }]}>
        Asked once when the tournament ends, and always here. Only the team’s admins see this; the organiser doesn’t.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});
