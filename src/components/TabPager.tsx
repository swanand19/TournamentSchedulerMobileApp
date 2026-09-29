import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { markSwipeStart } from '@/lib/swipeGuard';

// Peer pages side by side: tap a tab and the page swaps instantly (tabs are peers — sliding would
// imply a depth that isn't there), or swipe and the pages follow the finger.
//
// The swipe, per the animate-expo rules:
//  - Pan with activeOffsetX and failOffsetY, so a vertical scroll inside a page always wins and
//    the pager only takes a deliberate sideways drag.
//  - Momentum decides the page, not distance: a quick flick turns it even if it moved a little.
//  - Past the first and last page the drag resists (rubber band) instead of stopping dead.
//  - Release hands the finger's velocity to a critically damped spring with overshoot clamped, so
//    the neighbouring page never peeks in after the snap.
// Pages mount the first time they're shown and then stay mounted, keeping their scroll position.

function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}


type Props<K extends string> = {
  pages: K[];
  value: K;
  onChange: (key: K) => void;
  renderPage: (key: K, active: boolean) => ReactNode;
};

export default function TabPager<K extends string>({ pages, value, onChange, renderPage }: Props<K>) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const [visited, setVisited] = useState<Set<K>>(() => new Set([value]));
  if (!visited.has(value)) setVisited(new Set(visited).add(value));

  const index = pages.indexOf(value);
  const x = useSharedValue(0);
  const dragStart = useSharedValue(0);

  // The page a swipe is already springing to, set on the UI thread at release. When the parent
  // then reports that change back as `value`, the effect below must not snap over the spring.
  const swipedTo = useSharedValue<string | null>(null);
  const settle = useCallback(
    (key: K) => {
      haptic.select();
      onChange(key);
    },
    [onChange],
  );

  // A tap on a tab (or the first layout) jumps straight there; only a finger slides pages.
  useEffect(() => {
    if (width === 0) return;
    if (swipedTo.get() === pages[index]) {
      swipedTo.set(null);
      return;
    }
    x.set(-index * width);
  }, [index, width, x, pages, swipedTo]);

  const last = pages.length - 1;
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(width > 0)
        .activeOffsetX([-18, 18])
        .failOffsetY([-12, 12])
        .onStart(() => {
          dragStart.set(x.get());
          scheduleOnRN(markSwipeStart); // once per swipe: the card under the finger mustn't also open
        })
        .onUpdate((e) => {
          const next = dragStart.get() + e.translationX;
          const min = -last * width;
          x.set(next > 0 ? rubberband(next, width) : next < min ? min + rubberband(next - min, width) : next);
        })
        .onEnd((e) => {
          const from = Math.round(-dragStart.get() / width);
          const projected = -(x.get() + project(e.velocityX)) / width;
          const target = Math.max(0, Math.min(last, Math.max(from - 1, Math.min(from + 1, Math.round(projected)))));
          x.set(
            reduced
              ? -target * width
              : withSpring(-target * width, { duration: 350, dampingRatio: 1, velocity: e.velocityX, overshootClamping: true }),
          );
          if (target !== from) {
            swipedTo.set(pages[target]);
            scheduleOnRN(settle, pages[target]);
          }
        }),
    [width, last, dragStart, x, reduced, settle, pages, swipedTo],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) setWidth(w);
  };

  return (
    <View style={styles.viewport} onLayout={onLayout}>
      {width > 0 && (
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.row, { width: width * pages.length }, rowStyle]}>
            {pages.map((key) => (
              <View
                key={key}
                style={{ width }}
                // Off-screen pages are hidden from screen readers; TalkBack users switch with the tabs.
                importantForAccessibility={key === value ? 'auto' : 'no-hide-descendants'}
                accessibilityElementsHidden={key !== value}
              >
                {visited.has(key) ? renderPage(key, key === value) : null}
              </View>
            ))}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
});
