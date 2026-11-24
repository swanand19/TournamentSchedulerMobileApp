import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

import ConfirmHost from '@/components/ConfirmHost';
import { themedScreenLayout } from '@/components/ThemedScreen';
import { TournamentProvider } from '@/hooks/useTournament';
import { useSportTheme, useTypography } from '@/theme/SportTheme';

// Everything inside one tournament: its hub, teams, schedule builder and the match screens. The
// provider loads the tournament once and re-tints this whole stack to its sport.

const screenLayout = themedScreenLayout();

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
  const { fonts } = useTypography();
  const theme = useSportTheme();
  const reduced = useReducedMotion();

  return (
    <Stack
      screenLayout={screenLayout}
      screenOptions={{
        // Glass: the bar floats over the wallpaper (ThemedScreen keeps the content below it).
        headerTransparent: theme.mode === 'dark',
        headerStyle: { backgroundColor: theme.mode === 'dark' ? 'transparent' : theme.page },
        headerTintColor: theme.mode === 'light' ? theme.ink : theme.onDark,
        headerTitleStyle: { fontFamily: theme.mode === 'light' ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: theme.page },
        animation: reduced ? 'fade' : 'default',
      }}
    >
      <Stack.Screen name="index" options={{ title: '' }} />
      <Stack.Screen name="people" options={{ title: 'People & settings' }} />
      <Stack.Screen name="knockout" options={{ title: 'Knockouts' }} />
      <Stack.Screen name="pool" options={{ title: 'Player pool' }} />
      <Stack.Screen name="auction" options={{ title: 'Auction' }} />
      <Stack.Screen name="draw" options={{ title: 'Team draw' }} />
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
          contentStyle: { backgroundColor: theme.mode === 'light' ? theme.cream : theme.page },
        }}
      />
      <Stack.Screen name="football/[matchId]/setup" options={{ title: 'Match setup' }} />
      <Stack.Screen name="football/[matchId]/live" options={{ title: 'Live match' }} />
      <Stack.Screen name="football/[matchId]/penalties" options={{ title: 'Penalties' }} />
      <Stack.Screen name="cricket/[matchId]/setup" options={{ title: 'Match setup' }} />
      <Stack.Screen name="cricket/[matchId]/live" options={{ title: 'Live scorer' }} />
      <Stack.Screen name="cricket/[matchId]/scorecard" options={{ title: 'Scorecard' }} />
      <Stack.Screen name="football/[matchId]/watch" options={{ title: '' }} />
      <Stack.Screen name="cricket/[matchId]/watch" options={{ title: '' }} />
    </Stack>
  );
}
