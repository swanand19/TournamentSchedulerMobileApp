import { StyleSheet, Text, View } from 'react-native';

import { initials } from '@/lib/format';
import { useSportTheme, useTypography } from '@/theme/SportTheme';

// The little round markers beside names: a team's initials, a player's shirt number.
// Glass: initials sit in a small glass bead (the home side's tinted); a shirt number is just the
// figure in the sport's colour, as the design's squad lists draw it.

export function TeamBadge({ name, size = 36, home }: { name: string; size?: number; home?: boolean }) {
  const { fonts } = useTypography();
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        light
          ? { backgroundColor: home ? theme.tint : 'transparent', borderColor: home ? theme.accent : theme.fieldBorder }
          : {
              backgroundColor: home ? theme.accentSoft : theme.glassFill,
              borderColor: home ? theme.accent : theme.glassBorder,
              boxShadow: `inset 0 1px 0 ${theme.glassRim}`,
            },
      ]}
    >
      <Text
        style={
          light
            ? { fontFamily: fonts.display, fontSize: size * 0.42, color: theme.deep }
            : { fontFamily: fonts.bodyBold, fontSize: size * 0.34, color: theme.onDark }
        }
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export function JerseyBadge({ number, size = 44, highlight }: { number: number | null; size?: number; highlight?: boolean }) {
  const { fonts } = useTypography();
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        // Just the number in the sport's ink; a tinted circle when it's the one that matters.
        { backgroundColor: highlight ? theme.tint : 'transparent', borderColor: highlight ? theme.accent : 'transparent' },
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.45, color: light ? theme.deep : highlight ? theme.onDark : theme.accent }}>
        {number ?? '–'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
