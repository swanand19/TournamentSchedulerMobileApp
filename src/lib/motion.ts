import { cubicBezier, Easing, ReduceMotion, withSpring, withTiming, type EntryExitAnimationFunction } from 'react-native-reanimated';

// The app's motion vocabulary, after Apple's Liquid Glass: glass *materializes* (it grows into place
// as it gains opacity — more than a fade), *morphs* between shapes (a selection pill that stretches
// toward where it's going and then settles), and *answers a touch* (it swells a little and lights
// up, then springs back). Springs where a finger was involved; strong ease-out everywhere else;
// never ease-in. Reduce Motion keeps the opacity and drops the travel and the bounce.

/** Strong ease-out for anything entering or answering a press. */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** For things moving across the screen. */
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
/** The same ease-out for a Reanimated CSS transition (`transitionTimingFunction`). */
export const CSS_EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

/** Settle with no overshoot: a sheet or a panel opening by itself. */
export const SETTLE = { duration: 380, dampingRatio: 1 } as const;
/** A little life on arrival: glass materializing, a menu opening from its button. */
export const MATERIALIZE = { duration: 420, dampingRatio: 0.72 } as const;
/** A glass control springing back when the finger lifts: one soft bounce. */
export const RELEASE = { duration: 480, dampingRatio: 0.55 } as const;

/**
 * Glass appearing: it scales up from 0.92 to full size with one soft overshoot as it fades in. Use
 * as `entering={materialize}` on a floating control, a menu or a dialog.
 */
export const materialize: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.92 }] },
    animations: {
      opacity: withTiming(1, { duration: 180, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
      transform: [{ scale: withSpring(1, { ...MATERIALIZE, reduceMotion: ReduceMotion.System }) }],
    },
  };
};

/** Glass leaving: a quick fade as it shrinks a touch — quicker than it arrived. */
export const dematerialize: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: {
      opacity: withTiming(0, { duration: 160, easing: EASE_OUT, reduceMotion: ReduceMotion.Never }),
      transform: [{ scale: withTiming(0.95, { duration: 160, easing: EASE_OUT, reduceMotion: ReduceMotion.System }) }],
    },
  };
};
