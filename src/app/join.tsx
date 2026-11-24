import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/api/client';
import type { ClubJoinPreview, ClubJoinResult, JoinTeamPreview, JoinTeamResult, PoolJoinPreview, PoolJoinResult } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Screen from '@/components/Screen';
import { useAction } from '@/hooks/useAction';
import { haptic } from '@/lib/haptics';
import { useThemeMode } from '@/theme/appearance';
import { useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, themeFor, type Typography } from '@/theme/theme';

// Joining a team with the code its organiser shared: type the code, see the team and the names in
// it nobody has claimed, tap yours — or join as a new player. Instant; the server keeps it to one
// team per tournament. Lands in the tournament afterwards.
//
// The same field takes a player pool's code (seven characters; team codes are six): registering
// puts the person in the pool, to be bought at the auction (2026-11-17). And a lasting team's code (eight, 2026-11-20):
// the same "are you one of these?", then the team's page.

export default function JoinScreen() {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const action = useAction();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<JoinTeamPreview | null>(null);
  const [poolPreview, setPoolPreview] = useState<PoolJoinPreview | null>(null);
  const [clubPreview, setClubPreview] = useState<ClubJoinPreview | null>(null);
  const [joining, setJoining] = useState<number | 'new' | 'pool' | null>(null);

  const theme = themeFor(preview?.sport ?? poolPreview?.sport ?? clubPreview?.sport ?? 'Football', useThemeMode());
  const typed = code.replace(/[\s-]/g, '').length;
  const isPoolCode = typed === 7;
  const isClubCode = typed === 8;
  // Nine is a tournament's entry code: it isn't for joining, so say where it goes instead of asking the server.
  const isEntryCode = typed === 9;

  const look = async () => {
    if (!code.trim()) return;
    if (isEntryCode) return;
    if (isClubCode) {
      const res = await action.run(() => api.call<ClubJoinPreview>('CLUB_JOIN_PREVIEW', { body: { code } }));
      if (res.ok) setClubPreview(res.value);
      return;
    }
    if (isPoolCode) {
      const res = await action.run(() => api.call<PoolJoinPreview>('POOL_JOIN_PREVIEW', { body: { code } }));
      if (res.ok) setPoolPreview(res.value);
      return;
    }
    const res = await action.run(() => api.call<JoinTeamPreview>('TEAM_JOIN_PREVIEW', { body: { code } }));
    if (res.ok) setPreview(res.value);
  };

  const register = async () => {
    setJoining('pool');
    const res = await action.run(() => api.call<PoolJoinResult>('POOL_JOIN', { body: { code } }));
    setJoining(null);
    if (!res.ok) return;
    haptic.success();
    const t = res.value;
    router.replace({ pathname: '/tournament/[id]', params: { id: String(t.tournamentId), name: t.tournamentName, sport: t.sport } });
  };

  const joinClub = async (clubPlayerId: number | null) => {
    setJoining(clubPlayerId ?? 'new');
    const res = await action.run(() => api.call<ClubJoinResult>('CLUB_JOIN', { body: { code, clubPlayerId } }));
    setJoining(null);
    if (!res.ok) return;
    haptic.success();
    router.replace({ pathname: '/club/[clubId]', params: { clubId: String(res.value.clubId), sport: res.value.sport, tab: 'players' } });
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
      <ErrorBanner
        message={
          isEntryCode
            ? 'That’s a tournament’s entry code, for a team’s admin. Open your team on Home’s Teams tab and tap Enter a tournament.'
            : action.error?.message
        }
      />

      {clubPreview ? (
        <>
          <View style={{ gap: space.xs }}>
            <Text style={[type.eyebrow, { color: theme.accent }]}>
              {[`${clubPreview.sport} team`, clubPreview.area].filter(Boolean).join(' · ')}
            </Text>
            <Text style={[type.title, { color: theme.onDark }]} accessibilityRole="header">
              {clubPreview.name}
            </Text>
          </View>
          {clubPreview.places.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Text style={[type.bodyStrong, { color: theme.onDark }]}>Are you one of these?</Text>
              {clubPreview.places.map((p) => (
                <PressableScale
                  key={p.clubPlayerId}
                  onPress={() => joinClub(p.clubPlayerId)}
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
                  <Text style={[type.caption, { color: theme.muted }]}>{joining === p.clubPlayerId ? 'Joining…' : "That's me"}</Text>
                  <Icon name="chevron-right" size={22} color={theme.muted} />
                </PressableScale>
              ))}
            </View>
          )}
          <Button
            label={clubPreview.places.length > 0 ? "I'm not listed — join as new" : `Join ${clubPreview.name}`}
            icon="account-plus"
            size="lg"
            onPress={() => joinClub(null)}
            busy={joining === 'new'}
            disabled={action.busy}
          />
          <Button label="Use a different code" variant="ghost" onPress={() => setClubPreview(null)} disabled={action.busy} />
        </>
      ) : poolPreview ? (
        <>
          <View style={{ gap: space.xs }}>
            <Text style={[type.eyebrow, { color: theme.accent }]}>{poolPreview.tournamentName}</Text>
            <Text style={[type.title, { color: theme.onDark }]} accessibilityRole="header">
              Player pool
            </Text>
          </View>
          <Card>
            <Text style={[type.body, { color: theme.ink }]}>
              Register to be bought at {poolPreview.tournamentName}&apos;s player auction.{' '}
              {poolPreview.players > 0 ? `${poolPreview.players} already in the pool. ` : ''}You&apos;ll see the auction live and hear which team buys you.
            </Text>
          </Card>
          <Button label="Register for the player pool" icon="account-plus" size="lg" onPress={register} busy={joining === 'pool'} disabled={action.busy} />
          <Button label="Use a different code" variant="ghost" onPress={() => setPoolPreview(null)} disabled={action.busy} />
        </>
      ) : !preview ? (
        <Card>
          <Text style={[type.headline, { color: theme.ink }]} nativeID="join-code-label">
            Code from the organiser or the team&apos;s admin
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
          <Button label={isPoolCode ? 'Find player pool' : 'Find team'} icon="magnify" onPress={look} busy={action.busy} disabled={!code.trim()} size="lg" />
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

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  code: { minHeight: 64, borderRadius: radius.md, paddingHorizontal: space.md, fontFamily: fonts.display, fontSize: 32, letterSpacing: 6, textAlign: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.md, minHeight: 64 },
  name: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22 },
});
