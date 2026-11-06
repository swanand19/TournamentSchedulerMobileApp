import { Platform, StyleSheet, Text, View } from 'react-native';

import type { CricketRules } from '@/api/types';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The scoring keypad, pinned in the thumb zone. A plain tap on a number is a legal ball with that
// many off the bat — the case that happens most, so it takes one tap. The modifiers above change
// what the next number means (a wide's extra runs, byes, leg byes) and clear after each ball.

export type Extra = 'none' | 'wide' | 'noBall';
export type RunsFrom = 'bat' | 'byes' | 'legByes';

type Props = {
  rules: CricketRules;
  extra: Extra;
  runsFrom: RunsFrom;
  onExtra: (e: Extra) => void;
  onRunsFrom: (r: RunsFrom) => void;
  onRuns: (runs: number) => void;
  onWicket: () => void;
  onUndo: () => void;
  canUndo: boolean;
  busy: boolean;
};

export default function RunPad({ rules, extra, runsFrom, onExtra, onRunsFrom, onRuns, onWicket, onUndo, canUndo, busy }: Props) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  // A switched-on modifier: a pale tint inside the sport's edge (glass: the soft accent fill and
  // ring; light: outlined pills).
  const modOn = light
    ? { backgroundColor: theme.tint, borderColor: theme.accent, color: theme.deep }
    : { backgroundColor: theme.accentSoft, borderColor: theme.accent, color: theme.onDark };

  const mods: { key: string; label: string; on: boolean; toggle: () => void; show: boolean }[] = [
    { key: 'wd', label: 'Wide', on: extra === 'wide', toggle: () => onExtra(extra === 'wide' ? 'none' : 'wide'), show: true },
    { key: 'nb', label: 'No ball', on: extra === 'noBall', toggle: () => onExtra(extra === 'noBall' ? 'none' : 'noBall'), show: true },
    { key: 'b', label: 'Byes', on: runsFrom === 'byes', toggle: () => onRunsFrom(runsFrom === 'byes' ? 'bat' : 'byes'), show: rules.byesAllowed && extra !== 'wide' },
    { key: 'lb', label: 'Leg byes', on: runsFrom === 'legByes', toggle: () => onRunsFrom(runsFrom === 'legByes' ? 'bat' : 'legByes'), show: rules.legByesAllowed && extra !== 'wide' },
  ];

  const digit = (n: number) => <Digit key={n} n={n} extra={extra} runsFrom={runsFrom} busy={busy} onRuns={onRuns} />;

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.row}>
        {mods
          .filter((m) => m.show)
          .map((m) => (
            <PressableScale
              key={m.key}
              onPress={() => {
                haptic.select();
                m.toggle();
              }}
              accessibilityRole="switch"
              accessibilityState={{ checked: m.on }}
              accessibilityLabel={m.label}
              style={[
                styles.mod,
                light && styles.lightMod,
                {
                  backgroundColor: m.on ? modOn.backgroundColor : light ? 'transparent' : 'rgba(255,255,255,0.07)',
                  borderColor: m.on ? modOn.borderColor : light ? theme.fieldBorder : 'transparent',
                },
              ]}
            >
              <Text style={[styles.modText, m.on ? styles.lightModTextOn : styles.lightModText, { color: m.on ? modOn.color : theme.onDark }]} numberOfLines={1}>
                {m.label}
              </Text>
            </PressableScale>
          ))}
      </View>
      <View style={styles.row}>{[0, 1, 2, 3].map(digit)}</View>
      <View style={styles.row}>
        {[4, 6, 5].map(digit)}
        <PressableScale
          onPress={onUndo}
          disabled={!canUndo || busy}
          accessibilityLabel="Undo last ball"
          style={[
            styles.digit,
            { backgroundColor: 'transparent', borderColor: light ? theme.placeholderInk : theme.glassBorder, borderWidth: 1 },
            light && [styles.lightDigit, { borderStyle: 'dashed' }],
          ]}
        >
          <Icon name="undo" size={22} color={theme.ink} />
          <Text style={[styles.lightCaption, { color: theme.muted }]}>Undo</Text>
        </PressableScale>
      </View>
      <Button label="Out / Wicket" icon="alert-octagon" variant="danger" size="lg" display onPress={onWicket} disabled={busy} />
    </View>
  );
}

