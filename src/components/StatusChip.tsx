import { StyleSheet, Text, View } from 'react-native';

import LiveDot from '@/components/LiveDot';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Small status words. The tone carries meaning, and the words always say it too — colour is never
// the only cue. Neither theme draws a pill: just the words in the tone's colour, a live one led by
// its pulsing dot (glowing on the glass theme's wallpaper, in a pale ring on the light theme's
// white). Only an abandonment ("danger") keeps a red pill, so it can't be missed.
//  live / ready / accent – the sport's colour     setup / warn – amber (glass) or the sport's ink
//  done – secondary text                           danger – red pill

export type ChipTone = 'live' | 'ready' | 'setup' | 'done' | 'warn' | 'danger' | 'accent';

/** `onDark` is kept for callers drawn on the wallpaper; both themes now read the same there. */
export default function StatusChip({ label, tone }: { label: string; tone: ChipTone; onDark?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';

  if (tone === 'danger') {
    return (
      <View style={[styles.chip, { backgroundColor: theme.dangerSolid }]}>
        <Text style={[styles.text, { color: '#FFFFFF' }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }

  const ink: Record<Exclude<ChipTone, 'danger'>, string> = light
    ? { live: theme.deep, ready: theme.successInk, setup: theme.deep, done: theme.muted, warn: theme.warnInk, accent: theme.deep }
    : { live: theme.accent, ready: theme.accent, setup: theme.warnInk, done: theme.onDarkSoft, warn: theme.warnInk, accent: theme.accent };

  return (
    <View style={styles.plain}>
      {tone === 'live' &&
        (light ? (
          <View style={[styles.ring, { backgroundColor: theme.tint }]}>
            <LiveDot color={theme.accent} size={7} />
          </View>
        ) : (
          <LiveDot color={theme.accent} size={8} glow />
        ))}
      <Text style={[light ? styles.lightText : styles.text, { color: ink[tone] }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
  },
  text: { fontFamily: fonts.bodySemiBold, fontSize: 13, lineHeight: 17 },
  plain: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ring: { width: 15, height: 15, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  lightText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
