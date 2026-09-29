import { StyleSheet, Text, View } from 'react-native';

import LiveDot from '@/components/LiveDot';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space } from '@/theme/theme';

// Small status pills. The tone carries meaning, and the words always say it too — colour is never
// the only cue.
//  live   – green fill, pulsing dot       ready – green tint
//  setup  – amber tint                    done  – neutral chip
//  warn   – brown on amber                danger – red, only for abandonments

export type ChipTone = 'live' | 'ready' | 'setup' | 'done' | 'warn' | 'danger' | 'accent';

export default function StatusChip({ label, tone, onDark }: { label: string; tone: ChipTone; onDark?: boolean }) {
  const theme = useSportTheme();

  const tones: Record<ChipTone, { bg: string; fg: string }> = {
    live: { bg: theme.successSolid, fg: '#FFFFFF' },
    ready: { bg: 'rgba(99,153,34,0.18)', fg: onDark ? '#B9DB94' : theme.successInk },
    setup: { bg: theme.accentSoft, fg: onDark ? theme.accent : theme.warnInk },
    done: { bg: onDark ? theme.surfaceOnDark : theme.chip, fg: onDark ? theme.onDarkSoft : theme.muted },
    warn: { bg: theme.tintAlt, fg: theme.warnInk },
    danger: { bg: theme.dangerSolid, fg: '#FFFFFF' },
    accent: { bg: theme.accent, fg: theme.accentInk },
  };
  const { bg, fg } = tones[tone];

  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {tone === 'live' && <LiveDot color="#FFFFFF" size={7} />}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm + 2,
    paddingVertical: 4,
  },
  text: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
});
