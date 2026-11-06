import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { BattingStyle, BowlingArm, BowlingType, CricketRole, Player, PlayerLookup, Team } from '@/api/types';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import TextField from '@/components/TextField';
import { LINES } from '@/features/teams/positions';
import { useAction } from '@/hooks/useAction';
import { useAuthOptions } from '@/hooks/useAuthOptions';
import {
  BATTING_STYLES,
  BOWLING_ARMS,
  BOWLING_TYPES,
  bowlingStyleLabel,
  CRICKET_ROLES,
  roleBowls,
} from '@/lib/cricketLabels';
import { confirm } from '@/lib/confirm';
import { capitalizeWords, formatPhone } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// Add or edit a player. Football asks for a shirt number and a position; cricket asks for the
// role, how they bat and — only if they bowl — how they bowl, and names the style as it's picked
// ("Slow left-arm orthodox"). Team-mates may share a shirt number; the sheet just says who else wears it.
//
// Adding starts from the player's email or number: if an account uses it, the sheet shows the
// person and adds them without a name (their account's name is used). Otherwise, or with
// "Add someone without an email or number", it's the full form.
//
// The optional email (and, once the server can text codes, mobile number) links the place to the
// player's account — now, or when they sign up with it. Once linked, the name and cricket profile are theirs (they edit them on their Account screen), so
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
  const { type } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
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
  const options = useAuthOptions();
  const showPhone = options.phone || !!player?.phone;
  const [phone, setPhone] = useState(formatPhone(player?.phone));
  const linked = !!player?.isLinked;

  // Adding: find (email or number) → account (the person found) or form (no account / by name).
  const [step, setStep] = useState<'find' | 'account' | 'form'>(player ? 'form' : 'find');
  const [contact, setContact] = useState('');
  const [found, setFound] = useState<PlayerLookup | null>(null);
  const [notFoundNote, setNotFoundNote] = useState('');

  const jerseyNum = jersey.trim() === '' ? null : Number(jersey);
  const alsoWearing =
    jerseyNum == null ? [] : team.players.filter((p) => p.jerseyNumber === jerseyNum && p.id !== player?.id).map((p) => p.name);
  const jerseyInvalid = jersey.trim() !== '' && (!Number.isInteger(jerseyNum) || (jerseyNum ?? 0) < 0 || (jerseyNum ?? 0) > 999);
  const bowls = roleBowls(role);

  const lookUp = async () => {
    const res = await action.run(() =>
      api.call<PlayerLookup>('PLAYER_CONTACT_LOOKUP', {
        routeParams: { id: tournamentId, teamId: team.id },
        body: { contact: contact.trim() },
      }),
    );
    if (!res.ok) return;
    const result = res.value;
    if (result.found) {
      setFound(result);
      setStep('account');
      return;
    }
    // Nobody yet: the full form, with the email or number already in its field.
    if (result.kind === 'Email') setEmail(result.contact);
    else setPhone(formatPhone(result.contact));
    setNotFoundNote(
      `No account uses ${result.display} yet. Add their name; they'll be linked when they sign up.` +
        (result.waitingIn ? ` (A place in ${result.waitingIn} is already waiting on it.)` : ''),
    );
    setStep('form');
  };

  const startOver = () => {
    action.clearError();
    setFound(null);
    setNotFoundNote('');
    setStep('find');
  };

  const addFound = async () => {
    if (!found || found.playsFor || jerseyInvalid) return;
    const body = {
      [found.kind === 'Email' ? 'email' : 'phone']: found.contact,
      jerseyNumber: jerseyNum,
      position: isCricket ? null : position.trim() || null,
    };
    const res = await action.run(async () => {
      const saved = await api.call<Player>('PLAYER_CREATE', { routeParams: { id: tournamentId, teamId: team.id }, body });
      if (isCricket && captain) {
        await api.call('TEAM_UPDATE', {
          routeParams: { id: tournamentId, teamId: team.id },
          body: { name: team.name, defaultCaptainPlayerId: saved.id, setCaptain: true },
        });
      }
      return saved;
    });
    if (!res.ok) return;
    haptic.success();
    onSaved();
    onClose();
  };

  const save = async () => {
    if (step === 'find') return lookUp();
    if (step === 'account') return addFound();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Every player needs a name.');
      return;
    }
    if (jerseyInvalid) return;

    const body = {
      name: trimmed,
      // Always sent: "" clears it (and unlinks the place unless the number still matches).
      email: email.trim(),
      // Only while the field is shown; otherwise the number is left as it is.
      phone: showPhone ? phone.trim() : undefined,
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
      message: `Their name stays on ${team.name}; it just won't be linked to ${player.email ?? (formatPhone(player.phone) || 'their account')} any more.`,
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

  const shirtField = (
    <TextField
      label="Shirt number (optional)"
      value={jersey}
      onChangeText={(v) => setJersey(v.replace(/[^0-9]/g, ''))}
      placeholder="e.g. 9"
      keyboardType="number-pad"
      maxLength={3}
      error={jerseyInvalid ? 'Use a whole number.' : undefined}
      hint={alsoWearing.length > 0 ? `Also worn by ${alsoWearing.join(', ')}` : undefined}
    />
  );

  const positionFields = (
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
  );

  const primaryLabel =
    step === 'find' ? 'Find' : step === 'account' ? `Add to ${team.name}` : player ? 'Save changes' : 'Add to squad';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={player ? 'Edit player' : 'Add player'}
      subtitle={team.name}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={primaryLabel}
            icon={step === 'find' ? 'account-search-outline' : 'check'}
            onPress={save}
            busy={action.busy}
            disabled={(step === 'find' && contact.trim() === '') || (step === 'account' && !!found?.playsFor)}
            style={{ flex: 2 }}
          />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      {step === 'find' ? (
        <>
          <TextField
            label={options.phone ? 'Their email or mobile number' : 'Their sign-in email'}
            value={contact}
            onChangeText={setContact}
            placeholder={options.phone ? 'e.g. rahul@example.com or 98765 43210' : 'e.g. rahul@example.com'}
            keyboardType={options.phone ? 'default' : 'email-address'}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="search"
            onSubmitEditing={lookUp}
            hint="If they have an account, you'll see their name and can add them straight away."
          />
          <Button label="Add someone without an email or number" variant="ghost" onPress={() => setStep('form')} />
        </>
      ) : step === 'account' && found ? (
        <>
          <View style={[styles.found, { backgroundColor: theme.chip }]} accessibilityRole="summary">
            <Text style={[type.bodyStrong, { color: theme.ink }]}>{found.name}</Text>
            <Text style={[type.caption, { color: theme.muted }]}>
              {found.playsFor
                ? `Already plays for ${found.playsFor} in this tournament, so they can't join another team.`
                : `Has an account (${found.display}). Their own name${isCricket ? ' and cricket profile are' : ' is'} used.`}
            </Text>
          </View>
          <Button label="Use another email or number" variant="ghost" onPress={startOver} />
          {!found.playsFor && (
            <>
              {shirtField}
              {isCricket ? (
                <SwitchRow label="Team captain" hint="Pre-selected as captain when an XI is picked" value={captain} onChange={setCaptain} />
              ) : (
                positionFields
              )}
            </>
          )}
        </>
      ) : (
        <>
          {notFoundNote !== '' && <Text style={[type.body, { color: theme.muted }]}>{notFoundNote}</Text>}
          <TextField
            label="Player name"
            value={name}
            onChangeText={(v) => {
              setName(capitalizeWords(v));
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
          {showPhone && (
            <TextField
              label="Their mobile number (optional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 98765 43210"
              keyboardType="phone-pad"
              autoComplete="off"
              hint={
                linked
                  ? 'Either the email or the number keeps them linked.'
                  : player?.phone
                    ? 'Links when they sign in with this number.'
                    : 'Or their number: links when they sign in with it.'
              }
            />
          )}
          {shirtField}

          {!isCricket ? (
            positionFields
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
        </>
      )}

      {player?.isLinked && (
        <Button
          label="View profile"
          icon="account-details-outline"
          variant="secondary"
          onPress={() => {
            onClose();
            router.push({ pathname: '/profile', params: { playerId: String(player.id) } });
          }}
        />
      )}
      {player && (linked || player.email || player.phone) && (
        <Button label="Unlink from account" icon="link-variant-off" variant="secondary" onPress={unlink} disabled={action.busy} />
      )}
      {player && <Button label="Remove from squad" icon="trash-can-outline" variant="danger" onPress={remove} disabled={action.busy} />}
    </Sheet>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const { type } = useTypography();
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
  found: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
});
