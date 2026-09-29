import { StyleSheet, Switch, Text, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

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
  const theme = useSportTheme();
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
        trackColor={{ false: onDark ? theme.deckRaised : theme.fieldBorder, true: theme.successSolid }}
        thumbColor={value ? theme.accent : theme.cream}
        ios_backgroundColor={onDark ? theme.deckRaised : theme.fieldBorder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
});
