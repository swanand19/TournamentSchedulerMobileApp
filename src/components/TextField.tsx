import { useId } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// A labelled input for cream cards and sheets. 16px text so nothing zooms, a real label tied to
// the field for TalkBack, and the error sits under the field it belongs to.

type Props = Omit<TextInputProps, 'style'> & { label: string; error?: string; hint?: string };

export default function TextField({ label, error, hint, ...input }: Props) {
  const theme = useSportTheme();
  const id = useId();
  return (
    <View style={{ gap: space.xs }}>
      <Text nativeID={id} style={[type.label, { color: theme.muted }]}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={theme.placeholderInk}
        accessibilityLabelledBy={id}
        {...input}
        style={[
          styles.input,
          { backgroundColor: theme.field, borderColor: error ? theme.warnInk : theme.fieldBorder, color: theme.ink },
        ]}
      />
      {error ? <Text style={[type.caption, { color: theme.warnInk }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[type.caption, { color: theme.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
});
