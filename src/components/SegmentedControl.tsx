import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import Glass from '@/components/Glass';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Peer choices: sport, a career's stat groups, team in a two-team form. In the glass theme a pill
// of brighter glass flows to the chosen segment (spatial consistency — it says where you went); in
// the light theme the choices are outlined pills or underlined tabs.

export type Segment<K extends string> = { key: K; label: string; badge?: string | number };

type Props<K extends string> = {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  style?: StyleProp<ViewStyle>;
  /** Display font, like the hub tabs in the design. */
  display?: boolean;
  /** In the light theme, draw a screen's top-level sections as underlined tabs instead of pills. */
  variant?: 'pills' | 'tabs';
  accessibilityLabel?: string;
};

type Layout = { x: number; width: number };

export default function SegmentedControl<K extends string>(props: Props<K>) {
  const theme = useSportTheme();
  return theme.mode === 'light' ? <LightSegments {...props} /> : <GlassSegments {...props} />;
}

/**
 * The light theme's version: no track and no sliding fill. Choices are hairline-outlined pills, the
 * chosen one tinted with an accent edge (and a heavier label, so it doesn't rest on colour alone);
 * a screen's sections are words underlined in the accent.
 */
function LightSegments<K extends string>({ segments, value, onChange, style, variant, accessibilityLabel }: Props<K>) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const tabs = variant === 'tabs';
  return (
    <View
      style={[tabs ? [styles.lightTabs, { borderBottomColor: theme.cardDivider }] : styles.lightPills, style]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <PressableScale
            key={s.key}
            onPress={() => {
              if (active) return;
              haptic.select();
              onChange(s.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={s.badge !== undefined ? `${s.label}, ${s.badge}` : s.label}
            style={
              tabs
                ? [styles.lightTab, { borderBottomColor: active ? theme.accent : 'transparent' }]
                : [
                    styles.lightPill,
                    active
                      ? { backgroundColor: theme.tint, borderColor: theme.accent, borderWidth: 1.5 }
                      : { borderColor: theme.fieldBorder },
                  ]
            }
            hitSlop={4}
          >
            <Text
              numberOfLines={1}
              style={[
                active ? styles.lightLabelOn : styles.lightLabel,
                { color: tabs ? (active ? theme.ink : theme.muted) : active ? theme.deep : theme.ink },
              ]}
            >
              {s.label}
              {s.badge !== undefined ? <Text style={{ color: active ? theme.deep : theme.muted }}> {s.badge}</Text> : null}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * The glass version: a clear glass track with a brighter glass pill under the chosen segment. The
 * pill morphs rather than slides — its leading edge springs ahead and its trailing edge follows, so
 * it stretches toward the new segment and gathers itself there, the way Liquid Glass shapes flow
 * into each other. The content underneath swaps instantly: tabs are peers, and sliding them would
 * imply a depth that isn't there.
 *
 * Measured once with onLayout; then only the pill's two edges animate. It is absolutely positioned
 * with no children, so its width change never re-lays-out the labels.
 */
function GlassSegments<K extends string>({ segments, value, onChange, style, accessibilityLabel }: Props<K>) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<K, Layout>>>({});
  const left = useSharedValue(0);
  const right = useSharedValue(0);
  const shown = useSharedValue(0);
  const crowded = segments.length > 3;

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    const to = { left: l.x, right: l.x + l.width };
    // First placement jumps; after that it morphs. Reduce Motion always jumps.
    if (reduced || shown.get() === 0) {
      left.set(to.left);
      right.set(to.right);
      shown.set(1);
      return;
    }
    const lead = { duration: 320, dampingRatio: 0.78 };
    const trail = { duration: 460, dampingRatio: 0.86 };
    const goingRight = to.left > left.get();
    right.set(withSpring(to.right, goingRight ? lead : trail));
    left.set(withSpring(to.left, goingRight ? trail : lead));
  }, [value, layouts, reduced, left, right, shown]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    width: Math.max(0, right.get() - left.get()),
    transform: [{ translateX: left.get() }],
  }));

  const onItemLayout = (key: K) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[key]?.x === lx && prev[key]?.width === width ? prev : { ...prev, [key]: { x: lx, width } }));
  };

  return (
    <Glass radius={24} style={[styles.track, style]} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, { backgroundColor: theme.glassSelected, boxShadow: `inset 0 1px 0 ${theme.glassRim}` }, pillStyle]}
      />
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
            // Four or more: each segment as wide as its words, so none is cut short.
            style={[styles.item, crowded && styles.crowdedItem]}
            hitSlop={4}
          >
            <Text numberOfLines={1} style={[active ? styles.labelOn : styles.label, crowded && styles.crowdedLabel, { color: theme.onDark }]}>
              {s.label}
              {s.badge !== undefined ? <Text style={[styles.label, { color: theme.onDarkSoft }]}> {s.badge}</Text> : null}
            </Text>
          </PressableScale>
        );
      })}
    </Glass>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  track: { flexDirection: 'row', padding: 4 },
  pill: { position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: 20, borderCurve: 'continuous' },
  item: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  labelOn: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  crowdedItem: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', paddingHorizontal: 10 },
  crowdedLabel: { fontSize: 13 },
  lightPills: { flexDirection: 'row', gap: space.sm },
  lightPill: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  lightTabs: { flexDirection: 'row', gap: 24, borderBottomWidth: 1 },
  lightTab: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, marginBottom: -1 },
  lightLabel: { fontFamily: fonts.body, fontSize: 16 },
  lightLabelOn: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
});
