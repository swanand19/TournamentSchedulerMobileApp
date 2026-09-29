import { useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

// A scoreboard figure that punches when it changes — a goal, a wicket. Feedback that the number
// the scorer just caused has landed, and a cue for anyone glancing over. It fires only on change,
// never on first render, and it's kept for rare changes: cricket runs tick every ball, so the
// console bumps wickets, not runs.
//
// The new value remounts with a one-shot CSS keyframe (scale 1.22 → 1, 300ms strong ease-out) on
// the UI thread. Reduce Motion shows the new value with no movement.

const BUMP = {
  from: { transform: [{ scale: 1.22 }] },
  to: { transform: [{ scale: 1 }] },
};
const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);

export default function Bump({ value, style }: { value: number | string; style?: StyleProp<TextStyle> }) {
  const reduced = useReducedMotion();
  // "Storing information from previous renders": compare during render, no effect needed.
  const [previous, setPrevious] = useState(value);
  const [tick, setTick] = useState(0);
  if (value !== previous) {
    setPrevious(value);
    setTick(tick + 1);
  }

  return (
    <Animated.Text
      key={tick}
      style={[
        style,
        tick > 0 && !reduced && { animationName: BUMP, animationDuration: 300, animationTimingFunction: EASE_OUT },
      ]}
    >
      {value}
    </Animated.Text>
  );
}
