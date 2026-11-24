import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { EntryPreview } from '@/api/types';
import { PhotoBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import Skeleton from '@/components/Skeleton';
import TextField from '@/components/TextField';
import Wallpaper from '@/components/Wallpaper';
import { useAction } from '@/hooks/useAction';
import { confirm } from '@/lib/confirm';
import { dateRange, plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { SportThemeProvider, useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// "Enter a tournament" (boards Club-Enter-Code, Club-Enter-Squad; plan section 6): a lasting team's admin types the
// code the organiser sent — the only way in (C-11) — sees the tournament and who's in it, then picks the squad. Every
// player starts ticked; anyone who already has a place in that tournament is greyed with the server's reason. The name
// is the team's own unless another team there has it. Send → the organiser accepts or declines (C-7); until then the
// squad can change and the entry can be withdrawn. Opened with `entryId` from the team page's waiting row.

export default function EnterScreen() {
  const { clubId, sport, entryId } = useLocalSearchParams<{ clubId: string; sport?: string; entryId?: string }>();
  return (
    <SportThemeProvider sport={sport ?? 'Cricket'}>
      <Enter clubId={Number(clubId)} entryId={entryId ? Number(entryId) : null} />
    </SportThemeProvider>
  );
}

function Enter({ clubId, entryId }: { clubId: number; entryId: number | null }) {
  const { type, fonts } = useTypography();
  const theme = useSportTheme();
  const router = useRouter();
  const light = theme.mode === 'light';
  const find = useAction();
  const send = useAction();
  const withdrawAction = useAction();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<EntryPreview | null>(null);
  const [teamName, setTeamName] = useState('');
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const loadedEntry = useRef(false);

  const show = (p: EntryPreview) => {
    setPreview(p);
    setTeamName(p.teamName);
    setTicked(new Set(p.players.filter((x) => x.ticked).map((x) => x.clubPlayerId)));
  };

  // From the team page's waiting row: straight to that entry.
  useEffect(() => {
    if (entryId == null || loadedEntry.current) return;
    loadedEntry.current = true;
    find.run(() => api.call<EntryPreview>('ENTRY_PREVIEW', { body: { clubId, entryId } })).then((res) => res.ok && show(res.value));
  }, [entryId, clubId, find]);

  const lookUp = async () => {
    const res = await find.run(() => api.call<EntryPreview>('ENTRY_PREVIEW', { body: { clubId, code: code.trim() } }));
    if (res.ok) {
      haptic.success();
      show(res.value);
    }
  };

  const waiting = preview?.entryStatus === 'Waiting';
  const accepted = preview?.entryStatus === 'Accepted';
  const picked = preview?.players.filter((p) => ticked.has(p.clubPlayerId)).length ?? 0;

  const toggle = (id: number) => {
    haptic.select();
    setTicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (!preview) return;
    const body = { clubId, code: preview.code, teamName: teamName.trim(), clubPlayerIds: [...ticked] };
    const res = await send.run(() =>
      waiting && preview.entryId != null
        ? api.call<EntryPreview>('ENTRY_UPDATE', { routeParams: { entryId: preview.entryId }, body })
        : api.call<EntryPreview>('ENTRY_REQUEST', { body }),
    );
    if (res.ok) {
      haptic.success();
      show(res.value);
    }
  };

  const withdraw = async () => {
    if (!preview?.entryId) return;
    const ok = await confirm({
      title: 'Withdraw the entry?',
      message: `${preview.tournamentName}'s organiser won't see it any more. You can enter again while entries are open.`,
      confirmLabel: 'Withdraw',
      destructive: true,
    });
    if (!ok) return;
    const res = await withdrawAction.run(() => api.call('ENTRY_WITHDRAW', { routeParams: { entryId: preview.entryId! } }));
    if (res.ok) {
      haptic.heavy();
      router.back();
    }
  };

  const footer = preview && !accepted ? (
    <Button
      label={waiting ? 'Save changes' : `Send entry · ${plural(picked, 'player')}`}
      icon={waiting ? 'check' : 'send'}
      size="lg"
      onPress={submit}
      busy={send.busy}
      disabled={picked === 0 || !teamName.trim()}
    />
  ) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'Enter a tournament',
          headerStyle: { backgroundColor: light ? theme.deck : 'transparent' },
          headerTintColor: light ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: light ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Wallpaper underHeader />
      <Screen footer={footer}>
        {!preview ? (
          entryId != null ? (
            find.busy ? <Skeleton rows={4} /> : <ErrorBanner message={find.error?.message} />
          ) : (
            <Card>
              <Text style={[type.headline, { color: theme.ink }]}>The tournament’s entry code</Text>
              <Text style={[type.caption, { color: theme.muted }]}>
                The organiser sends it to the teams they want. Type it, or paste the whole link they sent.
              </Text>
              <ErrorBanner message={find.error?.message} />
              <TextField
                label="Entry code"
                value={code}
                onChangeText={setCode}
                placeholder="K7MQ2DX4P"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={lookUp}
              />
              <Button label="Find tournament" icon="magnify" onPress={lookUp} busy={find.busy} disabled={code.trim().length < 9} />
            </Card>
          )
        ) : (
          <>
            <Card>
              <View style={styles.head}>
                <PhotoBadge link={preview.logoUrl} name={preview.tournamentName} size={52} square />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.headline, { color: theme.ink }]} numberOfLines={2}>
                    {preview.tournamentName}
                  </Text>
                  <Text style={[type.caption, { color: theme.muted }]}>
                    {[dateRange(preview.startDate, preview.endDate), `run by ${preview.organiser}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>
              <Text style={[type.caption, { color: theme.muted }]}>
                {preview.teams.length === 0 ? 'No teams in it yet.' : `In it: ${preview.teams.join(', ')}`}
              </Text>
            </Card>

            {(waiting || accepted) && (
              <Card>
                <View style={styles.status}>
                  <Icon name={accepted ? 'check-circle' : 'clock-outline'} size={22} color={accepted ? theme.successInk : theme.muted} />
                  <Text style={[type.bodyStrong, { color: theme.ink, flex: 1 }]}>
                    {accepted ? `${preview.teamName} is in.` : 'Waiting for the organiser to answer.'}
                  </Text>
                </View>
                <Text style={[type.caption, { color: theme.muted }]}>
                  {accepted
                    ? 'Change its squad from the tournament’s team page.'
                    : 'You can change the squad or the name until then. You’ll hear when they answer.'}
                </Text>
                {waiting && (
                  <>
                    <ErrorBanner message={withdrawAction.error?.message} />
                    <Button label="Withdraw the entry" variant="secondary" icon="close" onPress={withdraw} busy={withdrawAction.busy} />
                  </>
                )}
              </Card>
            )}

            {!accepted && (
              <>
                <ErrorBanner message={send.error?.message} />
                <TextField
                  label="Your team’s name in this tournament"
                  value={teamName}
                  onChangeText={setTeamName}
                  autoCapitalize="words"
                  maxLength={100}
                  error={preview.teamNameProblem && teamName.trim() === preview.teamName ? preview.teamNameProblem : undefined}
                />
                <Text style={[type.eyebrow, { color: light ? theme.muted : theme.onDarkSoft }]} accessibilityRole="header">
                  The squad · {picked} of {preview.players.length}
                </Text>
                {preview.players.map((p) => {
                  const on = !p.reason && ticked.has(p.clubPlayerId);
                  return (
                    <PressableScale
                      key={p.clubPlayerId}
                      onPress={p.reason ? undefined : () => toggle(p.clubPlayerId)}
                      disabled={!!p.reason}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: !!p.reason }}
                      accessibilityLabel={`${p.name}${p.isCaptain ? ', captain' : ''}${p.reason ? `. ${p.reason}` : ''}`}
                      style={[styles.row, { borderBottomColor: theme.cardDivider, opacity: p.reason ? 0.55 : 1 }]}
                    >
                      <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={on ? theme.successSolid : theme.muted} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
                          {p.name}
                          {p.isCaptain ? ' · Captain' : ''}
                        </Text>
                        {(p.reason || p.detail) && <Text style={[type.caption, { color: theme.muted }]}>{p.reason ?? p.detail}</Text>}
                      </View>
                    </PressableScale>
                  );
                })}
              </>
            )}

            {accepted && (
              <Button
                label="Open the tournament"
                icon="trophy-outline"
                onPress={() => router.replace({ pathname: '/tournament/[id]', params: { id: String(preview.tournamentId), sport: preview.sport } })}
              />
            )}
          </>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: 1 },
});
