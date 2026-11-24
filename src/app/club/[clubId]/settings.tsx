import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Club } from '@/api/types';
import { JerseyBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PictureField from '@/components/PictureField';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import Sheet from '@/components/Sheet';
import Skeleton from '@/components/Skeleton';
import TextField from '@/components/TextField';
import Wallpaper from '@/components/Wallpaper';
import { useAction } from '@/hooks/useAction';
import { useAuthOptions } from '@/hooks/useAuthOptions';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { capitalizeWords } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { SportThemeProvider, useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// A lasting team's settings (the ⋮ on its page): its name and where it plays, its logo, who runs it (1–3 admins, C-16;
// one of its players on the app, or anyone by email or number), and deleting it — which leaves its tournament squads as
// ordinary teams. A player who doesn't run it sees who does and can leave.

const MAX_ADMINS = 3;

type PictureResult = { url: string | null };

export default function ClubSettingsScreen() {
  const { clubId, sport } = useLocalSearchParams<{ clubId: string; sport?: string }>();
  const fetcher = useCallback(() => api.call<Club>('CLUB_GET', { routeParams: { clubId: Number(clubId) } }), [clubId]);
  const club = useQuery(fetcher);
  return (
    <SportThemeProvider sport={club.data?.sport ?? sport ?? 'Cricket'}>
      <Settings club={club.data} loading={club.loading} error={club.error} onRefresh={club.refresh} onChanged={club.setData} reload={club.reload} />
    </SportThemeProvider>
  );
}

function Settings({ club: c, loading, error, onRefresh, onChanged, reload }: {
  club: Club | undefined;
  loading: boolean;
  error: Error | null;
  onRefresh: () => Promise<void>;
  onChanged: (club: Club) => void;
  reload: () => Promise<void>;
}) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const light = theme.mode === 'light';
  const saveAction = useAction();
  const adminAction = useAction();
  const dangerAction = useAction();
  const [name, setName] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [adding, setAdding] = useState({ open: false, key: 0 });

  const shownName = name ?? c?.name ?? '';
  const shownArea = area ?? c?.area ?? '';
  const changed = !!c && (shownName.trim() !== c.name || (shownArea.trim() || null) !== (c.area ?? null));
  const me = c?.players.find((p) => p.isMe);

  const save = async () => {
    if (!c) return;
    const res = await saveAction.run(() =>
      api.call<Club>('CLUB_UPDATE', { routeParams: { clubId: c.clubId }, body: { name: shownName.trim(), area: shownArea.trim() || null, setCaptain: false } }),
    );
    if (res.ok) {
      haptic.success();
      setName(null);
      setArea(null);
      onChanged(res.value);
    }
  };

  const removeAdmin = async (userId: number, who: string, isMe: boolean) => {
    if (!c) return;
    const ok = await confirm({
      title: isMe ? `Stop running ${c.name}?` : `Remove ${who}?`,
      message: isMe ? "You won't be able to change the team any more. Another admin can make you one again." : `${who} won't be able to change ${c.name} any more.`,
      confirmLabel: isMe ? 'Step down' : 'Remove',
      destructive: true,
    });
    if (!ok) return;
    const res = await adminAction.run(() => api.call<Club>('CLUB_ADMIN_REMOVE', { routeParams: { clubId: c.clubId, userId } }));
    if (res.ok) {
      haptic.heavy();
      onChanged(res.value);
    }
  };

  const remove = async () => {
    if (!c) return;
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      message: 'Its players and admins go with it. Tournaments it played stay as they are, with their results.',
      confirmLabel: 'Delete team',
      destructive: true,
    });
    if (!ok) return;
    const res = await dangerAction.run(() => api.call('CLUB_DELETE', { routeParams: { clubId: c.clubId } }));
    if (res.ok) {
      haptic.heavy();
      router.dismissTo('/');
    }
  };

  const leave = async () => {
    if (!c || !me) return;
    const ok = await confirm({
      title: `Leave ${c.name}?`,
      message: 'Tournaments you have played for it stay as they were.',
      confirmLabel: 'Leave team',
      destructive: true,
    });
    if (!ok) return;
    const res = await dangerAction.run(() => api.call<Club>('CLUB_PLAYER_REMOVE', { routeParams: { clubId: c.clubId, clubPlayerId: me.clubPlayerId } }));
    if (res.ok) {
      haptic.heavy();
      if (c.canManage) onChanged(res.value);
      else router.dismissTo('/');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Team settings',
          headerStyle: { backgroundColor: light ? theme.deck : 'transparent' },
          headerTintColor: light ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: light ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Wallpaper underHeader />
      <Screen onRefresh={onRefresh} error={c ? null : error} onRetry={onRefresh}>
        {!c ? (
          loading ? <Skeleton rows={4} /> : null
        ) : (
          <>
            {c.canManage && (
              <Card>
                <ErrorBanner message={saveAction.error?.message} />
                <TextField label="Team name" value={shownName} onChangeText={(v) => setName(capitalizeWords(v))} autoCapitalize="words" maxLength={60} />
                <TextField label="Where it plays (optional)" value={shownArea} onChangeText={setArea} placeholder="e.g. Pune" autoCapitalize="words" maxLength={60} />
                <Button label="Save" icon="check" onPress={save} busy={saveAction.busy} disabled={!changed || !shownName.trim()} />
              </Card>
            )}

            {c.canManage && (
              <Card>
                <PictureField
                  label="Logo"
                  hint="Square. Shown beside the team's name, on its page and on Home."
                  shape="square"
                  link={c.logoUrl}
                  name={c.name}
                  upload={async (image) => (await api.call<PictureResult>('CLUB_LOGO_SET', { routeParams: { clubId: c.clubId }, body: { image } })).url}
                  remove={async () => {
                    await api.call<PictureResult>('CLUB_LOGO_REMOVE', { routeParams: { clubId: c.clubId } });
                  }}
                  onChanged={reload}
                />
              </Card>
            )}

            <Card>
              <ErrorBanner message={adminAction.error?.message} />
              <Text style={[type.label, { color: theme.muted }]}>Team admins</Text>
              <Text style={[type.caption, { color: theme.muted }]}>
                They change the team’s players and admins, and run its squads in tournaments. They don’t score matches: only a
                tournament’s organisers and scorers do.
              </Text>
              {c.admins.map((a) => (
                <View key={a.userId} style={styles.row}>
                  <Icon name="account-tie-outline" size={22} color={theme.muted} />
                  <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                    {a.name}
                    {a.isMe ? ' (you)' : ''}
                  </Text>
                  {a.canRemove && (
                    <Button label={a.isMe ? 'Step down' : 'Remove'} variant="secondary" size="sm" onPress={() => removeAdmin(a.userId, a.name, a.isMe)} disabled={adminAction.busy} />
                  )}
                </View>
              ))}
              {c.canManage && c.admins.length < MAX_ADMINS && (
                <Button label="Add an admin" icon="account-plus-outline" variant="secondary" onPress={() => setAdding((s) => ({ open: true, key: s.key + 1 }))} />
              )}
            </Card>

            {c.share?.url && (
              <Card>
                <Text style={[type.label, { color: theme.muted }]}>The team’s page</Text>
                <Text style={[type.caption, { color: theme.muted }]}>
                  Anyone with the link sees its tournaments, results and players’ names, without signing in. Never emails, numbers or photos.
                </Text>
                <Button
                  label="Share the team’s page"
                  icon="share-variant"
                  variant="secondary"
                  onPress={() => Share.share({ message: `${c.name} on KickCricket: ${c.share!.url}` })}
                />
              </Card>
            )}

            <ErrorBanner message={dangerAction.error?.message} />
            {me && <Button label="Leave team" icon="account-remove-outline" variant="secondary" onPress={leave} disabled={dangerAction.busy} />}
            {c.canManage && <Button label="Delete team" icon="trash-can-outline" variant="danger" onPress={remove} busy={dangerAction.busy} />}

            <AddAdminSheet key={adding.key} visible={adding.open} onClose={() => setAdding((s) => ({ ...s, open: false }))} club={c} onSaved={onChanged} />
          </>
        )}
      </Screen>
    </View>
  );
}

