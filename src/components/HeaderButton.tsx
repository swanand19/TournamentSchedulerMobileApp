import { Platform, StyleSheet } from 'react-native';

import Glass from '@/components/Glass';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useSportTheme } from '@/theme/SportTheme';
import { radius } from '@/theme/theme';

// An icon button in a screen's top bar. In the glass theme it's a round button of clear glass —
// except on iPhone, where the navigation bar already puts its buttons on Liquid Glass (iOS 26), so a
// glass circle of our own would be glass on glass. Light theme: a plain icon in ink.

export default function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useSportTheme();
  const drawn = theme.mode === 'dark' && Platform.OS !== 'ios';
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} feel={drawn ? 'glass' : 'press'} glowRadius={22} style={styles.button}>
      {drawn && <Glass pointerEvents="none" radius={22} interactive style={StyleSheet.absoluteFill} />}
      <Icon name={icon} size={22} color={theme.mode === 'light' ? theme.ink : theme.onDark} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
});
