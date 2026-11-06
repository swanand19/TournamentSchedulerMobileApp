import { StyleSheet, Switch, Text, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// A labelled on/off rule. The platform switch, themed: it already animates correctly and speaks
// its state to TalkBack, so there is nothing to gain from drawing our own.

type Props = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  onDark?: boolean;
};

export default function SwitchRow({ label, hint, value, onChange, disabled, onDark }: Props) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: onDark ? theme.onDark : theme.ink }]}>{label}</Text>
        {hint ? <Text style={[type.caption, { color: onDark ? theme.onDarkSoft : theme.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          haptic.select();
          onChange(v);
        }}
        accessibilityLabel={label}
        // Glass: the standard switch, on in the sport's colour with a white knob, as iOS draws it.
        trackColor={
          light ? { false: theme.fieldBorder, true: theme.successSolid } : { false: 'rgba(120,120,140,0.32)', true: theme.accent }
        }
        thumbColor={light ? (value ? theme.accent : theme.cream) : '#FFFFFF'}
        ios_backgroundColor={light ? theme.fieldBorder : 'rgba(120,120,140,0.32)'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
});
