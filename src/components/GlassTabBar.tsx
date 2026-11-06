import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glass from '@/components/Glass';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// The glass theme's tab bar: a capsule of clear glass floating above the content, as iOS 26 draws
// it, with the chosen tab lifted on a brighter pill in the sport's colour. The pill morphs between
// tabs — the leading edge springs ahead, the trailing edge follows — the way Liquid Glass shapes flow
// into each other. The pages underneath swap instantly: tabs are peers.
// Pages under it end with TAB_BAR_ROOM of space so their last row scrolls clear of it.

export type GlassTab<K extends string> = { key: K; label: string; icon: IconName };

/** How much room a page needs at its end to scroll clear of the bar (on top of the safe area). */
export const TAB_BAR_ROOM = 96;

export default function GlassTabBar<K extends string>({
  tabs,
  value,
  onChange,
  accessibilityLabel,
}: {
  tabs: GlassTab<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<K, { x: number; width: number }>>>({});
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    if (reduced || shown.get() === 0) {
      left.set(l.x);
      right.set(l.x + l.width);
      shown.set(1);
      return;
    }
    const lead = { duration: 320, dampingRatio: 0.78 };
    const trail = { duration: 460, dampingRatio: 0.86 };
    const goingRight = l.x > left.get();
    right.set(withSpring(l.x + l.width, goingRight ? lead : trail));
    left.set(withSpring(l.x, goingRight ? trail : lead));
  }, [value, layouts, reduced, left, right, shown]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    width: Math.max(0, right.get() - left.get()),
    transform: [{ translateX: left.get() }],
  }));

  const onItemLayout = (key: K) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }));
  };

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { bottom: Math.max(insets.bottom, space.md) + space.sm }]}>
      <Glass floating radius={32} style={styles.bar} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { backgroundColor: theme.glassSelected, boxShadow: `inset 0 1px 0 ${theme.glassRim}` }, pillStyle]}
        />
        {tabs.map((t) => {
          const on = t.key === value;
          return (
            <PressableScale
              key={t.key}
              onLayout={onItemLayout(t.key)}
              onPress={() => {
                if (on) return;
                haptic.select();
                onChange(t.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.label}
              style={styles.tab}
              hitSlop={4}
            >
              <Icon name={t.icon} size={22} color={on ? theme.accent : theme.onDark} />
              <Text style={[on ? styles.labelOn : styles.label, { color: on ? theme.accent : theme.onDark }]} numberOfLines={1}>
                {t.label}
              </Text>
            </PressableScale>
          );
        })}
      </Glass>
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  anchor: { position: 'absolute', left: space.lg, right: space.lg },
  bar: { flexDirection: 'row', padding: 4 },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 27, borderCurve: 'continuous' },
  tab: { flex: 1, height: 54, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 13 },
  labelOn: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13 },
});
