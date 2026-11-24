import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import type { PublicSearchResult } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import Screen from '@/components/Screen';
import SegmentedControl from '@/components/SegmentedControl';
import PeopleSearch from '@/features/people/PeopleSearch';
import { formatDay } from '@/components/DateField';
import { useAction } from '@/hooks/useAction';
import { haptic } from '@/lib/haptics';
import { useThemeMode } from '@/theme/appearance';
import { useThemedStyles, useTypography } from '@/theme/SportTheme';
import { lip, radius, space, themeFor, type Typography } from '@/theme/theme';

// Finding a public tournament to follow (6E): by its name (3 letters or more), or its code or the
// link someone shared. Every tournament is public, but by name only once its schedule or knockout stage is set. Several may share a
// name, so each shows its sport, dates, status and number of teams. Following opens it — to watch,
// never to score; one already followed or played in just opens. The People tab (2026-11-23) finds players to follow.

const TABS = [
  { key: 'tournaments' as const, label: 'Tournaments' },
  { key: 'people' as const, label: 'People' },
];

const STATUS: Record<string, string> = { Upcoming: 'Not started yet', Live: 'In play', Completed: 'Completed', Cancelled: 'Cancelled' };

const dates = (r: PublicSearchResult) =>
  !r.startDate ? null : r.startDate === r.endDate || !r.endDate ? formatDay(r.startDate) : `${formatDay(r.startDate)} – ${formatDay(r.endDate)}`;

export default function FindScreen() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const search = useAction();
  const follow = useAction();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicSearchResult[] | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const mode = useThemeMode();
  const theme = themeFor('Football', mode);
  const [tab, setTab] = useState<'tournaments' | 'people'>('tournaments');

  const find = async () => {
    if (!query.trim()) return;
    const res = await search.run(() => api.call<PublicSearchResult[]>('FOLLOW_SEARCH', { query: { q: query.trim() } }));
    if (res.ok) setResults(res.value);
  };

  const open = async (r: PublicSearchResult) => {
    setOpening(r.tournamentId);
    const res = r.isFollowing || r.isMine ? { ok: true } : await follow.run(() => api.call('FOLLOW_ADD', { body: { code: r.code } }));
    setOpening(null);
    if (!res.ok) return;
    haptic.success();
    router.replace({ pathname: '/tournament/[id]', params: { id: String(r.tournamentId), name: r.name, sport: r.sport } });
  };

  return (
    <Screen>
      <SegmentedControl accessibilityLabel="Find" segments={TABS} value={tab} onChange={setTab} />
      {tab === 'people' ? <PeopleSearch /> : <>
      <Card>
        <Text style={[type.headline, { color: theme.ink }]} nativeID="find-label">
          Tournament name, code or link
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Monsoon Cup"
          placeholderTextColor={theme.placeholderInk}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
          onSubmitEditing={find}
          editable={!search.busy}
          accessibilityLabelledBy="find-label"
          style={[styles.input, { backgroundColor: theme.chip, color: theme.ink }]}
        />
        <Button label="Search" icon="magnify" onPress={find} busy={search.busy} disabled={!query.trim()} size="lg" />
        <Text style={[type.caption, { color: theme.muted }]}>Tournaments show up here once their schedule or knockout stage is set. A code or link finds any.</Text>
      </Card>

      <ErrorBanner message={(search.error ?? follow.error)?.message} />

      {results?.length === 0 && (
        <Text style={[type.body, { color: theme.onDarkSoft }]}>No tournament matches that. Check the spelling, or ask the organiser for its code or link.</Text>
      )}

      {results?.map((r) => {
        const t = themeFor(r.sport, mode);
        const opens = r.isFollowing || r.isMine;
        const line = [STATUS[r.status], dates(r), `${r.teams} team${r.teams === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
        return (
          <View key={r.tournamentId} style={[styles.result, { backgroundColor: t.cream }, lip(t)]}>
            <View style={{ flex: 1, gap: space.xs }}>
              <View style={styles.meta}>
                <Icon name={r.sport === 'Cricket' ? 'cricket' : 'soccer'} size={16} color={t.muted} />
                <Text style={[type.caption, { color: t.muted }]}>{t.label}</Text>
              </View>
              <Text style={[type.headline, { color: t.ink }]} numberOfLines={2}>
                {r.name}
              </Text>
              <Text style={[type.caption, { color: t.muted }]}>{line}</Text>
              {opens && <Text style={[type.caption, { color: t.muted }]}>{r.isMine ? 'Already on your list' : 'You follow it'}</Text>}
            </View>
            <Button
              label={opens ? 'Open' : 'Follow'}
              size="sm"
              variant={opens ? 'secondary' : 'primary'}
              busy={opening === r.tournamentId}
              disabled={opening != null}
              onPress={() => open(r)}
              accessibilityLabel={`${opens ? 'Open' : 'Follow'} ${r.name}, ${line}`}
            />
          </View>
        );
      })}
      </>}
    </Screen>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  input: { minHeight: 56, borderRadius: radius.md, paddingHorizontal: space.md, fontFamily: fonts.bodyMedium, fontSize: 16 },
  result: { borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
