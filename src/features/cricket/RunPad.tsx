import { StyleSheet, Text, View } from 'react-native';

import type { CricketRules } from '@/api/types';
import Button from '@/components/Button';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space } from '@/theme/theme';

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
  const theme = useSportTheme();

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
              style={[styles.mod, { backgroundColor: m.on ? theme.cream : 'transparent', borderColor: m.on ? theme.cream : theme.borderOnDark }]}
            >
              <Text style={[styles.modText, { color: m.on ? theme.ink : theme.onDark }]} numberOfLines={1}>
                {m.label.toUpperCase()}
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
          style={[styles.digit, { backgroundColor: 'transparent', borderColor: theme.borderOnDark }]}
        >
          <Text style={[styles.undo, { color: theme.onDark }]}>UNDO</Text>
          <Text style={[styles.digitCaption, { color: theme.onDarkSoft }]}>LAST BALL</Text>
        </PressableScale>
      </View>
      <Button label="Out / Wicket" icon="alert-octagon" variant="danger" size="lg" display onPress={onWicket} disabled={busy} />
    </View>
  );
}

/** What a number means with the current modifiers: "DOT", "FOUR", "WD +2", "NB + LB". */
function captionFor(n: number, extra: Extra, runsFrom: RunsFrom) {
  if (extra === 'wide') return n === 0 ? 'WIDE' : `WD +${n}`;
  const tag = runsFrom === 'byes' ? 'B' : runsFrom === 'legByes' ? 'LB' : null;
  const nb = extra === 'noBall' ? 'NB' : null;
  return [nb, tag].filter(Boolean).join(' + ') || (n === 0 ? 'DOT' : n === 4 ? 'FOUR' : n === 6 ? 'SIX' : '');
}

function Digit({ n, extra, runsFrom, busy, onRuns }: { n: number; extra: Extra; runsFrom: RunsFrom; busy: boolean; onRuns: (n: number) => void }) {
  const theme = useSportTheme();
  const boundary = (n === 4 || n === 6) && extra === 'none' && runsFrom === 'bat';
  const caption = captionFor(n, extra, runsFrom);
  return (
    <PressableScale
      onPress={() => {
        haptic.tap();
        onRuns(n);
      }}
      disabled={busy}
      accessibilityLabel={`${n} ${caption || 'runs'}`}
      style={[styles.digit, { backgroundColor: boundary ? theme.accent : theme.deckRaised, borderColor: boundary ? theme.accent : theme.borderOnDark }]}
    >
      <Text style={[styles.digitText, { color: boundary ? theme.accentInk : theme.onDark }]}>{n}</Text>
      {caption ? <Text style={[styles.digitCaption, { color: boundary ? theme.accentInk : theme.onDarkSoft }]}>{caption}</Text> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  mod: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  modText: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.4 },
  digit: { flex: 1, minHeight: 60, borderRadius: radius.xl, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  digitText: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  digitCaption: { fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.6 },
  undo: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
});
