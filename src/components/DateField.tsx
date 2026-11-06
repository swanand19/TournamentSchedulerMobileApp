import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useId, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// A labelled date for cream cards: the platform's own picker (Android's calendar dialog, iOS's
// inline calendar), and a plain YYYY-MM-DD field in the web preview. The value is always a
// "YYYY-MM-DD" string — what the API takes — so no time zone ever shifts the day.

type Props = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

function toDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : new Date();
}

function toValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Sat 12 Oct 2026" — how the field reads. */
export function formatDay(value: string): string {
  return toDate(value).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Today, as a field value. */
export function todayValue(addDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  return toValue(d);
}

export default function DateField({ label, value, onChange, disabled }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const id = useId();
  const [iosOpen, setIosOpen] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: space.xs }}>
        <Text nativeID={id} style={[type.label, { color: theme.muted }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          editable={!disabled}
          accessibilityLabelledBy={id}
          style={[styles.field, { backgroundColor: theme.field, borderColor: theme.fieldBorder, color: theme.ink }, theme.mode === 'light' && styles.underline]}
        />
      </View>
    );
  }

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'date',
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === 'set' && date) onChange(toValue(date));
        },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <View style={{ gap: space.xs }}>
      <Text style={[type.label, { color: theme.muted }]}>{label}</Text>
      <PressableScale
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDay(value)}. Change`}
        style={[styles.field, styles.row, { backgroundColor: theme.field, borderColor: theme.fieldBorder }, theme.mode === 'light' && styles.underline]}
      >
        {/* One line, shrunk a little if it must: in dark's padded half-width boxes a wrapped date pushed the icon out. */}
        <Text style={[styles.text, { color: theme.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {formatDay(value)}
        </Text>
        <Icon name="calendar-month-outline" size={20} color={theme.muted} />
      </PressableScale>
      {Platform.OS === 'ios' && iosOpen && (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display="inline"
          onChange={(_event, date) => {
            if (date) onChange(toValue(date));
          }}
        />
      )}
    </View>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  field: { minHeight: 52, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  text: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 16 },
  /** Light: just the line to write on, like TextField. */
  underline: { minHeight: 48, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, paddingHorizontal: 0, backgroundColor: 'transparent' },
});
