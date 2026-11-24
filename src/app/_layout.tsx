import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Outfit_200ExtraLight, Outfit_300Light, Outfit_400Regular, Outfit_500Medium } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { loadSession, useSessionState } from '@/auth/session';
import { usePendingInvite } from '@/features/invite/pendingInvite';
import ConfirmHost from '@/components/ConfirmHost';
import ThemeTransition from '@/components/ThemeTransition';
import { themedScreenLayout } from '@/components/ThemedScreen';
import { ServerProvider, useServer } from '@/config/server';
import { useClientUpdate } from '@/features/update/clientUpdate';
import OpeningScreen from '@/features/opening/OpeningScreen';
import { UpdateRequiredScreen, useUpdateCheck } from '@/features/update/UpdateParts';
import { loadAppearance, useAppearance } from '@/theme/appearance';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { neutralWall } from '@/theme/theme';

// Keeps the splash up until the fonts (and the icon font) are in, so the first screen never flashes
// in the system font and then jumps.
SplashScreen.preventAutoHideAsync();
// The opening (features/opening) draws the still screen's own picture underneath, so the still
// screen just fades away over it before the animation starts.
SplashScreen.setOptions({ fade: true, duration: 150 });

// The tournament holds its own stack, which rebuilds its screens on a theme change itself.
const screenLayout = themedScreenLayout('tournament/[id]');

export default function RootLayout() {
  const reduced = useReducedMotion();
  const [loaded, error] = useFonts({
    // The glass theme's family.
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // The light theme's one family; loaded either way so switching never waits on a font.
    Outfit_200ExtraLight,
    Outfit_300Light,
    Outfit_400Regular,
    Outfit_500Medium,
    ...MaterialCommunityIcons.font,
  });

  const { loaded: sessionLoaded } = useSessionState();
  // Plays once per start of the app, in the theme saved on the phone; coming back from the
  // background doesn't start the app again, so it doesn't replay.
  const [opening, setOpening] = useState(true);
  const appearance = useAppearance();
  useEffect(() => {
    loadSession();
    loadAppearance();
  }, []);

  const ready = (loaded || !!error) && sessionLoaded && appearance.loaded;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ServerProvider>
        <StatusBar style={appearance.mode === 'light' ? 'dark' : 'light'} />
        <AppStack reduced={reduced} />
        {opening && <OpeningScreen mode={appearance.mode} onDone={() => setOpening(false)} />}
        <ConfirmHost />
        <ThemeTransition />
      </ServerProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Signed out, only the sign-in screen (and the Server sheet, to fix the address) can be reached;
 * signed in, everything else. Signing in or being signed out (a 401) switches over by itself.
 */
function AppStack({ reduced }: { reduced: boolean }) {
  const { fonts } = useTypography();
  const { ready, baseUrl } = useServer();
  const { session } = useSessionState();
  // A session belongs to the server that issued it; on another server the phone is signed out.
  const signedIn = !!session && ready && session.server === baseUrl;
  // An invite link opened signed out waits here until sign-in or sign-up finishes (only in memory, so closing the app
  // halfway joins nobody); signed in, it opens at once.
  usePendingInvite(signedIn);
  // Where this app version stands (HLD P-25): an update the server requires covers everything.
  const recheck = useUpdateCheck(ready && !!baseUrl);
  const { required } = useClientUpdate();
  const theme = useSportTheme();
  // Outside a tournament the glass theme's ground is the neutral wallpaper's base.
  const ground = theme.mode === 'dark' ? neutralWall.page : theme.page;

  return (
    <>
      {/* While the update screen covers it, screen readers on both platforms skip the app behind. */}
      <View
        style={{ flex: 1 }}
        importantForAccessibility={required ? 'no-hide-descendants' : 'auto'}
        accessibilityElementsHidden={required}
      >
        <Stack
          screenLayout={screenLayout}
          screenOptions={{
            // Glass: the bar floats over the wallpaper (ThemedScreen keeps the content below it).
            headerTransparent: theme.mode === 'dark',
            headerStyle: { backgroundColor: theme.mode === 'dark' ? 'transparent' : ground },
            headerTintColor: theme.onDark,
            headerTitleStyle: { fontFamily: theme.mode === 'light' ? fonts.body : fonts.bodySemiBold, fontSize: 17 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: ground },
            // The platform's own push; a crossfade when the user has asked for less motion.
            animation: reduced ? 'fade' : 'default',
          }}
        >
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="account" options={{ title: 'Account' }} />
            {/* Profiles colour their own headers: neutral for the base profile, the sport for a career. */}
            <Stack.Screen name="profile/index" options={{ title: 'Profile', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="profile/[sport]" options={{ title: '', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="join" options={{ title: 'Join a team' }} />
            <Stack.Screen name="invite/[code]" options={{ title: 'Joining the team', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="find" options={{ title: 'Find' }} />
            <Stack.Screen name="profile/follows" options={{ title: '', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            {/* Lasting teams (people see "team"): they colour their own headers by the team's sport, like a career. */}
            <Stack.Screen name="club/[clubId]/index" options={{ title: '', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="club/[clubId]/settings" options={{ title: 'Team settings', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="club/[clubId]/enter" options={{ title: 'Enter a tournament', headerBackButtonDisplayMode: 'minimal' }} />
            {/* Leagues and seasons (2026-11-24). */}
            <Stack.Screen name="league/new" options={{ title: 'New league', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="league/[leagueId]/index" options={{ title: '', headerBackButtonDisplayMode: 'minimal' }} />
            <Stack.Screen name="league/[leagueId]/settings" options={{ title: 'League settings', headerBackButtonDisplayMode: 'minimal' }} />
            {/* A tournament has its own stack (and its own sport colours) — see tournament/[id]/_layout. */}
            <Stack.Screen name="tournament/[id]" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" options={{ headerShown: false }} />
          </Stack.Protected>
          <Stack.Screen
            name="server"
            options={{
              title: 'Server',
              presentation: 'formSheet',
              sheetAllowedDetents: [0.75, 1.0],
              sheetGrabberVisible: true,
            }}
          />
        </Stack>
      </View>
      {required && <UpdateRequiredScreen onCheckAgain={() => recheck(true)} />}
    </>
  );
}