/** What a number means with the current modifiers: "Dot", "Four", "Wide +2", "No ball + leg byes". */
function plainCaptionFor(n: number, extra: Extra, runsFrom: RunsFrom) {
  if (extra === 'wide') return n === 0 ? 'Wide' : `Wide +${n}`;
  const tag = runsFrom === 'byes' ? 'byes' : runsFrom === 'legByes' ? 'leg byes' : null;
  const nb = extra === 'noBall' ? 'no ball' : null;
  const joined = [nb, tag].filter(Boolean).join(' + ');
  if (joined) return joined.charAt(0).toUpperCase() + joined.slice(1);
  return n === 0 ? 'Dot' : n === 4 ? 'Four' : n === 6 ? 'Six' : '';
}

function Digit({ n, extra, runsFrom, busy, onRuns }: { n: number; extra: Extra; runsFrom: RunsFrom; busy: boolean; onRuns: (n: number) => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const boundary = (n === 4 || n === 6) && extra === 'none' && runsFrom === 'bat';
  const light = theme.mode === 'light';
  const caption = plainCaptionFor(n, extra, runsFrom);

  // Light ("B · Sight-screen"): white keys with a hairline and a thin figure. The boundaries differ
  // only subtly — the four in a pale accent ring, the six the same ring with a faint fill.
  if (light) {
    return (
      <PressableScale
        onPress={() => {
          haptic.tap();
          onRuns(n);
        }}
        disabled={busy}
        accessibilityLabel={`${n} ${caption || 'runs'}`}
        style={[
          styles.digit,
          styles.lightDigit,
          boundary
            ? { borderColor: theme.ring, borderWidth: 1.5, backgroundColor: n === 6 ? theme.ringFill : 'transparent' }
            : { borderColor: theme.fieldBorder, backgroundColor: 'transparent' },
        ]}
      >
        <Text style={[styles.digitText, styles.lightDigitText, boundary && styles.lightBoundaryText, { color: boundary ? theme.deep : theme.ink }]}>
          {n}
        </Text>
        {caption ? <Text style={[styles.lightCaption, { color: boundary ? theme.deep : theme.muted }]}>{caption}</Text> : null}
      </PressableScale>
    );
  }

  // Glass ("N · Live scoring"): plain keys in the glass pad (no glass on glass). The four is ringed
  // in the sport's colour, the six a lit pane of it — subtly apart, as asked. Each key lights up
  // under the finger.
  const six = boundary && n === 6;
  const ink = six ? theme.accentInk : boundary ? theme.accent : theme.onDark;
  return (
    <PressableScale
      onPress={() => {
        haptic.tap();
        onRuns(n);
      }}
      disabled={busy}
      glow
      glowRadius={22}
      accessibilityLabel={`${n} ${caption || 'runs'}`}
      style={[
        styles.digit,
        styles.key,
        six
          ? [{ backgroundColor: theme.accent, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }, gradient(theme.accentGradient)]
          : boundary
            ? { backgroundColor: 'transparent', boxShadow: `inset 0 0 0 2px ${theme.accent}` }
            : { backgroundColor: 'rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)' },
      ]}
    >
      <Text style={[styles.keyText, { color: ink }]}>{n}</Text>
      {/* Only when a modifier changes what the number means ("Wide +2", "Leg byes"). */}
      {caption && (extra !== 'none' || runsFrom !== 'bat') ? <Text style={[styles.keyCaption, { color: theme.onDarkSoft }]}>{caption}</Text> : null}
    </PressableScale>
  );
}

const gradient = (image: string) =>
  Platform.OS === 'web' ? ({ backgroundImage: image } as object) : { experimental_backgroundImage: image };

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  mod: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  modText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  digit: { flex: 1, minHeight: 60, borderRadius: radius.xl, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  digitText: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  key: { minHeight: 64, borderRadius: 22, borderCurve: 'continuous', borderWidth: 0, gap: 1 },
  keyText: { fontFamily: fonts.bodySemiBold, fontSize: 26, lineHeight: 30, fontVariant: ['tabular-nums'] },
  keyCaption: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 13 },
  lightMod: { borderRadius: radius.pill, borderWidth: 1 },
  lightModText: { fontFamily: fonts.body, fontSize: 14, letterSpacing: 0 },
  lightModTextOn: { fontFamily: fonts.bodySemiBold, fontSize: 14, letterSpacing: 0 },
  lightDigit: { minHeight: 66, borderRadius: 20, borderWidth: 1, gap: 2 },
  lightDigitText: { fontSize: 30, lineHeight: 34 },
  /** A boundary's figure a weight up from the thin digits, as in the design. */
  lightBoundaryText: { fontFamily: fonts.body },
  lightCaption: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14 },
});
