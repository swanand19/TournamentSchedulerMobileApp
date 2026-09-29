import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { swipedSince } from '@/lib/swipeGuard';

// Every tappable thing in the app. It shrinks to 0.97 the moment a finger lands (press-in, not
// release), which is the feedback that tells a scorer at the boundary the tap registered before
// the server has answered. A Reanimated CSS transition runs it on the UI thread, so a busy JS
// thread can't make it stutter.
//
// The Pressable itself is the animated view, so a caller's layout styles (flex: 1 in a row of
// buttons, alignSelf, margins) land on the element that actually takes part in layout.

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

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
};

export default function PressableScale({ style, children, disabled, hitSlop = 8, onPress, onLongPress, ...rest }: Props) {
  const [pressed, setPressed] = useState(false);
  // When this press went down — a hub swipe that starts after it means it wasn't a tap.
  const pressedAt = useRef(0);
  const reducedMotion = useReducedMotion();
  const retention = useContext(PressRetentionContext);
  const scale = pressed && !disabled && !reducedMotion ? 0.97 : 1;

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
        rest.onPressOut?.(e);
      }}
      style={[
        style,
        disabled && { opacity: 0.5 },
        {
          transform: [{ scale }],
          transitionProperty: 'transform',
          transitionDuration: 120,
          transitionTimingFunction: EASE_OUT,
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
