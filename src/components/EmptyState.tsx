import { StyleSheet, Text, View } from 'react-native';

import Button from '@/components/Button';
import Icon, { type IconName } from '@/components/Icon';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// What an empty list says: what goes here, and the one action that fills it.

type Props = { icon: IconName; title: string; message: string; actionLabel?: string; onAction?: () => void };

export default function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  const theme = useSportTheme();
  return (
    <View style={[styles.box, { borderColor: theme.borderOnDark }]}>
      <Icon name={icon} size={36} color={theme.accent} />
      <Text style={[type.headline, { color: theme.onDark, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.body, { color: theme.onDarkSoft, textAlign: 'center' }]}>{message}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
});
