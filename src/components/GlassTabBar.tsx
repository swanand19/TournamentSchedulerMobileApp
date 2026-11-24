import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glass from '@/components/Glass';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useMorphPill } from '@/components/useMorphPill';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// The glass theme's tab bar: a capsule of clear glass floating above the content, as iOS 26 draws
// it, with the chosen tab lifted on a brighter pill in the sport's colour. The pill morphs between
// tabs, starting in the tap itself (see useMorphPill). The pages underneath swap instantly: tabs are
// peers.
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
  const { pillStyle, onItemLayout, moveTo } = useMorphPill(value);

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
                moveTo(t.key); // the pill leaves now, ahead of the page's render
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
