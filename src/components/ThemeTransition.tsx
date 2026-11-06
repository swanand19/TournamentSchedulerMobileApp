import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { captureScreen, releaseCapture } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';

import { registerThemeSwitcher, setThemeMode } from '@/theme/appearance';
import type { ThemeMode } from '@/theme/theme';

// The crossfade between dark and light. Every colour and font in the app changes at once, which
// React Native can't animate property by property, so this photographs the screen as it is, lays
// the picture over the app, switches the theme underneath it, and fades the picture away — the old
// look dissolves into the new one. Reduce Motion, and the web preview (which can't photograph the
// screen), switch at once.

const FADE = { duration: 380, easing: Easing.bezier(0.4, 0, 0.2, 1) };
// How long the picture stays before fading: the screens are rebuilt for the new theme
// (ThemedScreen) and reload their data, which on the LAN takes about this long.
const HOLD_MS = 250;

export default function ThemeTransition() {
  const reduced = useReducedMotion();
  const [shot, setShot] = useState<string | null>(null);
  const pending = useRef<ThemeMode | null>(null);
  const opacity = useSharedValue(1);

  useEffect(
    () =>
      registerThemeSwitcher(async (mode) => {
        // Mid-fade, or no motion wanted: just switch.
        if (reduced || Platform.OS === 'web' || pending.current) return setThemeMode(mode);
        const uri = await captureScreen({ format: 'jpg', quality: 0.9, result: 'tmpfile' });
        pending.current = mode;
        opacity.set(1);
        setShot(uri);
      }),
    [reduced, opacity],
  );

  const done = (uri: string) => {
    setShot(null);
    releaseCapture(uri);
  };

  // Only once the picture is on screen does the theme change beneath it, so nothing flashes.
  const onLoad = () => {
    const mode = pending.current;
    const uri = shot;
    pending.current = null;
    if (!mode || !uri) return;
    setThemeMode(mode);
    // The new theme has to be drawn (and the rebuilt screen loaded) before the picture starts to go.
    setTimeout(
      () =>
        opacity.set(
          withTiming(0, FADE, (finished) => {
            if (finished) scheduleOnRN(done, uri);
          }),
        ),
      HOLD_MS,
    );
  };

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  if (!shot) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Image source={{ uri: shot }} onLoad={onLoad} fadeDuration={0} resizeMode="stretch" style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}
