import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import type { JoinTeamPreview, JoinTeamResult } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import { useAction } from '@/hooks/useAction';
import { haptic } from '@/lib/haptics';
import { fonts, radius, space, themeFor, type } from '@/theme/theme';

// Joining a team with the code its organiser shared: type the code, see the team and the names in
// it nobody has claimed, tap yours — or join as a new player. Instant; the server keeps it to one
// team per tournament. Lands in the tournament afterwards.

export default function JoinScreen() {
  const router = useRouter();
  const action = useAction();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<JoinTeamPreview | null>(null);
  const [joining, setJoining] = useState<number | 'new' | null>(null);

  const theme = themeFor(preview?.sport ?? 'Football');

  const look = async () => {
    if (!code.trim()) return;
    const res = await action.run(() => api.call<JoinTeamPreview>('TEAM_JOIN_PREVIEW', { body: { code } }));
    if (res.ok) setPreview(res.value);
  };

  const join = async (playerId: number | null) => {
    setJoining(playerId ?? 'new');
    const res = await action.run(() => api.call<JoinTeamResult>('TEAM_JOIN', { body: { code, playerId } }));
    setJoining(null);
    if (!res.ok) return;
    haptic.success();
    const t = res.value;
    router.replace({ pathname: '/tournament/[id]', params: { id: String(t.tournamentId), name: t.tournamentName, sport: t.sport } });
  };

  return (
    <Screen>
      <ErrorBanner message={action.error?.message} />

      {!preview ? (
        <Card>
          <Text style={[type.headline, { color: theme.ink }]} nativeID="join-code-label">
            Team code from the organiser
          </Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="K7MQ2D"
            placeholderTextColor={theme.placeholderInk}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={look}
            editable={!action.busy}
            accessibilityLabelledBy="join-code-label"
            style={[styles.code, { backgroundColor: theme.chip, color: theme.ink }]}
          />
          <Button label="Find team" icon="magnify" onPress={look} busy={action.busy} disabled={!code.trim()} size="lg" />
        </Card>
      ) : (
        <>
          <View style={{ gap: space.xs }}>
            <Text style={[type.eyebrow, { color: theme.accent }]}>{preview.tournamentName}</Text>
            <Text style={[type.title, { color: theme.onDark }]} accessibilityRole="header">
              {preview.teamName}
            </Text>
          </View>

          {preview.places.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Text style={[type.bodyStrong, { color: theme.onDark }]}>Are you one of these?</Text>
              {preview.places.map((p) => (
                <PressableScale
                  key={p.playerId}
                  onPress={() => join(p.playerId)}
                  disabled={action.busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}${p.detail ? `, ${p.detail}` : ''}. That's me`}
                  style={[styles.place, { backgroundColor: theme.cream }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: theme.ink }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {p.detail && <Text style={[type.caption, { color: theme.muted }]}>{p.detail}</Text>}
                  </View>
                  <Text style={[type.caption, { color: theme.muted }]}>{joining === p.playerId ? 'Joining…' : "That's me"}</Text>
                  <Icon name="chevron-right" size={22} color={theme.muted} />
                </PressableScale>
              ))}
            </View>
          )}

          <Button
            label={preview.places.length > 0 ? "I'm not listed — join as new" : 'Join as a new player'}
            icon="account-plus"
            size="lg"
            onPress={() => join(null)}
            busy={joining === 'new'}
            disabled={action.busy}
          />
          <Button label="Use a different code" variant="ghost" onPress={() => setPreview(null)} disabled={action.busy} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { minHeight: 64, borderRadius: radius.md, paddingHorizontal: space.md, fontFamily: fonts.display, fontSize: 32, letterSpacing: 6, textAlign: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.md, minHeight: 64 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22 },
});
