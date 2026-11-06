import { StyleSheet, Text, View } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// A pickable pill: filters, options, a player in a picker. Selected is the accent fill with a
// check, so the state reads without colour. `onCard` is for use inside a cream card or sheet.

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  count?: number;
  onCard?: boolean;
  disabled?: boolean;
  /** A "danger" selected state, for dismissals and red cards. */
  tone?: 'accent' | 'danger' | 'success';
  accessibilityLabel?: string;
};

export default function Chip({ label, selected, onPress, icon, count, onCard, disabled, tone = 'accent', accessibilityLabel }: Props) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  // Glass: a plain fill (it sits in a panel or on a sheet, so never glass on glass); chosen, the
  // tone's soft fill inside its own ring, so the state reads without colour too (the check).
  const selBg = tone === 'danger' ? theme.dangerSolid : tone === 'success' ? theme.successSolid : theme.accentSoft;
  const selFg = '#FFFFFF';
  // Light: an outlined pill; chosen, a pale fill inside the tone's own edge.
  const lightSel =
    tone === 'danger'
      ? { bg: theme.dangerTint, fg: theme.dangerInk, border: theme.dangerSolid }
      : tone === 'success'
        ? { bg: theme.successTint, fg: theme.successInk, border: theme.successSolid }
        : { bg: theme.tint, fg: theme.deep, border: theme.accent };
  const bg = light ? (selected ? lightSel.bg : 'transparent') : selected ? selBg : theme.chip;
  const fg = light ? (selected ? lightSel.fg : theme.ink) : selected ? selFg : theme.onDark;
  const border = light
    ? selected
      ? lightSel.border
      : theme.fieldBorder
    : selected
      ? tone === 'accent'
        ? theme.accent
        : selBg
      : 'transparent';

  return (
    <PressableScale
      onPress={() => {
        haptic.select();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? (count !== undefined ? `${label}, ${count}` : label)}
      style={[styles.chip, { backgroundColor: bg, borderColor: border }]}
    >
      <View style={styles.row}>
        {selected ? <Icon name="check" size={16} color={fg} /> : icon ? <Icon name={icon} size={16} color={fg} /> : null}
        <Text style={[styles.label, light && !selected && styles.lightLabel, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        {count !== undefined && <Text style={[styles.count, { color: fg }]}>{count}</Text>}
      </View>
    </PressableScale>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  chip: { borderRadius: radius.pill, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  lightLabel: { fontFamily: fonts.body, fontSize: 15 },
  count: { fontFamily: fonts.bodyBold, fontSize: 13, opacity: 0.75 },
});
