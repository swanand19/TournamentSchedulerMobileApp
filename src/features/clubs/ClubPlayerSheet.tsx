import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { BattingStyle, BowlingArm, BowlingType, Club, ClubPlayer, ClubPlayerLookup, CricketRole } from '@/api/types';
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
import { BATTING_STYLES, BOWLING_ARMS, BOWLING_TYPES, bowlingStyleLabel, CRICKET_ROLES, roleBowls } from '@/lib/cricketLabels';
import { confirm } from '@/lib/confirm';
import { capitalizeWords, formatPhone } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// Adding or editing a lasting team's player (step 2 of the lasting-teams plan), the way a squad place is added: the
// email or number first — someone on the app is added by it, under their own name — or a name for someone who isn't.
// A linked player's name and cricket profile are theirs, so those fields are locked. The team's captain is a tick
// here (one per team: copied into each new squad as its default captain). Every change answers the whole team.

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: (club: Club) => void;
  club: Club;
  /** Null to add a new player. */
  player: ClubPlayer | null;
};

export default function ClubPlayerSheet({ visible, onClose, onSaved, club, player }: Props) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const options = useAuthOptions();
  const isCricket = club.sport === 'Cricket';
  const linked = !!player?.isLinked;

  const [name, setName] = useState(player?.name ?? '');
  const [jersey, setJersey] = useState(player?.jerseyNumber != null ? String(player.jerseyNumber) : '');
  const [position, setPosition] = useState(player?.position ?? '');
  const [role, setRole] = useState<CricketRole>(player?.cricket?.primaryRole ?? 'Batter');
  const [bat, setBat] = useState<BattingStyle | null>(player?.cricket?.battingStyle ?? null);
  const [arm, setArm] = useState<BowlingArm | null>(player?.cricket?.bowlingArm ?? null);
  const [bowl, setBowl] = useState<BowlingType | null>(player?.cricket?.bowlingType ?? null);
  const [order, setOrder] = useState(player?.cricket?.battingOrderPreference ?? 0);
  const wasCaptain = !!player?.isCaptain;
  const [captain, setCaptain] = useState(wasCaptain);
  const [email, setEmail] = useState(player?.email ?? '');
  const showPhone = options.phone || !!player?.phone;
  const [phone, setPhone] = useState(formatPhone(player?.phone));
  const [nameError, setNameError] = useState('');

  const [step, setStep] = useState<'find' | 'account' | 'form'>(player ? 'form' : 'find');
  const [contact, setContact] = useState('');
  const [found, setFound] = useState<ClubPlayerLookup | null>(null);
  const [note, setNote] = useState('');

  const jerseyNum = jersey.trim() === '' ? null : Number(jersey);
  const jerseyInvalid = jersey.trim() !== '' && (!Number.isInteger(jerseyNum) || (jerseyNum ?? 0) < 0 || (jerseyNum ?? 0) > 999);
  const alsoWearing = jerseyNum == null ? [] : club.players.filter((p) => p.jerseyNumber === jerseyNum && p.clubPlayerId !== player?.clubPlayerId).map((p) => p.name);
  const bowls = roleBowls(role);

  const lookUp = async () => {
    const res = await action.run(() => api.call<ClubPlayerLookup>('CLUB_PLAYER_LOOKUP', { routeParams: { clubId: club.clubId }, body: { contact: contact.trim() } }));
    if (!res.ok) return;
    if (res.value.found) {
      setFound(res.value);
      setStep('account');
      return;
    }
    if (res.value.kind === 'Email') setEmail(res.value.contact);
    else setPhone(formatPhone(res.value.contact));
    setNote(`No account uses ${res.value.display} yet. Add their name; they'll be linked when they sign up.`);
    setStep('form');
  };

  /** Saves, then (if the tick changed) the captain: the new player is the one the answer has that the old team didn't. */
  const finish = async (call: () => Promise<Club>) => {
    const res = await action.run(async () => {
      let saved = await call();
      if (captain !== wasCaptain) {
        const known = new Set(club.players.map((p) => p.clubPlayerId));
        const id = player?.clubPlayerId ?? saved.players.find((p) => !known.has(p.clubPlayerId))?.clubPlayerId;
        saved = await api.call<Club>('CLUB_UPDATE', {
          routeParams: { clubId: club.clubId },
          body: { name: saved.name, area: saved.area, captainClubPlayerId: captain ? id : null, setCaptain: true },
        });
      }
      return saved;
    });
    if (!res.ok) return;
    haptic.success();
    onSaved(res.value);
    onClose();
  };

  const save = async () => {
    if (step === 'find') return lookUp();
    if (jerseyInvalid) return;
    if (step === 'account' && found) {
      if (found.alreadyIn) return;
      return finish(() =>
        api.call<Club>('CLUB_PLAYER_ADD', {
          routeParams: { clubId: club.clubId },
          body: { [found.kind === 'Email' ? 'email' : 'phone']: found.contact, jerseyNumber: jerseyNum, position: isCricket ? null : position.trim() || null },
        }),
      );
    }
    if (!linked && !name.trim()) {
      setNameError('Every player needs a name.');
      return;
    }
    const body = {
      name: name.trim(),
      email: email.trim(),
      phone: showPhone ? phone.trim() : undefined,
      jerseyNumber: jerseyNum,
      position: isCricket ? null : position.trim() || null,
      cricket: isCricket
        ? {
            primaryRole: role,
            battingStyle: bat,
            bowlingArm: bowls && arm && bowl ? arm : null,
            bowlingType: bowls && arm && bowl ? bowl : null,
            battingOrderPreference: order > 0 ? order : null,
          }
        : undefined,
    };
    return finish(() =>
      player
        ? api.call<Club>('CLUB_PLAYER_UPDATE', { routeParams: { clubId: club.clubId, clubPlayerId: player.clubPlayerId }, body })
        : api.call<Club>('CLUB_PLAYER_ADD', { routeParams: { clubId: club.clubId }, body }),
    );
  };

  const remove = async () => {
    if (!player) return;
    const ok = await confirm({
      title: `Take ${player.name} off ${club.name}?`,
      message: 'Tournaments the team has already played stay as they were.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call<Club>('CLUB_PLAYER_REMOVE', { routeParams: { clubId: club.clubId, clubPlayerId: player.clubPlayerId } }));
    if (res.ok) {
      haptic.heavy();
      onSaved(res.value);
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
  const captainSwitch = <SwitchRow label="Team captain" hint="Captains the team in each new tournament it enters" value={captain} onChange={setCaptain} />;
  const positionFields = (
    <View style={{ gap: space.sm }}>
      <Text style={[type.label, { color: theme.muted }]}>Position</Text>
      <View style={styles.wrap}>
        {LINES.map((l) => (
          <Chip key={l.key} label={l.key} onCard selected={position.trim().toUpperCase() === l.key} onPress={() => setPosition(l.key)} accessibilityLabel={l.label} />
        ))}
      </View>
      <TextField label="Or type a position" value={position} onChangeText={setPosition} placeholder="e.g. Left wing, CB" autoCapitalize="characters" />
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={player ? 'Edit player' : 'Add player'}
      subtitle={club.name}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={step === 'find' ? 'Find' : step === 'account' ? `Add to ${club.name}` : player ? 'Save changes' : 'Add to team'}
            icon={step === 'find' ? 'account-search-outline' : 'check'}
            onPress={save}
            busy={action.busy}
            disabled={(step === 'find' && !contact.trim()) || (step === 'account' && !!found?.alreadyIn)}
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
              {found.alreadyIn
                ? `Already in ${club.name}.`
                : `Has an account (${found.display}). Their own name${isCricket ? ' and cricket profile are' : ' is'} used.`}
            </Text>
          </View>
          <Button
            label="Use another email or number"
            variant="ghost"
            onPress={() => {
              action.clearError();
              setFound(null);
              setStep('find');
            }}
          />
          {!found.alreadyIn && (
            <>
              {shirtField}
              {isCricket ? captainSwitch : positionFields}
            </>
          )}
        </>
      ) : (
        <>
          {note !== '' && <Text style={[type.body, { color: theme.muted }]}>{note}</Text>}
          <TextField
            label="Player name"
            value={name}
            onChangeText={(v) => {
              setName(capitalizeWords(v));
              if (nameError) setNameError('');
            }}
            placeholder="e.g. Sahil Patil"
            autoCapitalize="words"
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
            hint={linked ? 'Linked to their account.' : 'Links them to their account — now, or when they sign up.'}
          />
          {showPhone && (
            <TextField
              label="Their mobile number (optional)"
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 98765 43210"
              keyboardType="phone-pad"
              autoComplete="off"
              hint="Or their number: links when they sign in with it."
            />
          )}
          {shirtField}
          {!isCricket ? (
            <>
              {positionFields}
              {captainSwitch}
            </>
          ) : linked ? (
            <>
              <Text style={[type.body, { color: theme.muted }]}>{`${name} keeps their own cricket profile on their account.`}</Text>
              {captainSwitch}
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
              {captainSwitch}
            </>
          )}
        </>
      )}
      {player && <Button label="Take off the team" icon="trash-can-outline" variant="danger" onPress={remove} disabled={action.busy} />}
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
