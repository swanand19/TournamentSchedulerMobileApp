import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSportTheme } from '@/theme/SportTheme';
import { lip, radius, space } from '@/theme/theme';

// The two surfaces content sits on.
//  Card – the cream "team sheet": ink text, a solid 2px lip for depth instead of a soft shadow,
//         which disappears in sunlight.
//  Deck – the dark scoreboard panel floating above the pitch, with a faint floodlight edge.

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string };

export function Card({ children, style, accessibilityLabel }: Props) {
  const theme = useSportTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, { backgroundColor: theme.cream }, lip(theme), style]}
    >
      {children}
    </View>
  );
}

export function Deck({ children, style, accessibilityLabel }: Props) {
  const theme = useSportTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.deck, { backgroundColor: theme.deck, borderColor: theme.accentSoft }, style]}
    >
      {children}
    </View>
  );
}

/** A translucent panel directly on the pitch — lighter than a Deck, for secondary groups. */
export function Panel({ children, style }: Props) {
  const theme = useSportTheme();
  return (
    <View style={[styles.panel, { backgroundColor: theme.surfaceOnDark, borderColor: theme.borderOnDark }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.md },
  deck: { borderRadius: radius.xl, padding: space.lg, gap: space.md, borderWidth: 1 },
  panel: { borderRadius: radius.lg, padding: space.lg, gap: space.md, borderWidth: 1 },
});
