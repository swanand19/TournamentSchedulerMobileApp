import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { ClubJoinResult, JoinTeamResult } from '@/api/types';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import Screen from '@/components/Screen';
import { useAction } from '@/hooks/useAction';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// An invite link opened in the app (2026-11-23; features/invite/pendingInvite brings it here once someone is signed
// in, which may be right after a sign-up). It joins straight away, as the user chose: eight characters are a lasting
// team's code, six a tournament's team's. Then the team's page or the tournament replaces this screen; someone
// already in the team just lands there. A link that no longer works says so, with the server's words.
export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const theme = useSportTheme();
  const { type } = useTypography();
  const action = useAction();
  const started = useRef(false);

  const join = async () => {
    const clean = String(code ?? '').replace(/[\s-]/g, '');
    if (clean.length === 8) {
      const res = await action.run(() => api.call<ClubJoinResult>('CLUB_JOIN', { body: { code: clean, link: true } }));
      if (!res.ok) return;
      if (!res.value.alreadyIn) haptic.success();
      router.replace({ pathname: '/club/[clubId]', params: { clubId: String(res.value.clubId), sport: res.value.sport, tab: 'players' } });
      return;
    }
    const res = await action.run(() => api.call<JoinTeamResult>('TEAM_JOIN', { body: { code: clean, link: true } }));
    if (!res.ok) return;
    if (!res.value.alreadyIn) haptic.success();
    const t = res.value;
    router.replace({ pathname: '/tournament/[id]', params: { id: String(t.tournamentId), name: t.tournamentName, sport: t.sport } });
  };

  // Once per opening: a re-render must never send the join twice.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen>
      {action.error ? (
        <View style={{ gap: space.md }}>
          <ErrorBanner message={action.error.message} />
          <Button label="Try again" icon="refresh" onPress={join} busy={action.busy} />
          <Button label="Go to Home" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }} accessibilityLiveRegion="polite">
          <ActivityIndicator color={theme.accent} />
          <Text style={[type.body, { color: theme.onDark }]}>Joining the team…</Text>
        </View>
      )}
    </Screen>
  );
}
