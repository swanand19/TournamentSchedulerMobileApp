import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

// The "this is happening now" pulse beside a live match. State indication, not decoration: it's
// the only moving thing on a list of fixtures, so the eye finds the live one first. A CSS
// animation on the UI thread; with Reduce Motion on it's a steady dot, which still says "live".

const PULSE = {
  '0%': { opacity: 1, transform: [{ scale: 1 }] },
  '50%': { opacity: 0.35, transform: [{ scale: 0.8 }] },
  '100%': { opacity: 1, transform: [{ scale: 1 }] },
};

const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1);

/** `glow` lights the dot from within, as the glass theme draws it on the wallpaper. */
export default function LiveDot({ color, size = 8, glow }: { color: string; size?: number; glow?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        glow && { boxShadow: `0 0 ${size}px ${color}` },
        !reduced && {
          animationName: PULSE,
          animationDuration: 1600,
          animationIterationCount: 'infinite',
          animationTimingFunction: EASE_IN_OUT,
        },
      ]}
    />
  );
}

