import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import type { PersonRow } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import { useAction } from '@/hooks/useAction';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

import { PersonLine } from './PeopleParts';

// Find → People (2026-11-23): players on KickCricket by name, three letters or more. Only people who play in a team
// show up (they have a profile); nobody is told who searched. Follow from the row, or tap it for the profile.
export default function PeopleSearch() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const search = useAction();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonRow[] | null>(null);
  const short = query.trim().length < 3;

  const find = async () => {
    if (short) return;
    const res = await search.run(() => api.call<PersonRow[]>('PEOPLE_SEARCH', { query: { q: query.trim() } }));
    if (res.ok) setResults(res.value);
  };

  return (
    <>
      <Card>
        <Text style={[type.headline, { color: theme.ink }]} nativeID="people-label">
          Their name
        </Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Rohan"
          placeholderTextColor={theme.placeholderInk}
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
          onSubmitEditing={find}
          editable={!search.busy}
          accessibilityLabelledBy="people-label"
          style={[styles.input, { backgroundColor: theme.chip, color: theme.ink }]}
        />
        <Button label="Search" icon="magnify" onPress={find} busy={search.busy} disabled={short} size="lg" />
        <Text style={[type.caption, { color: theme.muted }]}>
          Players on KickCricket, by name (three letters or more). Following someone tells you when they start a match you can watch.
        </Text>
      </Card>

      <ErrorBanner message={search.error?.message} />

      {results?.length === 0 && (
        <Text style={[type.body, { color: theme.onDarkSoft }]}>Nobody who plays has that name. Check the spelling, or try part of it.</Text>
      )}

      {results && results.length > 0 && (
        <Card>
          <View style={{ gap: space.xs }}>
            {results.map((p) => (
              <PersonLine
                key={p.userId}
                person={p}
                onOpen={() => router.push({ pathname: '/profile', params: { userId: String(p.userId) } })}
              />
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

const makeStyles = ({ fonts }: Typography) =>
  StyleSheet.create({
    input: { minHeight: 56, borderRadius: radius.md, paddingHorizontal: space.md, fontFamily: fonts.bodyMedium, fontSize: 16 },
  });
