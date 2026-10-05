import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Haptics, named for what happened rather than how it feels, so every screen agrees on which
// moment gets which buzz. One per user action, fired with the visual — never the only feedback,
// since plenty of phones have haptics off. Failures are swallowed: a missing buzz is not an error.

function safe(p: Promise<unknown>) {
  p.catch(() => {});
}

export const haptic = {
  /** A value ticked over: stepper, segmented control, chip. */
  select() {
    safe(Haptics.selectionAsync());
  },
  /** A routine scoring tap landed: a ball, a card, a sub. */
  tap() {
    safe(
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
  },
  /** A scroll came to rest on a detent: the stats leaderboard settling under the tab bar. */
  detent() {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  /** Something big landed: a goal, a wicket, the end of a period. */
  success() {
    safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  /** A heavy or destructive action fired. */
  heavy() {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  /** The server refused. */
  error() {
    safe(
      Platform.OS === 'android'
        ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    );
  },
};
