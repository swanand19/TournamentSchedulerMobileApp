import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { League, LeagueCandidate, PictureResult } from '@/api/types';
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
import { space, type Typography } from '@/theme/theme';

// League settings (board League-Settings, its organisers only): name, short name and area, the logo, the organisers (as
// many as the league likes — the user's choice, 2026-11-24 — never none), its seasons (take one out; tick a tournament
// already run here in as a season), its public link, and deleting it, which leaves its tournaments as they are.

export default function LeagueSettingsScreen() {
  const { leagueId, sport } = useLocalSearchParams<{ leagueId: string; sport?: string }>();
  const fetcher = useCallback(() => api.call<League>('LEAGUE_GET', { routeParams: { leagueId: Number(leagueId) } }), [leagueId]);
  const league = useQuery(fetcher);
  return (
    <SportThemeProvider sport={league.data?.sport ?? sport ?? 'Cricket'}>
      <Settings league={league.data} loading={league.loading} error={league.error} onRefresh={league.refresh} onChanged={league.setData} reload={league.reload} />
    </SportThemeProvider>
  );
}

function Settings({ league: l, loading, error, onRefresh, onChanged, reload }: {
  league: League | undefined;
  loading: boolean;
  error: Error | null;
  onRefresh: () => Promise<void>;
  onChanged: (league: League) => void;
  reload: () => Promise<void>;
}) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const light = theme.mode === 'light';
  const saveAction = useAction();
  const peopleAction = useAction();
  const seasonAction = useAction();
  const dangerAction = useAction();
  const [name, setName] = useState<string | null>(null);
  const [short, setShort] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [adding, setAdding] = useState({ open: false, key: 0 });
  const [ticking, setTicking] = useState({ open: false, key: 0 });

  const shownName = name ?? l?.name ?? '';
  const shownShort = short ?? l?.shortName ?? '';
  const shownArea = area ?? l?.area ?? '';
  const changed = !!l && (shownName.trim() !== l.name || shownShort.trim() !== l.shortName || (shownArea.trim() || null) !== (l.area ?? null));

  const save = async () => {
    if (!l) return;
    const res = await saveAction.run(() =>
      api.call<League>('LEAGUE_UPDATE', { routeParams: { leagueId: l.leagueId }, body: { name: shownName.trim(), shortName: shownShort.trim(), area: shownArea.trim() || null } }),
    );
    if (res.ok) {
      haptic.success();
      setName(null);
      setShort(null);
      setArea(null);
      onChanged(res.value);
    }
  };

  const removeOrganiser = async (userId: number, who: string, isMe: boolean) => {
    if (!l) return;
    const ok = await confirm({
      title: isMe ? `Stop running ${l.name}?` : `Remove ${who}?`,
      message: isMe ? "You won't be able to start its seasons or change it any more." : `${who} won't be able to start ${l.name}'s seasons or change it any more.`,
      confirmLabel: isMe ? 'Step down' : 'Remove',
      destructive: true,
    });
    if (!ok) return;
    const res = await peopleAction.run(() => api.call<League>('LEAGUE_ORGANISER_REMOVE', { routeParams: { leagueId: l.leagueId, userId } }));
    if (res.ok) {
      haptic.heavy();
      if (isMe) router.back();
      else onChanged(res.value);
    }
  };

  const takeOut = async (tournamentId: number, seasonName: string) => {
    if (!l) return;
    const ok = await confirm({
      title: `Take ${seasonName} out of ${l.name}?`,
      message: 'The tournament stays, still public, just not a season any more. The other seasons are numbered again.',
      confirmLabel: 'Take out',
      destructive: true,
    });
    if (!ok) return;
    const res = await seasonAction.run(() => api.call<League>('LEAGUE_SEASON_REMOVE', { routeParams: { leagueId: l.leagueId, tournamentId } }));
    if (res.ok) {
      haptic.heavy();
      onChanged(res.value);
    }
  };

  const remove = async () => {
    if (!l) return;
    const ok = await confirm({
      title: `Delete ${l.name}?`,
      message: 'Its tournaments stay, with their results, just not grouped any more. Its all-time stats and records go.',
      confirmLabel: 'Delete league',
      destructive: true,
    });
    if (!ok) return;
    const res = await dangerAction.run(() => api.call('LEAGUE_DELETE', { routeParams: { leagueId: l.leagueId } }));
    if (res.ok) {
      haptic.heavy();
      router.dismissTo('/');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'League settings',
          headerStyle: { backgroundColor: light ? theme.deck : 'transparent' },
          headerTintColor: light ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: light ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Wallpaper underHeader />
      <Screen onRefresh={onRefresh} error={l ? null : error} onRetry={onRefresh}>
        {!l ? (
          loading ? <Skeleton rows={4} /> : null
        ) : !l.canManage ? (
          <Text style={[type.body, { color: theme.onDarkSoft }]}>Only the league’s organisers can change it.</Text>
        ) : (
          <>
            <Card>
              <ErrorBanner message={saveAction.error?.message} />
              <TextField label="League name" value={shownName} onChangeText={(v) => setName(capitalizeWords(v))} autoCapitalize="words" maxLength={60} />
              <TextField
                label="Short name, shown on tournaments"
                value={shownShort}
                onChangeText={(v) => setShort(v.toUpperCase())}
                autoCapitalize="characters"
                maxLength={8}
                hint="Like CPL. Each new season is named with it: CPL 4."
              />
              <TextField label="Where it's played (optional)" value={shownArea} onChangeText={setArea} placeholder="e.g. Pune" autoCapitalize="words" maxLength={60} />
              <Button label="Save" icon="check" onPress={save} busy={saveAction.busy} disabled={!changed || !shownName.trim()} />
            </Card>

            <Card>
              <PictureField
                label="Logo"
                hint="Square. Shown on the league's page and beside its seasons."
                shape="square"
                link={l.logoUrl}
                name={l.name}
                upload={async (image) => (await api.call<PictureResult>('LEAGUE_LOGO_SET', { routeParams: { leagueId: l.leagueId }, body: { image } })).url}
                remove={async () => {
                  await api.call<PictureResult>('LEAGUE_LOGO_REMOVE', { routeParams: { leagueId: l.leagueId } });
                }}
                onChanged={reload}
              />
            </Card>

            <Card>
              <ErrorBanner message={peopleAction.error?.message} />
              <Text style={[type.label, { color: theme.muted }]}>Organisers</Text>
              {l.organisers.map((o) => (
                <View key={o.userId} style={styles.row}>
                  <Icon name="account-tie-outline" size={22} color={theme.muted} />
                  <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                    {o.name}
                    {o.isMe ? ' (you)' : ''}
                  </Text>
                  {o.canRemove && (
                    <Button label={o.isMe ? 'Step down' : 'Remove'} variant="secondary" size="sm" onPress={() => removeOrganiser(o.userId, o.name, o.isMe)} disabled={peopleAction.busy} />
                  )}
                </View>
              ))}
              <Button label="Add an organiser" icon="account-plus-outline" variant="secondary" onPress={() => setAdding((s) => ({ open: true, key: s.key + 1 }))} />
              <Text style={[type.caption, { color: theme.muted }]}>
                Organisers start new seasons and own the seasons they start. A season’s own owners and scorers stay as they are.
              </Text>
            </Card>

            <Card>
              <ErrorBanner message={seasonAction.error?.message} />
              <Text style={[type.label, { color: theme.muted }]}>Seasons</Text>
              {l.seasons.map((s) => (
                <View key={s.tournamentId} style={styles.row}>
                  <Text style={[styles.seasonNo, { color: theme.muted }]}>{s.number}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: theme.ink }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    <Text style={[type.caption, { color: theme.muted }]}>{s.hidden ? 'Hidden by KickCricket' : s.status === 'Live' ? 'Live' : s.status === 'Upcoming' ? 'Not started' : s.status}</Text>
                  </View>
                  <Button label="Take out" variant="secondary" size="sm" onPress={() => takeOut(s.tournamentId, s.name)} disabled={seasonAction.busy} />
                </View>
              ))}
              <Button label="Add a tournament as a season" icon="plus" variant="secondary" onPress={() => setTicking((s) => ({ open: true, key: s.key + 1 }))} />
              <Text style={[type.caption, { color: theme.muted }]}>Seasons are numbered in date order.</Text>
            </Card>

            {l.share?.url && (
              <Card>
                <Text style={[type.label, { color: theme.muted }]}>Anyone can find and watch this league</Text>
                <Text style={[type.caption, { color: theme.muted }]}>Its page, every season, winners and all-time stats. Emails and numbers are never shown.</Text>
                <Button label="Share the league’s link" icon="share-variant" variant="secondary" onPress={() => Share.share({ message: `${l.name} on KickCricket: ${l.share!.url}` })} />
              </Card>
            )}

            <ErrorBanner message={dangerAction.error?.message} />
            <Button label="Delete the league" icon="trash-can-outline" variant="danger" onPress={remove} busy={dangerAction.busy} />
            <Text style={[type.caption, { color: theme.muted, textAlign: 'center' }]}>Its tournaments stay, just not grouped any more.</Text>

            <AddOrganiserSheet key={`o-${adding.key}`} visible={adding.open} onClose={() => setAdding((s) => ({ ...s, open: false }))} league={l} onSaved={onChanged} />
            <AddSeasonSheet key={`s-${ticking.key}`} visible={ticking.open} onClose={() => setTicking((s) => ({ ...s, open: false }))} league={l} onSaved={onChanged} />
          </>
        )}
      </Screen>
    </View>
  );
}

