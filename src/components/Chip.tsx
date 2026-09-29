import { StyleSheet, Text, View } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space } from '@/theme/theme';

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
  const theme = useSportTheme();
  const selBg = tone === 'danger' ? theme.dangerSolid : tone === 'success' ? theme.successSolid : theme.accent;
  const selFg = tone === 'accent' ? theme.accentInk : '#FFFFFF';
  const bg = selected ? selBg : onCard ? theme.chip : theme.surfaceOnDark;
  const fg = selected ? selFg : onCard ? theme.ink : theme.onDark;
  const border = selected ? selBg : onCard ? theme.cardDivider : theme.borderOnDark;

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
        <Text style={[styles.label, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        {count !== undefined && <Text style={[styles.count, { color: fg }]}>{count}</Text>}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: radius.pill, borderWidth: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
  count: { fontFamily: fonts.bodyBold, fontSize: 13, opacity: 0.75 },
});
