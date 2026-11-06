import { StyleSheet, Text, View } from 'react-native';

import PressableScale from '@/components/PressableScale';
import SegmentedControl from '@/components/SegmentedControl';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { type Typography } from '@/theme/theme';

// Tabs over swipeable peer pages (a career's Stats / Teams / …, a match's Live / Scorecard). Pair
// with TabPager. Glass: the same glass track and flowing pill as every segmented choice, so the
// app has one way of saying "pick one of these". Light: words underlined in the accent.

export default function UnderlineTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  if (theme.mode === 'dark') {
    return <SegmentedControl segments={tabs} value={value} onChange={onChange} style={styles.glass} />;
  }
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: theme.borderOnDark }]}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <PressableScale
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.tab, on && { borderBottomColor: theme.accent }]}
          >
            <Text
              style={[styles.tabLabel, !on && styles.lightLabel, { color: on ? theme.onDark : theme.onDarkSoft }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {t.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  glass: { marginHorizontal: 16, marginVertical: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingHorizontal: 2 },
  lightLabel: { fontFamily: fonts.body },
  tabLabel: { fontFamily: fonts.bodySemiBold, fontSize: 15 },
});
