import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type AppTheme } from '@/theme/theme';

// The surfaces content sits on. In the glass theme they're frosted panes over the wallpaper — the
// sport's colour shows through softly — never glass, which is kept for the floating controls:
//  Card  – the everyday group of rows or a form.
//  Deck  – a weightier group: the scoreboard, a sheet's own panel. A denser frost.
//  Panel – a quiet group straight on the wallpaper. The lightest frost.
// The light theme has no panels at all: each becomes an open section on the white, opened by a
// hairline and aligned with the rest of the screen.

type Props = { children: ReactNode; style?: StyleProp<ViewStyle>; accessibilityLabel?: string };

const flat = (theme: AppTheme) => [styles.flat, { borderTopColor: theme.cardDivider }];

export function Card({ children, style, accessibilityLabel }: Props) {
  const theme = useSportTheme();
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.card, theme.mode === 'light' ? flat(theme) : { backgroundColor: theme.cream }, style]}
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
      style={[
        styles.deck,
        theme.mode === 'light' ? flat(theme) : { backgroundColor: theme.deck },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A light frost directly on the wallpaper, for secondary groups. */
export function Panel({ children, style }: Props) {
  const theme = useSportTheme();
  return (
    <View
      style={[
        styles.panel,
        theme.mode === 'light' ? flat(theme) : { backgroundColor: theme.surfaceOnDark },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.glass, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  deck: { borderRadius: radius.glass, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  panel: { borderRadius: radius.glass, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  flat: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderWidth: 0,
    borderTopWidth: 1,
    paddingHorizontal: 0,
    paddingBottom: space.xs,
  },
});
