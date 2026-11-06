import { useId } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// A labelled input for panels and sheets. 16px text so nothing zooms, a real label tied to
// the field for TalkBack, and the error sits under the field it belongs to.

type Props = Omit<TextInputProps, 'style'> & { label: string; error?: string; hint?: string };

export default function TextField({ label, error, hint, ...input }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
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
          // Light: just the line to write on.
          theme.mode === 'light' && styles.underline,
        ]}
      />
      {error ? <Text style={[type.caption, { color: theme.warnInk }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[type.caption, { color: theme.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  // Glass: a faint well in the panel, its corner concentric with the panel's.
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingHorizontal: space.md,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
  },
  underline: {
    minHeight: 48,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontSize: 17,
  },
});
