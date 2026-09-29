import { StyleSheet, Text, View } from 'react-native';

import { initials } from '@/lib/format';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts } from '@/theme/theme';

// The little round markers beside names: a team's initials, a player's shirt number.

export function TeamBadge({ name, size = 36, home }: { name: string; size?: number; home?: boolean }) {
  const theme = useSportTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: home ? theme.accent : theme.deckRaised,
          borderColor: home ? 'transparent' : theme.borderOnDark,
        },
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.42, color: home ? theme.accentInk : theme.onDark }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function JerseyBadge({ number, size = 44, highlight }: { number: number | null; size?: number; highlight?: boolean }) {
  const theme = useSportTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: highlight ? theme.accent : theme.ink,
          borderColor: 'transparent',
        },
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.45, color: highlight ? theme.accentInk : theme.cream }}>
        {number ?? '–'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
