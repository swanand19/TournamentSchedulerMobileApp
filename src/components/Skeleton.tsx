import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import { useSportTheme } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// The shape of what's loading, gently breathing. Better than a bare spinner on a phone over Wi-Fi:
// the layout doesn't jump when the data lands. Opacity only, on the UI thread; steady under
// Reduce Motion.

const BREATHE = {
  '0%': { opacity: 0.45 },
  '50%': { opacity: 0.9 },
  '100%': { opacity: 0.45 },
};
const EASE = cubicBezier(0.77, 0, 0.175, 1);

export function SkeletonBlock({ height = 72, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      style={[
        { height, borderRadius: radius.lg, backgroundColor: theme.surfaceOnDark },
        !reduced && {
          animationName: BREATHE,
          animationDuration: 1400,
          animationIterationCount: 'infinite',
          animationTimingFunction: EASE,
        },
        style,
      ]}
    />
  );
}

/** A stack of blocks, announced once as "Loading". */
export default function Skeleton({ rows = 4, height = 72 }: { rows?: number; height?: number }) {
  return (
    <View style={styles.stack} accessible accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: space.sm } });
