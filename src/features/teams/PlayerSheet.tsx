import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { BattingStyle, BowlingArm, BowlingType, CricketRole, Player, Team } from '@/api/types';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import TextField from '@/components/TextField';
import { LINES } from '@/features/teams/positions';
import { useAction } from '@/hooks/useAction';
import {
  BATTING_STYLES,
  BOWLING_ARMS,
  BOWLING_TYPES,
  bowlingStyleLabel,
  CRICKET_ROLES,
  roleBowls,
} from '@/lib/cricketLabels';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// Add or edit a player. Football asks for a shirt number and a position; cricket asks for the
// role, how they bat and — only if they bowl — how they bowl, and names the style as it's picked
// ("Slow left-arm orthodox"). The server has the final word on clashes (a taken shirt number).
//
// The optional email links the place to the player's account — now, or when they sign up. Once
// linked, the name and cricket profile are theirs (they edit them on their Account screen), so
// those fields are shown locked here; an owner can unlink a wrong match.

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  tournamentId: number;
  team: Team;
  /** Null to add a new player. */
  player: Player | null;
  sport: 'Football' | 'Cricket';
};

/**
 * The parent gives this a fresh `key` each time it opens, so the fields start from the player
 * being edited — and keeps it mounted while closing, so the sheet can animate away.
 */
