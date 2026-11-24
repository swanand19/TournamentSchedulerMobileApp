import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { League, LeagueCandidate } from '@/api/types';
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
import { useQuery } from '@/hooks/useQuery';
import { capitalizeWords } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { SportThemeProvider, useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Sport, type Typography } from '@/theme/theme';

// Starting a league (board League-New): its name, the short name each season is named with ("CPL 4"), where it's played,
// and tournaments already run here that become its first seasons — ticked ones are numbered in date order (the user's
// choice, 2026-11-24: earlier KickCricket tournaments may join; nothing from before KickCricket). The logo is added from
// the league's settings once it exists.

export default function NewLeagueScreen() {
  const { sport } = useLocalSearchParams<{ sport?: string }>();
  const s: Sport = sport === 'Football' ? 'Football' : 'Cricket';
  return (
    <SportThemeProvider sport={s}>
      <NewLeague sport={s} />
    </SportThemeProvider>
  );
}

function NewLeague({ sport }: { sport: Sport }) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const light = theme.mode === 'light';
  const action = useAction();
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [area, setArea] = useState('');
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const fetcher = useCallback(() => api.call<LeagueCandidate[]>('LEAGUE_CANDIDATES', { query: { sport } }), [sport]);
  const candidates = useQuery(fetcher);

  // The season each ticked tournament becomes, in date order (as the server numbers them).
  const order = (candidates.data ?? []).filter((c) => ticked.has(c.tournamentId)).map((c) => c.tournamentId);
  const toggle = (id: number) =>
    setTicked((t) => {
      const next = new Set(t);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      haptic.select();
      return next;
    });

  const start = async () => {
    const res = await action.run(() =>
      api.call<League>('LEAGUE_CREATE', { body: { name: name.trim(), shortName: short.trim() || null, sport, area: area.trim() || null, tournamentIds: order } }),
    );
    if (!res.ok) return;
    haptic.success();
    router.replace({ pathname: '/league/[leagueId]', params: { leagueId: String(res.value.leagueId), sport } });
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: 'New league',
          headerStyle: { backgroundColor: light ? theme.deck : 'transparent' },
          headerTintColor: light ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: light ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          headerBackButtonDisplayMode: 'minimal',
        }}
      />
      <Wallpaper underHeader />
      <Screen footer={<Button label="Start the league" size="lg" onPress={start} busy={action.busy} disabled={!name.trim()} />}>
        <Text style={[type.body, { color: light ? theme.muted : theme.onDarkSoft }]}>
          A league is the tournament you run again and again. Each time you run it is a season.
        </Text>
        <ErrorBanner message={action.error?.message} />
        <Card>
          <TextField label="Name" value={name} onChangeText={(v) => setName(capitalizeWords(v))} placeholder="e.g. Corporate Premier League" autoCapitalize="words" maxLength={60} />
          <TextField
            label="Short name, shown on tournaments"
            value={short}
            onChangeText={(v) => setShort(v.toUpperCase())}
            placeholder="e.g. CPL"
            autoCapitalize="characters"
            maxLength={8}
            hint="Each new season is named with it: CPL 4. Left empty, it's made from the name."
          />
          <TextField label="Where it's played (optional)" value={area} onChangeText={setArea} placeholder="e.g. Pune" autoCapitalize="words" maxLength={60} />
        </Card>

        <Card>
          <Text style={[type.headline, { color: theme.ink }]}>Earlier seasons on KickCricket</Text>
          <Text style={[type.caption, { color: theme.muted }]}>
            Tick tournaments you ran here before. They become Season 1, 2… in date order, with their winners and stats.
          </Text>
          <ErrorBanner message={candidates.error?.message} actionLabel="Try again" onAction={candidates.refresh} />
          {!candidates.data ? (
            candidates.loading ? <Skeleton rows={3} height={52} /> : null
          ) : candidates.data.length === 0 ? (
            <Text style={[type.body, { color: theme.muted }]}>None yet: its first season will be the next one you start.</Text>
          ) : (
            candidates.data.map((c) => {
              const on = ticked.has(c.tournamentId);
              const n = order.indexOf(c.tournamentId) + 1;
              return (
                <PressableScale
                  key={c.tournamentId}
                  onPress={() => toggle(c.tournamentId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${c.name}, ${c.line}${on ? `, becomes season ${n}` : ''}`}
                  style={[styles.row, { borderTopColor: theme.cardDivider }]}
                >
                  <View style={[styles.check, { borderColor: on ? theme.accent : theme.placeholderInk, backgroundColor: on ? theme.accent : 'transparent' }]}>
                    {on && <Icon name="check" size={16} color={theme.accentInk} />}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.bodyStrong, { color: theme.ink }]}>{c.name}</Text>
                    <Text style={[type.caption, { color: theme.muted }]}>{c.line}</Text>
                  </View>
                  {on && (
                    <View style={[styles.tag, { backgroundColor: theme.tint }]}>
                      <Text style={[type.label, { color: light ? theme.deep : theme.accent }]}>Season {n}</Text>
                    </View>
                  )}
                </PressableScale>
              );
            })
          )}
          <Text style={[type.caption, { color: theme.muted }]}>Only {theme.label.toLowerCase()} tournaments you own, and not in another league.</Text>
        </Card>
        <Text style={[type.caption, { color: light ? theme.muted : theme.onDarkSoft }]}>
          Leagues are public, like every tournament: anyone can find and watch a league and every season in it. Emails and numbers are never shown.
        </Text>
      </Screen>
    </View>
  );
}

const makeStyles = (_: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tag: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
});
