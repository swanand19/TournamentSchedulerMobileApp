import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { NetworkError } from '@/api/errors';
import type { TournamentListItem } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PitchBackground from '@/components/PitchBackground';
import PressableScale from '@/components/PressableScale';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import StatusChip, { type ChipTone } from '@/components/StatusChip';
import { useServer } from '@/config/server';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { relativeDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { SportThemeProvider, useSportTheme } from '@/theme/SportTheme';
import { fonts, lip, radius, space, SPORTS, themeFor, type, type Sport } from '@/theme/theme';

// Home: the organiser's tournaments for one sport, and the place to start a new one.
//
// The list loads every tournament once and filters by sport on the phone, which is what lets the
// sport switch show a count for each side and flip instantly.

// Remembered across launches, so someone running a cricket tournament isn't dropped back into
// football every time they open the app. Same key as the website.
const SPORT_KEY = 'tournamentScheduler.sport';

function statusOf(t: TournamentListItem): { label: string; tone: ChipTone } {
  if (t.isStarted) return { label: 'In play', tone: 'live' };
  if (t.hasSchedule) return { label: 'Schedule ready', tone: 'ready' };
  return { label: 'Setting up', tone: 'setup' };
}

export default function Home() {
  const [sport, setSport] = useState<Sport>('Football');

  useEffect(() => {
    AsyncStorage.getItem(SPORT_KEY)
      .then((saved) => {
        if (saved === 'Football' || saved === 'Cricket') setSport(saved);
      })
      .catch(() => {});
  }, []);

  const pickSport = (next: Sport) => {
    setSport(next);
    AsyncStorage.setItem(SPORT_KEY, next).catch(() => {});
  };

  return (
    <SportThemeProvider sport={sport}>
      <HomeContent sport={sport} onSport={pickSport} />
    </SportThemeProvider>
  );
}

function HomeContent({ sport, onSport }: { sport: Sport; onSport: (s: Sport) => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useSportTheme();
  const { ready, baseUrl } = useServer();

  const fetcher = useCallback(
    // baseUrl is a dependency on purpose: a new server address means a fresh list.
    () => (baseUrl ? api.call<TournamentListItem[]>('TOURNAMENT_LIST') : Promise.reject(new NetworkError('(no server set)'))),
    [baseUrl],
  );
  const list = useQuery(fetcher, { enabled: ready });
  const action = useAction();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');

  const all = list.data ?? [];
  const mine = all.filter((t) => t.sport === sport);
  const online = !!list.data && !(list.error instanceof NetworkError);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give your tournament a name first.');
      return;
    }
    const res = await action.run(() =>
      api.call<{ id: number; name: string }>('TOURNAMENT_CREATE', { body: { name: trimmed, sport } }),
    );
    if (!res.ok) return;
    haptic.success();
    setName('');
    list.reload();
    router.push({ pathname: '/tournament/[id]', params: { id: res.value.id, name: res.value.name, sport } });
  };

  const remove = async (t: TournamentListItem) => {
    const ok = await confirm({
      title: `Delete ${t.name}?`,
      message: 'Its teams, schedule and every match result go with it. This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const res = await action.run(() => api.call('TOURNAMENT_DELETE', { routeParams: { id: t.id } }));
    if (res.ok) {
      haptic.heavy();
      list.reload();
    }
  };

  const open = (t: TournamentListItem) =>
    router.push({ pathname: '/tournament/[id]', params: { id: t.id, name: t.name, sport: t.sport } });

  const error = action.error ?? list.error;

  const header = (
    <View style={{ gap: space.lg, marginBottom: space.lg }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[type.eyebrow, { color: theme.accent }]}>Matchday scheduler</Text>
          <Text style={[type.title, { color: theme.onDark }]} accessibilityRole="header">
            Your tournaments
          </Text>
        </View>
        <PressableScale
          onPress={() => router.push('/server')}
          style={[styles.serverChip, { borderColor: theme.borderOnDark, backgroundColor: theme.deck }]}
          accessibilityLabel={`Server ${online ? 'connected' : 'not connected'}, ${baseUrl || 'not set'}. Change server`}
        >
          <View style={[styles.dot, { backgroundColor: online ? '#8FD16A' : theme.danger }]} />
          <Text style={[styles.serverText, { color: theme.onDark }]}>{online ? 'Online' : 'Server'}</Text>
        </PressableScale>
      </View>

      <SegmentedControl
        accessibilityLabel="Sport"
        segments={SPORTS.map((s) => ({
          key: s.key,
          label: s.label,
          badge: list.data ? all.filter((t) => t.sport === s.key).length : undefined,
        }))}
        value={sport}
        onChange={onSport}
      />

      {list.data && (
        <View style={styles.tiles}>
          <Tile value={mine.length} label="Tournaments" />
          <Tile value={mine.filter((t) => t.isStarted).length} label="In play" />
          <Tile value={mine.filter((t) => !t.isStarted).length} label="Setting up" />
        </View>
      )}

      <ErrorBanner
        message={error?.message}
        actionLabel={error instanceof NetworkError ? 'Change server' : 'Try again'}
        onAction={error instanceof NetworkError ? () => router.push('/server') : list.refresh}
      />

      <Card>
        <View style={styles.cardTitle}>
          <Icon name="plus-circle-outline" size={22} color={theme.ink} />
          <Text style={[type.headline, { color: theme.ink, flex: 1 }]} nativeID="new-tournament-label">
            New {theme.label.toLowerCase()} tournament
          </Text>
        </View>
        <TextInput
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (nameError) setNameError('');
          }}
          placeholder={theme.placeholder}
          placeholderTextColor={theme.placeholderInk}
          editable={!action.busy}
          returnKeyType="done"
          onSubmitEditing={create}
          accessibilityLabelledBy="new-tournament-label"
          style={[
            styles.input,
            { backgroundColor: theme.chip, color: theme.ink, borderColor: nameError ? theme.warnInk : 'transparent' },
          ]}
        />
        {!!nameError && <Text style={[type.caption, { color: theme.warnInk }]}>{nameError}</Text>}
        <Button label="Create tournament" icon="lightning-bolt" onPress={create} busy={action.busy} size="lg" />
      </Card>

      {mine.length > 0 && (
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>Tap to open · press and hold to delete</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PitchBackground theme={theme} />
      <FlatList
        data={mine}
        keyExtractor={(t) => String(t.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{
          paddingTop: insets.top + space.xl,
          paddingBottom: insets.bottom + space.xxl,
          paddingHorizontal: space.lg,
          gap: space.md,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={theme.accent} colors={[theme.deep]} />
        }
        ListEmptyComponent={
          list.loading ? (
            <Skeleton rows={3} height={112} />
          ) : list.data ? (
            <EmptyState
              icon={sport === 'Cricket' ? 'cricket' : 'soccer'}
              title={`No ${theme.label.toLowerCase()} tournaments`}
              message="Name one above to start. You'll add teams, draw groups and build the fixtures next."
            />
          ) : null
        }
        renderItem={({ item }) => <TournamentCard item={item} onOpen={() => open(item)} onDelete={() => remove(item)} />}
      />
    </KeyboardAvoidingView>
  );
}

function Tile({ value, label }: { value: number; label: string }) {
  const theme = useSportTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[type.figure, { color: theme.accent, fontSize: 28, lineHeight: 32 }]}>{value}</Text>
      <Text style={[type.label, { color: theme.onDarkSoft }]}>{label}</Text>
    </View>
  );
}

function TournamentCard({ item, onOpen, onDelete }: { item: TournamentListItem; onOpen: () => void; onDelete: () => void }) {
  const theme = themeFor(item.sport);
  const status = statusOf(item);
  return (
    <PressableScale
      onPress={onOpen}
      onLongPress={() => {
        haptic.heavy();
        onDelete();
      }}
      delayLongPress={450}
      accessibilityLabel={`${item.name}, ${status.label}`}
      accessibilityHint="Opens the tournament"
      accessibilityActions={[{ name: 'delete', label: 'Delete tournament' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete()}
      style={[styles.row, { backgroundColor: theme.cream }, lip(theme)]}
    >
      <View style={{ flex: 1, gap: space.xs }}>
        <StatusChip label={status.label} tone={status.tone} />
        <Text style={[type.headline, { color: theme.ink }]} numberOfLines={2}>
          {item.name}
        </Text>
        <View style={styles.meta}>
          <Icon name={item.sport === 'Cricket' ? 'cricket' : 'soccer'} size={16} color={theme.muted} />
          <Text style={[type.caption, { color: theme.muted }]}>
            {item.sport} · Created {relativeDate(item.createdAt)}
          </Text>
        </View>
      </View>
      <View style={[styles.chevron, { backgroundColor: theme.chip }]}>
        <Icon name="chevron-right" size={24} color={theme.ink} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  serverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    minHeight: 40,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  serverText: { fontFamily: fonts.bodySemiBold, fontSize: 13 },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: space.md, alignItems: 'center', gap: 2 },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  row: {
    borderRadius: radius.lg,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chevron: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
