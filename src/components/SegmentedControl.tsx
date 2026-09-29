import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space } from '@/theme/theme';

// Peer choices: sport, hub tabs, team in a two-team form. The amber pill glides to the chosen
// segment (spatial consistency — it says where you went), but the content underneath swaps
// instantly: tabs are peers, and sliding them would imply a depth that isn't there.
//
// Measured once with onLayout, then only transform and width animate. The pill is absolutely
// positioned with no children, so its width change never re-lays-out the labels.

const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);

export type Segment<K extends string> = { key: K; label: string; badge?: string | number };

type Props<K extends string> = {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
  /** Display font, like the hub tabs in the design. */
  display?: boolean;
  accessibilityLabel?: string;
};

type Layout = { x: number; width: number };

export default function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  style,
  display,
  accessibilityLabel,
}: Props<K>) {
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<K, Layout>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    // First placement jumps; after that it glides. Reduce Motion always jumps.
    if (reduced || shown.get() === 0) {
      x.set(l.x);
      w.set(l.width);
      shown.set(1);
      return;
    }
    x.set(withTiming(l.x, { duration: 250, easing: EASE_IN_OUT }));
    w.set(withTiming(l.width, { duration: 250, easing: EASE_IN_OUT }));
  }, [value, layouts, reduced, x, w, shown]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    width: w.get(),
    transform: [{ translateX: x.get() }],
  }));

  const onItemLayout = (key: K) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[key]?.x === lx && prev[key]?.width === width ? prev : { ...prev, [key]: { x: lx, width } }));
  };

  return (
    <View
      style={[styles.track, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }, style]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.pill, { backgroundColor: theme.accent }, pillStyle]} />
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <PressableScale
            key={s.key}
            onLayout={onItemLayout(s.key)}
            onPress={() => {
              if (active) return;
              haptic.select(); // on the press, not when the pill lands
              onChange(s.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={s.badge !== undefined ? `${s.label}, ${s.badge}` : s.label}
            style={styles.item}
            hitSlop={4}
          >
            <Text
              numberOfLines={1}
              style={[
                display ? styles.displayLabel : styles.label,
                { color: active ? theme.accentInk : theme.onDarkSoft },
              ]}
            >
              {display ? s.label.toUpperCase() : s.label}
            </Text>
            {s.badge !== undefined && (
              <View style={[styles.badge, { backgroundColor: active ? 'rgba(0,0,0,0.15)' : theme.surfaceOnDark }]}>
                <Text style={[styles.badgeText, { color: active ? theme.accentInk : theme.onDarkSoft }]}>{s.badge}</Text>
              </View>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: radius.xl, padding: 4, borderWidth: 1 },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: radius.lg },
  item: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.xs,
  },
  label: { fontFamily: fonts.bodyBold, fontSize: 15 },
  displayLabel: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 0.8 },
  badge: { borderRadius: radius.pill, minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, alignItems: 'center' },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
