import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type {
  Account,
  AccountDeletionPreview,
  BattingStyle,
  BowlingArm,
  BowlingType,
  CricketRole,
  LogoutAllResponse,
} from '@/api/types';
import { clearSession, updateSessionUser } from '@/auth/session';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import Screen from '@/components/Screen';
import Skeleton from '@/components/Skeleton';
import Stepper from '@/components/Stepper';
import TextField from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { BATTING_STYLES, BOWLING_ARMS, BOWLING_TYPES, bowlingStyleLabel, CRICKET_ROLES, roleBowls } from '@/lib/cricketLabels';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { footballTheme as theme, space, type } from '@/theme/theme';

// The signed-in person's account: their name and cricket profile (both copied to every team place
// linked to them), email, signing out — of this phone, or of every device at once (for a lost
// phone) — and deleting the account, confirmed with a code emailed to them.

export default function AccountScreen() {
  const fetcher = useCallback(() => api.call<Account>('ACCOUNT_GET'), []);
  const account = useQuery(fetcher);
  const action = useAction();
  // What's typed, or — until something is — the saved name.
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const name = draft ?? account.data?.name ?? '';

  const changed = !!account.data && name.trim() !== account.data.name;

  const save = async () => {
    const res = await action.run(() => api.call<Account>('ACCOUNT_UPDATE', { body: { name: name.trim() } }));
    if (!res.ok) return;
    haptic.success();
    account.setData(res.value);
    setDraft(null);
    updateSessionUser({ name: res.value.name });
    setSaved(true);
  };

  // Signed out on the phone even if the server can't be told: the button must always work.
  const signOut = async () => {
    await action.run(() => api.call('AUTH_LOGOUT')).finally(() => clearSession());
  };

  const signOutEverywhere = async () => {
    const ok = await confirm({
      title: 'Sign out everywhere?',
      message: 'Every phone and browser signed in to this account, this one included, will need a new code.',
      confirmLabel: 'Sign out everywhere',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call<LogoutAllResponse>('AUTH_LOGOUT_ALL'));
    if (res.ok) clearSession();
  };

  return (
    <Screen error={action.error ?? account.error} onRetry={account.refresh} onRefresh={account.refresh} refreshing={account.refreshing}>
      {!account.data ? (
        account.error ? null : <Skeleton rows={2} height={96} />
      ) : (
        <>
          <Card>
            <TextField
              label="Name"
              value={name}
              onChangeText={(v) => {
                setDraft(v);
                setSaved(false);
              }}
              maxLength={100}
              autoCapitalize="words"
              editable={!action.busy}
              returnKeyType="done"
              onSubmitEditing={() => changed && save()}
              hint={saved ? 'Saved.' : undefined}
            />
            <Button label="Save name" onPress={save} busy={action.busy} disabled={!changed} variant="secondary" />
            <View style={styles.facts}>
              <Fact label="Email" value={account.data.email ?? '—'} />
              <Fact label="Member since" value={new Date(/Z$|[+-]\d\d:\d\d$/.test(account.data.memberSince) ? account.data.memberSince : `${account.data.memberSince}Z`).toLocaleDateString()} />
            </View>
          </Card>

          <CricketProfileCard account={account.data} onSaved={account.setData} />

          <View style={{ gap: space.sm }}>
            <Button label="Sign out" icon="logout" onPress={signOut} busy={action.busy} variant="deck" size="lg" />
            <Button label="Sign out on all devices" onPress={signOutEverywhere} disabled={action.busy} variant="ghost" />
          </View>

          {account.data.canDelete && <DeleteAccount />}
        </>
      )}
    </Screen>
  );
}

/** Their own cricket profile: used in every cricket team they're linked to. Saved on its own. */
function CricketProfileCard({ account, onSaved }: { account: Account; onSaved: (a: Account) => void }) {
  const action = useAction();
  const c = account.cricket;
  const [role, setRole] = useState<CricketRole>(c?.primaryRole ?? 'Batter');
  const [bat, setBat] = useState<BattingStyle | null>(c?.battingStyle ?? null);
  const [arm, setArm] = useState<BowlingArm | null>(c?.bowlingArm ?? null);
  const [bowl, setBowl] = useState<BowlingType | null>(c?.bowlingType ?? null);
  const [order, setOrder] = useState(c?.battingOrderPreference ?? 0);
  const [saved, setSaved] = useState(false);
  const bowls = roleBowls(role);

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
  };

  const save = async () => {
    const cricket = {
      primaryRole: role,
      battingStyle: bat,
      // Half a bowling style is rejected by the API, so both halves or neither.
      bowlingArm: bowls && arm && bowl ? arm : null,
      bowlingType: bowls && arm && bowl ? bowl : null,
      battingOrderPreference: order > 0 ? order : null,
    };
    const res = await action.run(() => api.call<Account>('ACCOUNT_UPDATE', { body: { name: account.name, cricket } }));
    if (!res.ok) return;
    haptic.success();
    onSaved(res.value);
    setSaved(true);
  };

  return (
    <Card>
      <Text style={[type.headline, { color: theme.ink }]}>Cricket profile</Text>
      <Text style={[type.caption, { color: theme.muted }]}>
        Used in every cricket team you&apos;re linked to. Leave it if you only play football.
      </Text>
      <ErrorBanner message={action.error?.message} />
      <Group label="Role">
        {CRICKET_ROLES.map((r) => (
          <Chip key={r.value} label={r.label} onCard selected={role === r.value} onPress={() => touch(setRole)(r.value)} />
        ))}
      </Group>
      <Group label="Bats">
        {BATTING_STYLES.map((b) => (
          <Chip key={b.value} label={b.label} onCard selected={bat === b.value} onPress={() => touch(setBat)(bat === b.value ? null : b.value)} />
        ))}
      </Group>
      {bowls && (
        <>
          <Group label="Bowling arm">
            {BOWLING_ARMS.map((a) => (
              <Chip key={a.value} label={a.label} onCard selected={arm === a.value} onPress={() => touch(setArm)(a.value)} />
            ))}
          </Group>
          <Group label="Bowling type">
            {BOWLING_TYPES.map((b) => (
              <Chip key={b.value} label={b.label} onCard selected={bowl === b.value} onPress={() => touch(setBowl)(b.value)} />
            ))}
          </Group>
          <Text style={[type.bodyStrong, { color: arm && bowl ? theme.successInk : theme.muted }]}>
            {bowlingStyleLabel(arm, bowl) ?? 'Pick an arm and a type to name the style.'}
          </Text>
        </>
      )}
      <Stepper
        label="Usual batting position"
        value={order}
        min={0}
        max={11}
        display={order === 0 ? 'Any' : String(order)}
        onChange={touch(setOrder)}
      />
      <Button label={saved ? 'Saved' : 'Save cricket profile'} icon="check" onPress={save} busy={action.busy} variant="secondary" />
    </Card>
  );
}

