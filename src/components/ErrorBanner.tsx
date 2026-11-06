import { StyleSheet, Text, View } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The one error banner every screen uses. Announced to TalkBack as it appears, and when there is
// a way to recover (usually "Change server"), that action sits right in the banner. Chalk text on
// the dark pitch; the screen's own ink on the light theme's white.

type Props = {
  message: string | null | undefined;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ErrorBanner({ message, actionLabel, onAction }: Props) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  if (!message) return null;

  const light = theme.mode === 'light';
  const text = light ? theme.ink : '#F7F5EF';

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: light ? 'rgba(226,75,74,0.08)' : 'rgba(226,75,74,0.15)' }]}
    >
      <Text style={[styles.text, { color: text }]}>{message}</Text>
      {actionLabel && onAction && (
        <PressableScale
          onPress={onAction}
          style={[styles.action, { borderColor: light ? theme.fieldBorder : 'rgba(247,245,239,0.4)' }]}
          accessibilityLabel={actionLabel}
        >
          <Text style={[styles.actionText, { color: text }]}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const makeStyles = ({ fonts, type }: Typography) => StyleSheet.create({
  banner: {
    borderColor: '#e24b4a',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    marginBottom: space.lg,
  },
  text: { ...type.body },
  action: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionText: { fontFamily: fonts.bodySemiBold, fontSize: 14 },
});
