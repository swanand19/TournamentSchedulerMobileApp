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
// On a no-ball a second row asks where the runs came from (bat, byes or leg byes), because
// only the bat's runs are the batter's; every key then says what it records ("nb + 2lb"). 7+ opens
// the More runs sheet (overthrows). Which extras appear follows the match's rules.

export type Extra = 'none' | 'wide' | 'noBall';
export type RunsFrom = 'bat' | 'byes' | 'legByes';

type Props = {
  rules: CricketRules;
  extra: Extra;
  runsFrom: RunsFrom;
  onExtra: (e: Extra) => void;
  onRunsFrom: (r: RunsFrom) => void;
  onRuns: (runs: number) => void;
  /** 7+: more runs than the keys hold (overthrows), picked in a sheet. */
  onMore: () => void;
  onWicket: () => void;
  onUndo: () => void;
  canUndo: boolean;
  busy: boolean;
};

export default function RunPad({ rules, extra, runsFrom, onExtra, onRunsFrom, onRuns, onMore, onWicket, onUndo, canUndo, busy }: Props) {
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
    // On a wide every run is a wide; on a no-ball the second row asks instead.
    { key: 'b', label: 'Byes', on: runsFrom === 'byes', toggle: () => onRunsFrom(runsFrom === 'byes' ? 'bat' : 'byes'), show: rules.byesAllowed && extra === 'none' },
    { key: 'lb', label: 'Leg byes', on: runsFrom === 'legByes', toggle: () => onRunsFrom(runsFrom === 'legByes' ? 'bat' : 'legByes'), show: rules.legByesAllowed && extra === 'none' },
  ];
  const sources = runSources(rules);
  const askFrom = extra === 'noBall' && sources.length > 1;

  const ctx: KeyContext = { extra, runsFrom, widePenalty: rules.widePenaltyRuns };
  const digit = (n: number) => <Digit key={n} n={n} ctx={ctx} busy={busy} onRuns={onRuns} />;
  const pill = (key: string, label: string, on: boolean, onPress: () => void, role: 'switch' | 'radio') => (
    <PressableScale
      key={key}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      style={[
        styles.mod,
        light && styles.lightMod,
        {
          backgroundColor: on ? modOn.backgroundColor : light ? 'transparent' : 'rgba(255,255,255,0.07)',
          borderColor: on ? modOn.borderColor : light ? theme.fieldBorder : 'transparent',
        },
      ]}
    >
      <Text style={[styles.modText, on ? styles.lightModTextOn : styles.lightModText, { color: on ? modOn.color : theme.onDark }]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.row}>{mods.filter((m) => m.show).map((m) => pill(m.key, m.label, m.on, m.toggle, 'switch'))}</View>
      {askFrom && (
        <View style={styles.fromRow} accessibilityRole="radiogroup" accessibilityLabel="The runs came from">
          <Text style={[styles.fromLabel, { color: light ? theme.muted : theme.onDarkSoft }]}>The runs came from</Text>
          <View style={[styles.row, { flex: 1 }]}>
            {sources.map((f) => pill(f, FROM_LABEL[f], runsFrom === f, () => onRunsFrom(f), 'radio'))}
          </View>
        </View>
      )}
      <View style={styles.row}>{[0, 1, 2, 3].map(digit)}</View>
      <View style={styles.row}>
        {[4, 6, 5].map(digit)}
        <MoreKey ctx={ctx} busy={busy} onPress={onMore} />
      </View>
      <View style={styles.row}>
        <PressableScale
          onPress={onUndo}
          disabled={!canUndo || busy}
          accessibilityLabel="Undo last ball"
          style={[
            styles.digit,
            styles.undo,
            { backgroundColor: 'transparent', borderColor: light ? theme.placeholderInk : theme.glassBorder, borderWidth: 1, opacity: canUndo ? 1 : 0.5 },
            light && [styles.lightDigit, styles.undo, { borderStyle: 'dashed' }],
          ]}
        >
          <Icon name="undo" size={20} color={theme.ink} />
          <Text style={[styles.lightCaption, { color: theme.muted }]}>Undo</Text>
        </PressableScale>
        <Button label="Out / Wicket" icon="alert-octagon" variant="danger" size="lg" display onPress={onWicket} disabled={busy} style={{ flex: 3 }} />
      </View>
    </View>
  );
}

// Read after "The runs came from" (the user's wording, 2026-11-26).
export const FROM_LABEL: Record<RunsFrom, string> = { bat: 'Bat', byes: 'Byes', legByes: 'Leg byes' };

/** Where runs may come from in this match: the bat always, byes and leg byes if the rules allow them. */
export function runSources(rules: CricketRules): RunsFrom[] {
  return (['bat', 'byes', 'legByes'] as RunsFrom[]).filter((f) => f === 'bat' || (f === 'byes' ? rules.byesAllowed : rules.legByesAllowed));
}

