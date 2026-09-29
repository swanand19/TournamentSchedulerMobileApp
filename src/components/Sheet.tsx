import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type } from '@/theme/theme';

// The bottom sheet for every in-match picker: goal scorer, card, sub, wicket, next bowler. It lives
// inside the screen (not as its own route) because it needs the live match state it was opened
// from and hands a choice straight back.
//
// Motion, per the animate-expo rules:
//  - Opening: a critically damped spring (no bounce — no finger threw it). Closing: 220ms ease-out.
//  - Dragging the grabber down follows the finger on the UI thread; upward past the top resists
//    (rubber band). Release decides by projected momentum, so a flick dismisses even a short drag,
//    and the release velocity is handed to the spring so there's no seam.
//  - The backdrop's opacity is derived from the same value, so it can never drift out of sync.
//  - Reduce Motion: no travel, just appear and disappear.
// A blocking sheet (`dismissible={false}`) has no grabber, ignores the backdrop and back button —
// used when the match cannot continue without an answer (next batter, next bowler).

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// A plain function reference for the worklet to hand back to the RN runtime (it snapped home).
const snapHaptic = () => haptic.tap();

/** Where a flick would come to rest if it kept decelerating (Apple's decay form). */
function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The further past the edge, the less the sheet follows. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Pinned under the scroll area: Cancel / Save. */
  footer?: ReactNode;
  dismissible?: boolean;
  /** Dark deck fill (scoring pickers) instead of cream (forms). */
  dark?: boolean;
};

export default function Sheet({ visible, onClose, title, subtitle, children, footer, dismissible = true, dark }: Props) {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const reduced = useReducedMotion();

  // Stays mounted through the closing animation, then unmounts. Derived during render (not in an
  // effect) so opening is never a frame late.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  // With Reduce Motion there's no closing animation to wait for.
  if (!visible && mounted && reduced) setMounted(false);

  const offscreen = screenHeight;
  const y = useSharedValue(offscreen);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      y.set(reduced ? 0 : withSpring(0, { duration: 300, dampingRatio: 1 }));
    } else if (!reduced) {
      y.set(
        withTiming(offscreen, { duration: 220, easing: EASE_OUT }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [visible, mounted, reduced, offscreen, y]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(dismissible)
        .activeOffsetY([-10, 10])
        .onStart(() => {
          dragStart.set(y.get()); // grab mid-animation and it continues from where the eye saw it
        })
        .onUpdate((e) => {
          const next = dragStart.get() + e.translationY;
          y.set(next >= 0 ? next : rubberband(next, 400));
        })
        .onEnd((e) => {
          const projected = y.get() + project(e.velocityY);
          if (projected > 160) {
            y.set(
              withSpring(offscreen, { duration: 300, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true }),
            );
            scheduleOnRN(onClose);
          } else {
            y.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }));
            scheduleOnRN(snapHaptic);
          }
        }),
    [dismissible, dragStart, y, offscreen, onClose],
  );

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.get(), [0, 400], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  const bg = dark ? theme.deck : theme.cream;
  const fg = dark ? theme.onDark : theme.ink;
  const soft = dark ? theme.onDarkSoft : theme.muted;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismissible ? onClose : () => {}}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismissible ? onClose : undefined}
            accessibilityRole="button"
            accessibilityLabel="Close"
            importantForAccessibility={dismissible ? 'yes' : 'no'}
          />
        </Animated.View>

        <KeyboardAvoidingView
          style={styles.anchor}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { backgroundColor: bg, borderTopColor: theme.accent, maxHeight: screenHeight * 0.9 },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.header}>
                {dismissible && <View style={[styles.grabber, { backgroundColor: soft }]} />}
                <Text accessibilityRole="header" style={[type.headline, { color: fg }]}>
                  {title}
                </Text>
                {subtitle ? <Text style={[type.body, { color: soft }]}>{subtitle}</Text> : null}
              </View>
            </GestureDetector>

            <ScrollView
              // Shrinks inside the sheet's max height so the footer is always on screen.
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer ? (
              <View
                style={[
                  styles.footer,
                  { paddingBottom: insets.bottom + space.md, borderTopColor: dark ? theme.borderOnDark : theme.cardDivider },
                ]}
              >
                {footer}
              </View>
            ) : (
              <View style={{ height: insets.bottom + space.md }} />
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    borderTopWidth: 2,
    overflow: 'hidden',
  },
  header: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: 2 },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, opacity: 0.5, marginBottom: space.sm },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.md },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1 },
});
