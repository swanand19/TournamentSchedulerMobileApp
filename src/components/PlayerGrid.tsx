import { StyleSheet, Text, View } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// A two-column grid of big player tiles for the scoring pickers — scorer, booked player, who's
// coming on, next batter. Shirt number first in the display face, because that's what a scorer
// reads off the pitch. One tile is selected at a time; a check and a fill mark it.

export type GridPlayer = {
  id: number | null;
  number?: number | null;
  name: string;
  /** Second line: position, figures, "Booked". */
  sub?: string;
  /** Small marker in the corner (a yellow card, a captain's C). */
  badge?: { icon: IconName; color: string; label: string };
  disabled?: boolean;
};

type Props = {
  players: GridPlayer[];
  selected: number | null | undefined;
  onSelect: (id: number | null) => void;
  /** On the dark deck (scoring sheets) or on cream. */
  dark?: boolean;
  label: string;
};

export default function PlayerGrid({ players, selected, onSelect, dark, label }: Props) {
  const theme = useSportTheme();
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {players.map((p) => {
        const on = selected !== undefined && selected === p.id;
        const bg = on ? theme.accent : dark ? theme.deckRaised : theme.chip;
        const fg = on ? theme.accentInk : dark ? theme.onDark : theme.ink;
        const soft = on ? theme.accentInk : dark ? theme.onDarkSoft : theme.muted;
        return (
          <PressableScale
            key={p.id ?? 'none'}
            onPress={() => {
              haptic.select();
              onSelect(p.id);
            }}
            disabled={p.disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!p.disabled }}
            accessibilityLabel={`${p.number != null ? `Number ${p.number}, ` : ''}${p.name}${p.sub ? `, ${p.sub}` : ''}${p.badge ? `, ${p.badge.label}` : ''}`}
            style={[styles.tile, { backgroundColor: bg, borderColor: on ? theme.accent : dark ? theme.borderOnDark : theme.cardDivider }]}
          >
            <View style={styles.top}>
              {p.number != null && <Text style={[styles.num, { color: fg }]}>#{p.number}</Text>}
              <View style={{ flex: 1 }} />
              {p.badge && <Icon name={p.badge.icon} size={18} color={on ? theme.accentInk : p.badge.color} />}
              {on && <Icon name="check-circle" size={20} color={theme.accentInk} />}
            </View>
            <Text style={[styles.name, { color: fg }]} numberOfLines={2}>
              {p.name}
            </Text>
            {p.sub ? (
              <Text style={[type.caption, { color: soft }]} numberOfLines={1}>
                {p.sub}
              </Text>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '48%', flexGrow: 1, minHeight: 72, borderRadius: radius.lg, borderWidth: 1.5, padding: space.md, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  num: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 19 },
});
