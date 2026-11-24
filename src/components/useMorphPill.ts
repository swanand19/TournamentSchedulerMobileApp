import { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

// The selection pill of a glass track (SegmentedControl, GlassTabBar). It morphs rather than slides:
// its leading edge springs ahead and its trailing edge follows, so it stretches toward the new
// choice and gathers itself there, the way Liquid Glass shapes flow into each other.
//
// It starts moving in the tap itself (`moveTo` from the press handler), not when the parent has
// re-rendered with the new value. The springs run on the UI thread, so the pill is already on its
// way while React builds the page that was chosen — before, a heavy page made the pill wait for it,
// and the tap felt late. A value that changes any other way (a swipe between pages) is followed by
// the effect, which does nothing when the pill is already heading there.
//
// Segments are measured once with onLayout; then only the pill's two edges animate. It is absolutely
// positioned with no children, so its width change never re-lays-out the labels.

type Layout = { x: number; width: number };

const LEAD = { duration: 320, dampingRatio: 0.78 };
const TRAIL = { duration: 460, dampingRatio: 0.86 };

export function useMorphPill<K extends string>(value: K) {
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<K, Layout>>>({});
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const shown = useSharedValue(0);
  // Where the pill is, or is already heading. Kept here so deciding the direction never has to read
  // a shared value back from the UI thread.
  const heading = useRef<(Layout & { key: K }) | null>(null);

  const moveTo = (key: K) => {
    const to = layouts[key];
    if (!to) return;
    const from = heading.current;
    if (from && from.key === key && from.x === to.x && from.width === to.width) return;
    heading.current = { key, x: to.x, width: to.width };
    // First placement jumps; after that it morphs. Reduce Motion always jumps.
    if (reduced || !from) {
      left.set(to.x);
      right.set(to.x + to.width);
      shown.set(1);
      return;
    }
    const goingRight = to.x > from.x;
    right.set(withSpring(to.x + to.width, goingRight ? LEAD : TRAIL));
    left.set(withSpring(to.x, goingRight ? TRAIL : LEAD));
  };

  useEffect(() => {
    moveTo(value);
    // moveTo reads the measured layouts and the motion setting, listed here in its place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, layouts, reduced]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    width: Math.max(0, right.get() - left.get()),
    transform: [{ translateX: left.get() }],
  }));

  const onItemLayout = (key: K) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }));
  };

  return { pillStyle, onItemLayout, moveTo };
}
