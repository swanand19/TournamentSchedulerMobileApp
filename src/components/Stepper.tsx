import { StyleSheet, Text, View } from 'react-native';

import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// − value + for small whole numbers (players per side, minutes, overs). Big targets instead of a
// keyboard: nobody wants the number pad over the form with gloves on. A selection tick per step.

type Props = {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown instead of the number, e.g. "No limit". */
  display?: string;
  onDark?: boolean;
};

export default function Stepper({ label, hint, value, onChange, min = 0, max = 999, step = 1, display, onDark }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const fg = onDark ? theme.onDark : theme.ink;
  const soft = onDark ? theme.onDarkSoft : theme.muted;
  const light = theme.mode === 'light';
  const btnBg = light ? 'transparent' : theme.chip;
  // Light: outlined round buttons around a thin figure. Glass: round plain fills with a bright rim.
  const btnShape = light
    ? { borderRadius: 24, borderWidth: 1, borderColor: theme.fieldBorder }
    : { borderRadius: 24, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.16)' };

  const change = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped === value) return;
    haptic.select();
    onChange(clamped);
  };

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: display ?? String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => change(e.nativeEvent.actionName === 'increment' ? value + step : value - step)}
    >
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: fg }]}>{label}</Text>
        {hint ? <Text style={[type.caption, { color: soft }]}>{hint}</Text> : null}
      </View>
      <View style={styles.controls}>
        <PressableScale
          onPress={() => change(value - step)}
          disabled={value <= min}
          style={[styles.btn, { backgroundColor: btnBg }, btnShape]}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Icon name="minus" size={22} color={fg} />
        </PressableScale>
        <Text style={[styles.value, { color: fg }]}>{display ?? value}</Text>
        <PressableScale
          onPress={() => change(value + step)}
          disabled={value >= max}
          style={[styles.btn, { backgroundColor: btnBg }, btnShape]}
          accessibilityLabel={`Increase ${label}`}
        >
          <Icon name="plus" size={22} color={fg} />
        </PressableScale>
      </View>
    </View>
  );
}

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  btn: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.display, fontSize: 22, minWidth: 44, textAlign: 'center', fontVariant: figures },
});
