import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

import ConfirmHost from '@/components/ConfirmHost';
import { TournamentProvider } from '@/hooks/useTournament';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts } from '@/theme/theme';

// Everything inside one tournament: its hub, teams, schedule builder and the match screens. The
// provider loads the tournament once and re-tints this whole stack to its sport.

export default function TournamentLayout() {
  return (
    <TournamentProvider>
      <TournamentStack />
      {/* Mounted after the root's, so confirmations in here take the sport's colours. */}
      <ConfirmHost />
    </TournamentProvider>
  );
}

function TournamentStack() {
  const theme = useSportTheme();
  const reduced = useReducedMotion();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.deck },
        headerTintColor: theme.accent,
        headerTitleStyle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.page },
        animation: reduced ? 'fade' : 'default',
      }}
    >
      <Stack.Screen name="index" options={{ title: '' }} />
      <Stack.Screen name="teams" options={{ title: 'Teams' }} />
      <Stack.Screen name="team/[teamId]" options={{ title: 'Squad' }} />
      <Stack.Screen name="schedule" options={{ title: 'Build the schedule' }} />
      <Stack.Screen
        name="history"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6, 0.95],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: theme.cream },
        }}
      />
      <Stack.Screen name="football/[matchId]/setup" options={{ title: 'Match setup' }} />
      <Stack.Screen name="football/[matchId]/live" options={{ title: 'Live match' }} />
      <Stack.Screen name="football/[matchId]/penalties" options={{ title: 'Penalties' }} />
      <Stack.Screen name="cricket/[matchId]/setup" options={{ title: 'Match setup' }} />
      <Stack.Screen name="cricket/[matchId]/live" options={{ title: 'Live scorer' }} />
      <Stack.Screen name="cricket/[matchId]/scorecard" options={{ title: 'Scorecard' }} />
    </Stack>
  );
}