export default function PlayerSheet({ visible, onClose, onSaved, tournamentId, team, player, sport }: Props) {
  const theme = useSportTheme();
  const action = useAction();
  const isCricket = sport === 'Cricket';

  const [name, setName] = useState(player?.name ?? '');
  const [jersey, setJersey] = useState(player?.jerseyNumber != null ? String(player.jerseyNumber) : '');
  const [position, setPosition] = useState(player?.position ?? '');
  const [role, setRole] = useState<CricketRole>(player?.cricket?.primaryRole ?? 'Batter');
  const [bat, setBat] = useState<BattingStyle | null>(player?.cricket?.battingStyle ?? null);
  const [arm, setArm] = useState<BowlingArm | null>(player?.cricket?.bowlingArm ?? null);
  const [bowl, setBowl] = useState<BowlingType | null>(player?.cricket?.bowlingType ?? null);
  const [order, setOrder] = useState(player?.cricket?.battingOrderPreference ?? 0);
  const wasCaptain = !!player && team.defaultCaptainPlayerId === player.id;
  const [captain, setCaptain] = useState(wasCaptain);
  const [nameError, setNameError] = useState('');
  const [email, setEmail] = useState(player?.email ?? '');
  const linked = !!player?.isLinked;

  const jerseyNum = jersey.trim() === '' ? null : Number(jersey);
  const jerseyTaken =
    jerseyNum != null && team.players.some((p) => p.jerseyNumber === jerseyNum && p.id !== player?.id);
  const jerseyInvalid = jersey.trim() !== '' && (!Number.isInteger(jerseyNum) || (jerseyNum ?? 0) < 0 || (jerseyNum ?? 0) > 999);
  const bowls = roleBowls(role);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Every player needs a name.');
      return;
    }
    if (jerseyInvalid) return;

    const body = {
      name: trimmed,
      // Always sent: "" clears it and unlinks the place.
      email: email.trim(),
      jerseyNumber: jerseyNum,
      position: isCricket ? player?.position ?? null : position.trim() || null,
      cricket: isCricket
        ? {
            primaryRole: role,
            battingStyle: bat,
            // Half a bowling style is rejected by the API, so both halves or neither.
            bowlingArm: bowls && arm && bowl ? arm : null,
            bowlingType: bowls && arm && bowl ? bowl : null,
            battingOrderPreference: order > 0 ? order : null,
          }
        : undefined,
    };

    const res = await action.run(async () => {
      const saved = player
        ? await api.call<Player>('PLAYER_UPDATE', { routeParams: { id: tournamentId, teamId: team.id, playerId: player.id }, body })
        : await api.call<Player>('PLAYER_CREATE', { routeParams: { id: tournamentId, teamId: team.id }, body });
      if (isCricket && captain !== wasCaptain) {
        await api.call('TEAM_UPDATE', {
          routeParams: { id: tournamentId, teamId: team.id },
          body: { name: team.name, defaultCaptainPlayerId: captain ? saved.id : null, setCaptain: true },
        });
      }
      return saved;
    });
    if (!res.ok) return;
    haptic.success();
    onSaved();
    onClose();
  };

  // A wrong match: the place goes back to being just a name.
  const unlink = async () => {
    if (!player) return;
    const ok = await confirm({
      title: `Unlink ${player.name}?`,
      message: `Their name stays on ${team.name}; it just won't be linked to ${player.email ?? 'their account'} any more.`,
      confirmLabel: 'Unlink',
    });
    if (!ok) return;
    const res = await action.run(() =>
      api.call('PLAYER_UNLINK', { routeParams: { id: tournamentId, teamId: team.id, playerId: player.id } }),
    );
    if (res.ok) {
      haptic.success();
      onSaved();
      onClose();
    }
  };

  const remove = async () => {
    if (!player) return;
    const ok = await confirm({
      title: `Remove ${player.name}?`,
      message: `They'll be taken off ${team.name}'s squad.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() =>
      api.call('PLAYER_DELETE', { routeParams: { id: tournamentId, teamId: team.id, playerId: player.id } }),
    );
    if (res.ok) {
      haptic.heavy();
      onSaved();
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={player ? 'Edit player' : 'Add player'}
      subtitle={team.name}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label={player ? 'Save changes' : 'Add to squad'} icon="check" onPress={save} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <TextField
        label="Player name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (nameError) setNameError('');
        }}
        placeholder="e.g. J. Henderson"
        autoCapitalize="words"
        returnKeyType="next"
        error={nameError}
        editable={!linked}
        hint={linked ? 'Their account name — they change it themselves.' : undefined}
      />
      <TextField
        label="Their sign-in email (optional)"
        value={email}
        onChangeText={setEmail}
        placeholder="e.g. rahul@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        hint={
          linked
            ? 'Linked to their account.'
            : player?.email
              ? 'Links when they sign up with this email.'
              : 'Links this place to their account — now, or when they sign up.'
        }
      />
      <TextField
        label="Shirt number (optional)"
        value={jersey}
        onChangeText={(v) => setJersey(v.replace(/[^0-9]/g, ''))}
        placeholder="e.g. 9"
        keyboardType="number-pad"
        maxLength={3}
        error={jerseyInvalid ? 'Use a whole number.' : jerseyTaken ? `Number ${jerseyNum} is already taken on this team.` : undefined}
        hint={jerseyNum != null && !jerseyTaken ? `Number ${jerseyNum} is free` : undefined}
      />

      {!isCricket ? (
        <View style={{ gap: space.sm }}>
          <Text style={[type.label, { color: theme.muted }]}>Position</Text>
          <View style={styles.wrap}>
            {LINES.map((l) => (
              <Chip key={l.key} label={l.key} onCard selected={position.trim().toUpperCase() === l.key} onPress={() => setPosition(l.key)} accessibilityLabel={l.label} />
            ))}
          </View>
          <TextField
            label="Or type a position"
            value={position}
            onChangeText={setPosition}
            placeholder="e.g. Left wing, CB"
            autoCapitalize="characters"
          />
        </View>
      ) : linked ? (
        <>
          <Text style={[type.body, { color: theme.muted }]}>
            {`${name} keeps their own cricket profile on their account; it's used in every team they're linked to.`}
          </Text>
          <SwitchRow label="Team captain" hint="Pre-selected as captain when an XI is picked" value={captain} onChange={setCaptain} />
        </>
      ) : (
        <>
          <Group label="Role">
            {CRICKET_ROLES.map((r) => (
              <Chip key={r.value} label={r.label} onCard selected={role === r.value} onPress={() => setRole(r.value)} />
            ))}
          </Group>
          <Group label="Bats">
            {BATTING_STYLES.map((b) => (
              <Chip key={b.value} label={b.label} onCard selected={bat === b.value} onPress={() => setBat(bat === b.value ? null : b.value)} />
            ))}
          </Group>
          {bowls && (
            <>
              <Group label="Bowling arm">
                {BOWLING_ARMS.map((a) => (
                  <Chip key={a.value} label={a.label} onCard selected={arm === a.value} onPress={() => setArm(a.value)} />
                ))}
              </Group>
              <Group label="Bowling type">
                {BOWLING_TYPES.map((b) => (
                  <Chip key={b.value} label={b.label} onCard selected={bowl === b.value} onPress={() => setBowl(b.value)} />
                ))}
              </Group>
              <Text style={[type.bodyStrong, { color: arm && bowl ? theme.successInk : theme.muted }]}>
                {bowlingStyleLabel(arm, bowl) ?? 'Pick an arm and a type to name the style.'}
              </Text>
            </>
          )}
          <Stepper
            label="Usual batting position"
            hint="Pre-fills the batting order when an XI is picked"
            value={order}
            min={0}
            max={11}
            display={order === 0 ? 'Any' : String(order)}
            onChange={setOrder}
          />
          <SwitchRow label="Team captain" hint="Pre-selected as captain when an XI is picked" value={captain} onChange={setCaptain} />
        </>
      )}

      {player && (linked || player.email) && (
        <Button label="Unlink from account" icon="link-variant-off" variant="secondary" onPress={unlink} disabled={action.busy} />
      )}
      {player && <Button label="Remove from squad" icon="trash-can-outline" variant="danger" onPress={remove} disabled={action.busy} />}
    </Sheet>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const theme = useSportTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.label, { color: theme.muted }]}>{label}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
