import { StyleSheet, Text, View } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts } from '@/theme/theme';

// Tabs over swipeable peer pages (a career's Stats / Teams / …, a match's Live / Scorecard): the
// chosen one is underlined in the accent. Pair with TabPager.

export default function UnderlineTabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
}) {
  const theme = useSportTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.deck, borderBottomColor: theme.borderOnDark }]}>
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
            <Text style={[styles.tabLabel, { color: on ? theme.onDark : theme.onDarkSoft }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {t.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent', paddingHorizontal: 2 },
  tabLabel: { fontFamily: fonts.bodySemiBold, fontSize: 15 },
});