/**
 * Two steps: "Delete account…" shows what will happen and emails a code; the code confirms it.
 * Every session ends with it, so the phone goes back to sign-in by itself.
 */
function DeleteAccount() {
  const action = useAction();
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);
  const [code, setCode] = useState('');

  const ask = async () => {
    const res = await action.run(() => api.call<AccountDeletionPreview>('ACCOUNT_DELETE_PREVIEW'));
    if (res.ok) {
      setPreview(res.value);
      setCode('');
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete your account?',
      message: "This can't be undone.",
      confirmLabel: 'Delete account',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call('ACCOUNT_DELETE', { body: { otp: code } }));
    if (!res.ok) return;
    haptic.heavy();
    clearSession();
  };

  if (!preview) {
    return (
      <View style={{ gap: space.sm }}>
        <ErrorBanner message={action.error?.message} />
        <Button label="Delete account…" variant="ghost" onPress={ask} busy={action.busy} />
      </View>
    );
  }

  const lines = [
    ...preview.tournamentsDeleted.map(
      (t) => `Deletes ${t.name}, which only you own${t.otherPeople > 0 ? ` — for the ${plural(t.otherPeople, 'other person', 'other people')} in it too` : ''}.`,
    ),
    ...preview.tournamentsHandedOver.map((t) => `Hands ${t.name} to ${t.newCreator}.`),
    ...(preview.tournamentsLeft > 0 ? [`Takes you off ${plural(preview.tournamentsLeft, 'other tournament')}.`] : []),
    ...(preview.squadPlaces > 0 ? [`Unlinks you from ${plural(preview.squadPlaces, 'team')} (your name stays on past scorecards).`] : []),
    'Removes your name, email and cricket profile, and signs you out everywhere.',
  ];

  return (
    <Card>
      <Text style={[type.headline, { color: theme.ink }]}>Delete your account</Text>
      <Text style={[type.body, { color: theme.ink }]}>This can&apos;t be undone. Deleting it:</Text>
      {lines.map((line) => (
        <Text key={line} style={[type.body, { color: theme.ink }]}>
          •  {line}
        </Text>
      ))}
      <ErrorBanner message={action.error?.message} />
      <TextField
        label={`Code sent to ${preview.codeSentTo}`}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="6-digit code"
      />
      <Button label="Delete my account" icon="delete-outline" variant="danger" onPress={remove} busy={action.busy} disabled={code.length !== 6} />
      <Button label="Keep my account" variant="secondary" onPress={() => setPreview(null)} disabled={action.busy} />
    </Card>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.label, { color: theme.muted }]}>{label}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={[type.label, { color: theme.muted }]}>{label}</Text>
      <Text style={[type.body, { color: theme.ink }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { gap: space.sm, marginTop: space.xs },
  fact: { gap: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