type KeyContext = { extra: Extra; runsFrom: RunsFrom; widePenalty: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What a number records with the current modifiers: "Dot", "Four", "3 wides", "nb + 2lb", "nb + four". */
function captionFor(n: number, { extra, runsFrom, widePenalty }: KeyContext) {
  if (extra === 'wide') return n === 6 ? 'Can’t be hit' : plural(widePenalty + n, 'wide', 'wides');
  if (extra === 'noBall') {
    if (n === 0) return 'nb only';
    if (runsFrom === 'byes') return `nb + ${n}b`;
    if (runsFrom === 'legByes') return `nb + ${n}lb`;
    if (n === 4) return 'nb + four';
    if (n === 6) return 'nb + six';
    return `nb + ${n}`;
  }
  if (runsFrom === 'byes') return n === 0 ? 'Dot' : plural(n, 'bye', 'byes');
  if (runsFrom === 'legByes') return n === 0 ? 'Dot' : plural(n, 'leg bye', 'leg byes');
  return n === 0 ? 'Dot' : n === 4 ? 'Four' : n === 6 ? 'Six' : '';
}

/** 7+ — the key for overthrows and long runs; the sheet it opens asks how many. */
function MoreKey({ ctx, busy, onPress }: { ctx: KeyContext; busy: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  const caption = ctx.extra === 'wide' ? 'More wides' : ctx.extra === 'noBall' ? 'More' : 'More runs';
  return (
    <PressableScale
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={busy}
      glow={!light}
      glowRadius={22}
      accessibilityLabel="More than 6 runs"
      style={[
        styles.digit,
        light
          ? [styles.lightDigit, { borderColor: theme.fieldBorder, backgroundColor: 'transparent' }]
          : [styles.key, { backgroundColor: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' }],
      ]}
    >
      <Text style={light ? [styles.digitText, styles.lightDigitText, styles.lightMoreText, { color: theme.ink }] : [styles.keyText, styles.moreText, { color: theme.onDark }]}>7+</Text>
      <Text style={[light ? styles.lightCaption : styles.keyCaption, { color: light ? theme.muted : theme.onDarkSoft }]} numberOfLines={1}>
        {caption}
      </Text>
    </PressableScale>
  );
}

function Digit({ n, ctx, busy, onRuns }: { n: number; ctx: KeyContext; busy: boolean; onRuns: (n: number) => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const { extra, runsFrom } = ctx;
  // A no-ball hit for four is still a four; byes to the rope and wides aren't boundaries.
  const boundary = (n === 4 || n === 6) && extra !== 'wide' && runsFrom === 'bat';
  // A wide can't be hit, so it never goes for six.
  const impossible = extra === 'wide' && n === 6;
  const off = busy || impossible;
  const light = theme.mode === 'light';
  const caption = captionFor(n, ctx);

  // Light ("B · Sight-screen"): white keys with a hairline and a thin figure. The boundaries differ
  // only subtly — the four in a pale accent ring, the six the same ring with a faint fill.
  if (light) {
    return (
      <PressableScale
        onPress={() => {
          haptic.tap();
          onRuns(n);
        }}
        disabled={off}
        accessibilityLabel={`${n} ${caption || 'runs'}`}
        style={[
          styles.digit,
          styles.lightDigit,
          impossible && styles.impossible,
          boundary
            ? { borderColor: theme.ring, borderWidth: 1.5, backgroundColor: n === 6 ? theme.ringFill : 'transparent' }
            : { borderColor: theme.fieldBorder, backgroundColor: 'transparent' },
        ]}
      >
        <Text style={[styles.digitText, styles.lightDigitText, boundary && styles.lightBoundaryText, { color: boundary ? theme.deep : theme.ink }]}>
          {n}
        </Text>
        {caption ? (
          <Text style={[styles.lightCaption, { color: boundary ? theme.deep : theme.muted }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {caption}
          </Text>
        ) : null}
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
      disabled={off}
      glow
      glowRadius={22}
      accessibilityLabel={`${n} ${caption || 'runs'}`}
      style={[
        styles.digit,
        styles.key,
        impossible && styles.impossible,
        six
          ? [{ backgroundColor: theme.accent, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }, gradient(theme.accentGradient)]
          : boundary
            ? { backgroundColor: 'transparent', boxShadow: `inset 0 0 0 2px ${theme.accent}` }
            : { backgroundColor: 'rgba(255,255,255,0.09)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)' },
      ]}
    >
      <Text style={[styles.keyText, { color: ink }]}>{n}</Text>
      {/* Only when a modifier changes what the number means ("Wide +2", "Leg byes"). */}
      {caption && (extra !== 'none' || runsFrom !== 'bat') ? (
        <Text style={[styles.keyCaption, { color: six ? theme.accentInk : theme.onDarkSoft }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {caption}
        </Text>
      ) : null}
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
  keyCaption: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 13, paddingHorizontal: 4 },
  lightMod: { borderRadius: radius.pill, borderWidth: 1 },
  lightModText: { fontFamily: fonts.body, fontSize: 14, letterSpacing: 0 },
  lightModTextOn: { fontFamily: fonts.bodySemiBold, fontSize: 14, letterSpacing: 0 },
  lightDigit: { minHeight: 66, borderRadius: 20, borderWidth: 1, gap: 2 },
  lightDigitText: { fontSize: 30, lineHeight: 34 },
  /** A boundary's figure a weight up from the thin digits, as in the design. */
  lightBoundaryText: { fontFamily: fonts.body },
  lightCaption: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, paddingHorizontal: 4 },
  lightMoreText: { fontSize: 26, lineHeight: 30 },
  moreText: { fontSize: 22, lineHeight: 26 },
  impossible: { opacity: 0.35 },
  undo: { flex: 1, minHeight: 56, gap: 0 },
  fromRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  fromLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, width: 64, lineHeight: 15 },
});
