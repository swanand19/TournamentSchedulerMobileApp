import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type WithTimingConfig,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { EASE_OUT } from '@/lib/motion';
import { useTypography } from '@/theme/SportTheme';
import { neutralWall, openingColours as C, type ThemeMode } from '@/theme/theme';

// The opening (2026-11-20, the canvas's "Opening C" and "night falls"). The phone first shows its
// still screen — the icon's green ground and mark, the same for everyone, because it is drawn before
// the app can read the saved theme. This picks up from exactly that picture and plays once:
//  - light: the halfway line runs out, the stripes come in, the mark grows, the name rises, and the
//    view dives through the centre circle into the light Home;
//  - dark: first night falls — the green darkens to the glass theme's night, the lines turn teal and
//    the pitch periwinkle, the wallpaper's light comes up — then the same name and dive, landing on
//    Home's own wallpaper, so nothing changes colour at the end.
// About 2.2 s; the app is already running underneath, so Home has started loading. Reduce Motion:
// the still screen just fades into the app.

/** The mark's size on the still screen: app.json's splash `imageWidth` (76) over the 72 units it shows. */
const U = 76 / 72;
const GROW = 1.5;
/** Lets the phone's still screen fade out over this first frame before anything moves. */
const START = 150;
const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const DIVE_IN = Easing.bezier(0.55, 0, 0.85, 0.25);

const at = (delay: number, duration: number, easing: WithTimingConfig['easing'] = EASE_OUT) => withDelay(START + delay, withTiming(1, { duration, easing }));

export default function OpeningScreen({ mode, onDone }: { mode: ThemeMode; onDone: () => void }) {
  const reduced = useReducedMotion();
  const { fonts } = useTypography();
  const { width, height } = useWindowDimensions();
  const dark = mode === 'dark';

  const night = useSharedValue(0); // green → night: background, lines, pitch (dark only)
  const light = useSharedValue(0); // the wallpaper's glows and the faint stripes (dark) / the stripes (light)
  const line = useSharedValue(0);
  const grow = useSharedValue(0);
  const name = useSharedValue(0);
  const dive = useSharedValue(0);
  const gone = useSharedValue(0);

  useEffect(() => {
    const finish = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(onDone);
    };
    if (reduced) {
      gone.set(withDelay(START + 250, withTiming(1, { duration: 250, easing: EASE_OUT }, finish)));
      return;
    }
    if (dark) night.set(at(0, 400, IN_OUT));
    line.set(at(100, 400));
    light.set(at(dark ? 300 : 100, 400, Easing.linear));
    grow.set(at(300, 400));
    name.set(withDelay(START + 500, withSequence(withTiming(1, { duration: 400, easing: EASE_OUT }), withDelay(600, withTiming(2, { duration: 200, easing: EASE_OUT })))));
    dive.set(at(1500, 500, DIVE_IN));
    gone.set(withDelay(START + 1750, withTiming(1, { duration: 400, easing: EASE_OUT }, finish)));
    // Started once, on mount; the shared values never change identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lineFrom = (72 * U) / width;
  // The dive scales about a point of grass inside the circle, left of the pitch (the canvas's choice).
  const ox = (34 - 50) * U * GROW;
  const oy = (40 - 50) * U * GROW;

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - gone.get() }));
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.get() }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: light.get() }));
  const diveStyle = useAnimatedStyle(() => {
    const s = interpolate(dive.get(), [0, 1], [1, 18]);
    return { transform: [{ translateX: ox * (1 - s) }, { translateY: oy * (1 - s) }, { scale: s }] };
  });
  const lineStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(night.get(), [0, 1], [C.lines, C.nightLines]),
    transform: [{ scaleX: interpolate(line.get(), [0, 1], [lineFrom, 1]) }],
  }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(grow.get(), [0, 1], [1, GROW]) }] }));
  const ringStyle = useAnimatedStyle(() => ({ borderColor: interpolateColor(night.get(), [0, 1], [C.lines, C.nightLines]) }));
  const pitchStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(night.get(), [0, 1], [C.pitch, C.nightPitch]) }));
  const creaseStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(night.get(), [0, 1], [C.lines, C.nightCrease]) }));
  const dotStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(night.get(), [0, 1], [C.ground, C.night]) }));
  const nameStyle = useAnimatedStyle(() => {
    const v = name.get();
    return {
      opacity: v <= 1 ? v : 2 - v,
      transform: [{ translateY: v <= 1 ? (1 - v) * 12 : (v - 1) * 24 }, { scale: v <= 1 ? 1 : 1 - (v - 1) * 0.04 }],
    };
  });

  const stripes = Array.from({ length: Math.ceil(width / 80) }, (_, i) => (
    <View key={i} style={[styles.stripe, { left: i * 80, backgroundColor: dark ? C.nightStripe : C.stripe }]} />
  ));
  const dots = [23, 77].flatMap((y) => [47, 50, 53].map((x) => (
    <Animated.View key={`${x}-${y}`} style={[styles.dot, { left: (x - 1.2) * U, top: (y - 1.2) * U }, dotStyle]} />
  )));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      accessible
      accessibilityLabel="KickCricket. Football and cricket, scored live."
    >
      <StatusBar style="light" />
      {dark && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.night, nightStyle]} />}
      {dark && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wall, lightStyle]} />}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, diveStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, lightStyle]}>{stripes}</Animated.View>
        <Animated.View style={[styles.line, { top: height / 2 - 1.6 }, lineStyle]} />
        <Animated.View style={[styles.mark, { left: width / 2 - 50 * U, top: height / 2 - 50 * U }, markStyle]}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.pitch, pitchStyle]} />
          <Animated.View style={[styles.crease, { top: 26 * U }, creaseStyle]} />
          <Animated.View style={[styles.crease, { top: 72 * U }, creaseStyle]} />
          {dots}
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.nameBox, { top: height / 2 + 36 * U * GROW + 30 }, nameStyle]}>
        <Text style={[styles.name, { fontFamily: fonts.bodySemiBold }]}>KickCricket</Text>
        <Text style={[styles.tagline, { fontFamily: fonts.body }]}>Football and cricket, scored live</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: C.ground, zIndex: 1000 },
  night: { backgroundColor: C.night },
  wall: Platform.OS === 'web' ? ({ backgroundImage: neutralWall.wall } as object) : { experimental_backgroundImage: neutralWall.wall },
  stripe: { position: 'absolute', top: 0, bottom: 0, width: 40 },
  line: { position: 'absolute', left: 0, right: 0, height: 3.2, opacity: 0.9 },
  mark: { position: 'absolute', width: 100 * U, height: 100 * U },
  // The circle's stroke sits on radius 25, so its box is 25 + half the stroke each way.
  ring: { position: 'absolute', left: 23.4 * U, top: 23.4 * U, width: 53.2 * U, height: 53.2 * U, borderRadius: 26.6 * U, borderWidth: 3.2 * U, opacity: 0.92 },
  pitch: { position: 'absolute', left: 43 * U, top: 19 * U, width: 14 * U, height: 62 * U, borderRadius: 2 * U },
  crease: { position: 'absolute', left: 40 * U, width: 20 * U, height: 2 * U },
  dot: { position: 'absolute', width: 2.4 * U, height: 2.4 * U, borderRadius: 1.2 * U },
  nameBox: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  name: { color: C.name, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  tagline: { color: C.tagline, fontSize: 15, lineHeight: 20, marginTop: 6 },
});
