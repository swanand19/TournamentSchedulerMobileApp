import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Teko_500Medium, Teko_600SemiBold } from '@expo-google-fonts/teko';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';

import { loadSession, useSessionState } from '@/auth/session';
import ConfirmHost from '@/components/ConfirmHost';
import { ServerProvider, useServer } from '@/config/server';
import { fonts, footballTheme } from '@/theme/theme';

// Keeps the splash up until the scoreboard fonts (and the icon font) are in, so the first screen
// never flashes in the system font and then jumps.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const reduced = useReducedMotion();
  const [loaded, error] = useFonts({
    Anton_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Teko_500Medium,
    Teko_600SemiBold,
    ...MaterialCommunityIcons.font,
  });

  const { loaded: sessionLoaded } = useSessionState();
  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if ((loaded || error) && sessionLoaded) SplashScreen.hideAsync();
  }, [loaded, error, sessionLoaded]);

  if ((!loaded && !error) || !sessionLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ServerProvider>
        <StatusBar style="light" />
        <AppStack reduced={reduced} />
        <ConfirmHost />
      </ServerProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Signed out, only the sign-in screen (and the Server sheet, to fix the address) can be reached;
 * signed in, everything else. Signing in or being signed out (a 401) switches over by itself.
 */
function AppStack({ reduced }: { reduced: boolean }) {
  const { ready, baseUrl } = useServer();
  const { session } = useSessionState();
  // A session belongs to the server that issued it; on another server the phone is signed out.
  const signedIn = !!session && ready && session.server === baseUrl;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: footballTheme.page },
        headerTintColor: footballTheme.onDark,
        headerTitleStyle: { fontFamily: fonts.bodySemiBold, fontSize: 17 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: footballTheme.page },
        // The platform's own push; a crossfade when the user has asked for less motion.
        animation: reduced ? 'fade' : 'default',
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="account" options={{ title: 'Account' }} />
        <Stack.Screen name="join" options={{ title: 'Join a team' }} />
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
  );
}
