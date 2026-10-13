import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { dismissalLabel } from '@/lib/cricketLabels';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// "How out" as a fixed three-column grid of equal tiles, so every row lines up whatever the label
// lengths. Only the engine's possibleDismissals are offered (a free hit leaves run out and a few
// rarities); this file only decides the order: the six that settle almost every wicket first, the
// rest behind "More ways out", which opens by itself when the common ones aren't possible or the
// chosen one is a rarity.

const COMMON = ['Bowled', 'Caught', 'LBW', 'RunOut', 'Stumped', 'CaughtAndBowled'];
const RARE = ['HitWicket', 'RetiredHurt', 'RetiredOut', 'ObstructingTheField', 'HitBallTwice', 'TimedOut'];
const COLUMNS = 3;

/** The allowed dismissals split into the two groups, each in the order above. */
export function orderDismissals(allowed: string[]) {
  const common = COMMON.filter((d) => allowed.includes(d));
  // Anything the server adds that this list doesn't know yet still shows, at the end.
  const rare = [...RARE.filter((d) => allowed.includes(d)), ...allowed.filter((d) => !COMMON.includes(d) && !RARE.includes(d))];
  return { common, rare };
}

export default function DismissalGrid({ allowed, value, onChange }: { allowed: string[]; value: string; onChange: (d: string) => void }) {
  const theme = useSportTheme();
  const { common, rare } = orderDismissals(allowed);
  const [moreOpen, setMoreOpen] = useState(false);
  const showRare = rare.length > 0 && (moreOpen || common.length === 0 || rare.includes(value));

  return (
    <View style={{ gap: space.sm }}>
      {common.length > 0 ? <Grid items={common} value={value} onChange={onChange} /> : null}
      {rare.length > 0 && common.length > 0 && !rare.includes(value) ? (
        <PressableScale
          onPress={() => setMoreOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showRare }}
          style={styles.more}
        >
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>{showRare ? 'Fewer ways out' : 'More ways out'}</Text>
          <Icon name={showRare ? 'chevron-up' : 'chevron-down'} size={16} color={theme.onDarkSoft} />
        </PressableScale>
      ) : null}
      {showRare ? <Grid items={rare} value={value} onChange={onChange} /> : null}
    </View>
  );
}

function Grid({ items, value, onChange }: { items: string[]; value: string; onChange: (d: string) => void }) {
  const rows: string[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) rows.push(items.slice(i, i + COLUMNS));
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((row) => (
        <View key={row.join()} style={styles.row}>
          {row.map((d) => (
            <Tile key={d} label={dismissalLabel(d)} selected={value === d} onPress={() => onChange(d)} />
          ))}
          {/* Empty cells keep a short last row's tiles the same width as the rows above. */}
          {Array.from({ length: COLUMNS - row.length }, (_, i) => (
            <View key={`gap-${i}`} style={styles.cell} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Tile({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useSportTheme();
  return (
    <PressableScale
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        styles.cell,
        styles.tile,
        selected
          ? { backgroundColor: theme.dangerSolid, borderColor: theme.dangerSolid }
          : { backgroundColor: theme.surfaceOnDark, borderColor: theme.borderOnDark },
      ]}
    >
      <Text style={[styles.label, { color: selected ? '#FFFFFF' : theme.onDark }]} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  cell: { flex: 1 },
  tile: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
  },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 18, textAlign: 'center' },
  more: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, minHeight: 32 },
});
