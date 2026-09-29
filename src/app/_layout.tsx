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

import ConfirmHost from '@/components/ConfirmHost';
import { ServerProvider } from '@/config/server';
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

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ServerProvider>
        <StatusBar style="light" />
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
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="server"
            options={{
              title: 'Server',
              presentation: 'formSheet',
              sheetAllowedDetents: [0.75, 1.0],
              sheetGrabberVisible: true,
            }}
          />
          {/* A tournament has its own stack (and its own sport colours) — see tournament/[id]/_layout. */}
          <Stack.Screen name="tournament/[id]" options={{ headerShown: false }} />
        </Stack>
        <ConfirmHost />
      </ServerProvider>
    </GestureHandlerRootView>
  );
}
