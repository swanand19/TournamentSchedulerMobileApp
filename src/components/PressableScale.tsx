import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { swipedSince } from '@/lib/swipeGuard';
import { CSS_EASE_OUT, EASE_OUT, RELEASE } from '@/lib/motion';
import { useGlassSupport } from '@/theme/glass';

// Every tappable thing in the app. Feedback starts the moment a finger lands (press-in, not
// release), which tells a scorer at the boundary the tap registered before the server has answered.
// Two feels, both on the UI thread so a busy JS thread can't make them stutter:
//  - press (rows, keys, chips): shrinks to 0.97 in 120ms — near-imperceptible, because it happens
//    dozens of times a match. A Reanimated CSS transition; no shared value needed.
//  - glass (glass buttons, bar buttons): Apple's Liquid Glass answer to a touch — it swells a little
//    and lights up from within, then springs back with one soft bounce when the finger lifts. A
//    finger is involved, so springs. On iOS 26 the native glass does this itself and we stay out of
//    its way.
// `glow` adds the light to a press-feel element (the run pad's keys light up as they're struck).
// Reduce Motion: no scale either way; the light still says "pressed".
//
// The Pressable itself is the animated view, so a caller's layout styles (flex: 1 in a row of
// buttons, alignSelf, margins) land on the element that actually takes part in layout.

/**
 * How far a finger may drift off a press before it stops counting. React Native checks this against
 * where the element was measured, and inside a ScrollView sticky header that measurement ignores
 * the pinning (a native transform), so after scrolling a tap that moved a hair read as a drag-off
 * and did nothing. <StickyBand /> raises it for everything pinned; the ScrollView still takes a
 * real drag.
 */
export const PressRetentionContext = createContext(16);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  feel?: 'press' | 'glass';
  /** Light up under the finger (always on for the glass feel). */
  glow?: boolean;
  /** The element's corner radius, so the light fills its shape. */
  glowRadius?: number;
};

export default function PressableScale({
  style,
  children,
  disabled,
  hitSlop = 8,
  onPress,
  onLongPress,
  feel = 'press',
  glow,
  glowRadius = 0,
  ...rest
}: Props) {
  const [pressed, setPressed] = useState(false);
  // When this press went down — a hub swipe that starts after it means it wasn't a tap.
  const pressedAt = useRef(0);
  const reducedMotion = useReducedMotion();
  const retention = useContext(PressRetentionContext);
  const support = useGlassSupport();
  // Native glass answers the touch itself.
  const glass = feel === 'glass' && support !== 'native';
  const lit = (glass || !!glow) && !disabled;

  const swell = useSharedValue(1);
  const light = useSharedValue(0);
  const swellStyle = useAnimatedStyle(() => ({ transform: [{ scale: swell.get() }] }));
  const lightStyle = useAnimatedStyle(() => ({ opacity: light.get() }));

  const down = () => {
    if (lit) light.set(withTiming(1, { duration: 120, easing: EASE_OUT }));
    if (glass && !reducedMotion) swell.set(withSpring(1.04, { duration: 260, dampingRatio: 0.75 }));
  };
  const up = () => {
    if (lit) light.set(withTiming(0, { duration: 360, easing: EASE_OUT }));
    if (glass && !reducedMotion) swell.set(withSpring(1, RELEASE));
  };

  const scale = !glass && pressed && !disabled && !reducedMotion ? 0.97 : 1;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      accessibilityState={{ ...rest.accessibilityState, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={hitSlop}
      pressRetentionOffset={retention}
      // After {...rest}, so a caller's handlers run alongside the press feedback, not instead of it.
      onPressIn={(e) => {
        pressedAt.current = Date.now();
        setPressed(true);
        down();
        rest.onPressIn?.(e);
      }}
      onPress={
        onPress
          ? (e) => {
              const swiped = swipedSince(pressedAt.current);
              pressedAt.current = 0;
              if (!swiped) onPress(e);
            }
          : undefined
      }
      onLongPress={onLongPress ? (e) => !swipedSince(pressedAt.current) && onLongPress(e) : undefined}
      onPressOut={(e) => {
        setPressed(false);
        up();
        rest.onPressOut?.(e);
      }}
      style={[
        style,
        disabled && { opacity: 0.5 },
        glass
          ? swellStyle
          : {
              transform: [{ scale }],
              transitionProperty: 'transform',
              transitionDuration: 120,
              transitionTimingFunction: CSS_EASE_OUT,
            },
      ]}
    >
      {children}
      {lit && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.light, { borderRadius: glowRadius }, lightStyle]}
        />
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // The light from within: brighter at the top, where the rim catches it.
  light: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 0 18px rgba(255,255,255,0.18)',
  },
});
