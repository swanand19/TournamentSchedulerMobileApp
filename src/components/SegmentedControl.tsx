import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import Glass from '@/components/Glass';
import PressableScale from '@/components/PressableScale';
import { useMorphPill } from '@/components/useMorphPill';
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
 * pill morphs to the new segment, starting in the tap itself (see useMorphPill). The content
 * underneath swaps instantly: tabs are peers, and sliding them would imply a depth that isn't there.
 */
function GlassSegments<K extends string>({ segments, value, onChange, style, accessibilityLabel }: Props<K>) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const { pillStyle, onItemLayout, moveTo } = useMorphPill(value);
  const crowded = segments.length > 3;

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
              moveTo(s.key); // and the pill leaves now, ahead of the re-render
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