function AddOrganiserSheet({ visible, onClose, league, onSaved }: { visible: boolean; onClose: () => void; league: League; onSaved: (l: League) => void }) {
  const options = useAuthOptions();
  const action = useAction();
  const [contact, setContact] = useState('');
  const add = async () => {
    const res = await action.run(() => api.call<League>('LEAGUE_ORGANISER_ADD', { routeParams: { leagueId: league.leagueId }, body: { contact: contact.trim() } }));
    if (res.ok) {
      haptic.success();
      onSaved(res.value);
      onClose();
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={`Who else runs ${league.name}?`}>
      <ErrorBanner message={action.error?.message} />
      <TextField
        label={options.phone ? 'Email or mobile number' : 'Email'}
        value={contact}
        onChangeText={setContact}
        placeholder={options.phone ? 'friend@example.com or 98765 43210' : 'friend@example.com'}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!action.busy}
        hint="They need to have signed up already. They'll get a notification."
      />
      <Button label="Make organiser" icon="check" busy={action.busy} disabled={!contact.trim()} onPress={add} />
    </Sheet>
  );
}

/** Tick one of the caller's own tournaments in as a season: it takes its place in date order. */
function AddSeasonSheet({ visible, onClose, league, onSaved }: { visible: boolean; onClose: () => void; league: League; onSaved: (l: League) => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const fetcher = useCallback(() => api.call<LeagueCandidate[]>('LEAGUE_CANDIDATES', { query: { sport: league.sport } }), [league.sport]);
  const candidates = useQuery(fetcher, { enabled: visible });
  const action = useAction();
  const add = async (tournamentId: number) => {
    const res = await action.run(() => api.call<League>('LEAGUE_SEASON_ADD', { routeParams: { leagueId: league.leagueId }, body: { tournamentId } }));
    if (res.ok) {
      haptic.success();
      onSaved(res.value);
      onClose();
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Add a tournament as a season" subtitle={`${theme.label} tournaments you own, in no other league.`}>
      <ErrorBanner message={(action.error ?? candidates.error)?.message} />
      {!candidates.data ? (
        candidates.loading ? <Skeleton rows={3} height={56} /> : null
      ) : candidates.data.length === 0 ? (
        <Text style={[type.body, { color: theme.muted }]}>No other {theme.label.toLowerCase()} tournaments of yours to add.</Text>
      ) : (
        candidates.data.map((c) => (
          <PressableScale
            key={c.tournamentId}
            onPress={() => add(c.tournamentId)}
            disabled={action.busy}
            accessibilityLabel={`Add ${c.name}, ${c.line}`}
            style={[styles.pickRow, { borderBottomColor: theme.cardDivider }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.rowName, { color: theme.ink }]}>{c.name}</Text>
              <Text style={[type.caption, { color: theme.muted }]}>{c.line}</Text>
            </View>
            <Icon name="plus" size={22} color={theme.accent} />
          </PressableScale>
        ))
      )}
    </Sheet>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  rowName: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 21 },
  seasonNo: { width: 24, textAlign: 'center', fontFamily: fonts.bodySemiBold, fontSize: 16 },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
