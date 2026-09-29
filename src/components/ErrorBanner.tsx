import { StyleSheet, Text, View } from 'react-native';

import PressableScale from '@/components/PressableScale';
import { fonts, radius, space, type } from '@/theme/theme';

// The one error banner every screen uses. Announced to TalkBack as it appears, and when there is
// a way to recover (usually "Change server"), that action sits right in the banner.

type Props = {
  message: string | null | undefined;
  actionLabel?: string;
  onAction?: () => void;
};

export default function ErrorBanner({ message, actionLabel, onAction }: Props) {
  if (!message) return null;

  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
      {actionLabel && onAction && (
        <PressableScale onPress={onAction} style={styles.action} accessibilityLabel={actionLabel}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(226,75,74,0.15)',
    borderColor: '#e24b4a',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
    marginBottom: space.lg,
  },
  text: { ...type.body, color: '#F7F5EF' },
  action: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(247,245,239,0.4)',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  actionText: { fontFamily: fonts.bodySemiBold, fontSize: 14, color: '#F7F5EF' },
});