function AddAdminSheet({ visible, onClose, club, onSaved }: { visible: boolean; onClose: () => void; club: Club; onSaved: (club: Club) => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const options = useAuthOptions();
  const action = useAction();
  const [contact, setContact] = useState('');
  // Players on the app who don't run it already; the captain is the usual pick.
  const candidates = club.players.filter((p) => p.isLinked && !p.isAdmin);

  const add = async (body: { clubPlayerId: number } | { contact: string }) => {
    const res = await action.run(() => api.call<Club>('CLUB_ADMIN_ADD', { routeParams: { clubId: club.clubId }, body }));
    if (res.ok) {
      haptic.success();
      onSaved(res.value);
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Who else runs ${club.name}?`}>
      <ErrorBanner message={action.error?.message} />
      {candidates.length > 0 && (
        <>
          <Text style={[type.label, { color: theme.muted }]}>From the team</Text>
          {candidates.map((p) => (
            <PressableScale
              key={p.clubPlayerId}
              onPress={() => add({ clubPlayerId: p.clubPlayerId })}
              disabled={action.busy}
              accessibilityLabel={`Make ${p.name} an admin`}
              style={[styles.pickRow, { borderColor: theme.cardDivider }]}
            >
              <JerseyBadge number={p.jerseyNumber} highlight={p.isCaptain} />
              <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                {p.name}
                {p.isCaptain ? ' · captain' : ''}
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
        placeholder={options.phone ? 'friend@example.com or 98765 43210' : 'friend@example.com'}
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

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  rowName: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
