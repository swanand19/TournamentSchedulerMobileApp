import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// The eyebrow-over-title pair that opens every section: a letter-spaced accent label for context,
// then the Anton heading. `onCard` flips the colours for use inside a cream card.

type Props = {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  onCard?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function SectionHeader({ eyebrow, title, right, onCard, large, style }: Props) {
  const theme = useSportTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text style={[type.eyebrow, { color: onCard ? theme.muted : theme.accent }]} numberOfLines={1}>
            {eyebrow}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          style={[large ? type.title : type.headline, { color: onCard ? theme.ink : theme.onDark }]}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
});
