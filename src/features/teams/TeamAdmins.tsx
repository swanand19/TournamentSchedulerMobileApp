import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Player, Team } from '@/api/types';
import { JerseyBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Sheet from '@/components/Sheet';
import TextField from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useAuthOptions } from '@/hooks/useAuthOptions';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Who runs a team inside a tournament (2026-11-20, step 1 of docs/reusable-teams-plan.md), and the players left out
// after they had played. Owners name up to three admins — one of the team's players on the app, or anyone by email
// or number; an admin may change that squad and step down. Everything shown and allowed comes from the team answer
// (admins, canManage, canManageAdmins, leftPlayers): the server decides.

const MAX_ADMINS = 3;

export function TeamAdminsCard({ team, tournamentId, onChanged }: { team: Team; tournamentId: number; onChanged: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const action = useAction();
  const [sheet, setSheet] = useState({ open: false, key: 0 });
  const admins = team.admins ?? [];
  const meRunning = admins.some((a) => a.isMe);

  // Owners always see it (to name someone); otherwise only when someone runs the team.
  if (!team.canManageAdmins && admins.length === 0) return null;

  const remove = async (userId: number, name: string, isMe: boolean) => {
    const ok = await confirm({
      title: isMe ? `Stop running ${team.name}?` : `Remove ${name}?`,
      message: isMe
        ? "You won't be able to change its squad any more. An owner can make you an admin again."
        : `${name} won't be able to change ${team.name}'s squad any more.`,
      confirmLabel: isMe ? 'Step down' : 'Remove',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call<Team>('TEAM_ADMIN_REMOVE', { routeParams: { id: tournamentId, teamId: team.id, userId } }));
    if (res.ok) {
      haptic.heavy();
      onChanged();
    }
  };

  return (
    <Card>
      <ErrorBanner message={action.error?.message} />
      <Text style={[type.label, { color: theme.muted }]}>Team admins</Text>
      <Text style={[type.caption, { color: theme.muted }]}>
        {meRunning && !team.canManageAdmins
          ? `You run ${team.name}: add and remove its players and choose its captain. Only the organisers score matches.`
          : 'They can add and remove this team’s players and choose its captain. They can’t score matches or change other teams.'}
      </Text>
      {admins.map((a) => (
        <View key={a.userId} style={styles.adminRow}>
          <Icon name="account-tie-outline" size={22} color={theme.muted} />
          <Text style={[styles.adminName, { color: theme.ink }]} numberOfLines={1}>
            {a.name}
            {a.isMe ? ' (you)' : ''}
          </Text>
          {a.canRemove && (
            <Button
              label={a.isMe ? 'Step down' : 'Remove'}
              variant="secondary"
              size="sm"
              onPress={() => remove(a.userId, a.name, a.isMe)}
              disabled={action.busy}
            />
          )}
        </View>
      ))}
      {team.canManageAdmins && admins.length < MAX_ADMINS && (
        <Button label="Add an admin" icon="account-plus-outline" variant="secondary" onPress={() => setSheet((s) => ({ open: true, key: s.key + 1 }))} />
      )}
      <AddAdminSheet
        key={sheet.key}
        visible={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        team={team}
        tournamentId={tournamentId}
        onSaved={onChanged}
      />
    </Card>
  );
}

function AddAdminSheet({ visible, onClose, team, tournamentId, onSaved }: {
  visible: boolean;
  onClose: () => void;
  team: Team;
  tournamentId: number;
  onSaved: () => void;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const options = useAuthOptions();
  const action = useAction();
  const [contact, setContact] = useState('');
  const running = new Set((team.admins ?? []).map((a) => a.name));
  // Players on the app, who don't run it already: the usual pick is the captain.
  const candidates = team.players.filter((p) => p.isLinked && !running.has(p.name));

  const add = async (body: { playerId: number } | { contact: string }) => {
    const res = await action.run(() => api.call<Team>('TEAM_ADMIN_ADD', { routeParams: { id: tournamentId, teamId: team.id }, body }));
    if (res.ok) {
      haptic.success();
      onSaved();
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Who runs ${team.name}?`}>
      <ErrorBanner message={action.error?.message} />
      {candidates.length > 0 && (
        <>
          <Text style={[type.label, { color: theme.muted }]}>From the squad</Text>
          {candidates.map((p) => (
            <PressableScale
              key={p.id}
              onPress={() => add({ playerId: p.id })}
              disabled={action.busy}
              accessibilityLabel={`Make ${p.name} an admin`}
              style={[styles.pickRow, { borderColor: theme.cardDivider }]}
            >
              <JerseyBadge number={p.jerseyNumber} highlight={team.defaultCaptainPlayerId === p.id} />
              <Text style={[styles.adminName, { color: theme.ink }]} numberOfLines={1}>
                {p.name}
                {team.defaultCaptainPlayerId === p.id ? ' · captain' : ''}
              </Text>
              <Icon name="plus" size={22} color={theme.accent} />
            </PressableScale>
          ))}
        </>
      )}
      <TextField
        label={options.phone ? 'Or by email or mobile number' : 'Or by email'}
        value={contact}
        onChangeText={setContact}
        placeholder={options.phone ? 'captain@example.com or 98765 43210' : 'captain@example.com'}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!action.busy}
        hint="They need to have signed up already. They'll get a notification."
      />
      <Button label="Make admin" icon="check" busy={action.busy} disabled={!contact.trim()} onPress={() => add({ contact: contact.trim() })} />
    </Sheet>
  );
}

/** Players left out after they had played: still on the scorecards; the team's admins can bring one back. */
export function LeftPlayersCard({ team, tournamentId, onChanged }: { team: Team; tournamentId: number; onChanged: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const action = useAction();
  const left = team.leftPlayers ?? [];
  if (left.length === 0) return null;

  const bringBack = async (p: Player) => {
    const res = await action.run(() =>
      api.call<Team>('PLAYER_RESTORE', { routeParams: { id: tournamentId, teamId: team.id, playerId: p.id } }),
    );
    if (res.ok) {
      haptic.success();
      onChanged();
    }
  };

  return (
    <Card>
      <ErrorBanner message={action.error?.message} />
      <Text style={[type.label, { color: theme.muted }]}>Left the squad · {left.length}</Text>
      <Text style={[type.caption, { color: theme.muted }]}>They played earlier, so their runs, goals and wickets stay on the scorecards.</Text>
      {left.map((p) => (
        <View key={p.id} style={styles.adminRow}>
          <JerseyBadge number={p.jerseyNumber} />
          <Text style={[styles.adminName, { color: theme.muted }]} numberOfLines={1}>
            {p.name}
          </Text>
          {team.canManage && (
            <Button label="Bring back" variant="secondary" size="sm" onPress={() => bringBack(p)} disabled={action.busy} />
          )}
        </View>
      ))}
    </Card>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  adminRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  adminName: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
