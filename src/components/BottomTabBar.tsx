import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GlassTabBar, { TAB_BAR_ROOM, type GlassTab } from '@/components/GlassTabBar';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// A screen's own tabs at the bottom (Home's Tournaments · Teams · Find, 2026-11-26, canvas "Home page: the tournaments
// first"). Glass: the floating glass capsule (GlassTabBar). Light: a white bar closed by a hairline at the top, the
// chosen tab's icon on a pill of the sport's tint, its label in the accent ink.

/** Room a page needs at its end to scroll clear of the bar, safe area included. */
export function useBottomTabRoom(): number {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  return theme.mode === 'dark' ? TAB_BAR_ROOM + insets.bottom : LIGHT_BAR + Math.max(insets.bottom, space.sm) + space.lg;
}

const LIGHT_BAR = 62;

export default function BottomTabBar<K extends string>(props: {
  tabs: GlassTab<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
}) {
  const theme = useSportTheme();
  return theme.mode === 'dark' ? <GlassTabBar {...props} /> : <LightTabBar {...props} />;
}

function LightTabBar<K extends string>({ tabs, value, onChange, accessibilityLabel }: {
  tabs: GlassTab<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel?: string;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.bar, { backgroundColor: theme.page, borderTopColor: theme.cardDivider, paddingBottom: Math.max(insets.bottom, space.sm) }]}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
    >
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <PressableScale
            key={t.key}
            onPress={() => {
              if (on) return;
              haptic.select();
              onChange(t.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
            style={styles.tab}
          >
            <View style={[styles.pill, on && { backgroundColor: theme.tint }]}>
              <Icon name={t.icon} size={22} color={on ? theme.deep : theme.muted} />
            </View>
            <Text style={[on ? styles.labelOn : styles.label, { color: on ? theme.deep : theme.muted }]} numberOfLines={1}>
              {t.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', borderTopWidth: 1, paddingTop: 6 },
  tab: { flex: 1, minHeight: LIGHT_BAR - 6, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pill: { width: 60, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  labelOn: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
});
