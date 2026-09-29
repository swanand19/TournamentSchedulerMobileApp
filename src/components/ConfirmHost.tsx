import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';

import Button from '@/components/Button';
import { registerConfirmHost, type ConfirmRequest } from '@/lib/confirm';
import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type } from '@/theme/theme';

// The dialog behind confirm(): a scoreboard deck on the dimmed pitch, the question, and two
// buttons — the confirm in amber, or red when something is lost. Tapping outside or the back
// button is a Cancel. It settles in with a short fade and scale from 96% (never from zero) and
// simply appears under Reduce Motion.

const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1);
const SETTLE_IN = {
  from: { opacity: 0, transform: [{ scale: 0.96 }] },
  to: { opacity: 1, transform: [{ scale: 1 }] },
};
const FADE_IN = { from: { opacity: 0 }, to: { opacity: 1 } };

export default function ConfirmHost() {
  const theme = useSportTheme();
  const reduced = useReducedMotion();
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // The open request lives in a ref too, so answering it never depends on a render having happened.
  const open = useRef<ConfirmRequest | null>(null);

  useEffect(
    () =>
      registerConfirmHost((next) => {
        open.current?.resolve(false); // a second question replaces the first, which counts as a no
        open.current = next;
        setRequest(next);
      }),
    [],
  );

  // Unmounting with a question open (leaving the screen) answers it.
  useEffect(() => () => open.current?.resolve(false), []);

  const answer = (ok: boolean) => {
    const r = open.current;
    open.current = null;
    setRequest(null);
    r?.resolve(ok);
  };

  if (!request) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => answer(false)}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.scrim },
          !reduced && { animationName: FADE_IN, animationDuration: 150, animationTimingFunction: EASE_OUT },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => answer(false)} accessibilityRole="button" accessibilityLabel="Cancel" />
      </Animated.View>
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.dialog,
            { backgroundColor: theme.deck, borderColor: request.destructive ? theme.dangerSolid : theme.accentSoft, borderTopColor: request.destructive ? theme.dangerSolid : theme.accent },
            !reduced && { animationName: SETTLE_IN, animationDuration: 200, animationTimingFunction: EASE_OUT },
          ]}
        >
          <Text style={[type.headline, { color: theme.onDark }]} accessibilityRole="header">
            {request.title}
          </Text>
          <Text style={[type.body, { color: theme.onDarkSoft }]}>{request.message}</Text>
          <View style={styles.buttons}>
            <Button label={request.cancelLabel ?? 'Cancel'} variant="deck" onPress={() => answer(false)} style={{ flex: 1 }} />
            <Button
              label={request.confirmLabel}
              variant={request.destructive ? 'danger' : 'primary'}
              onPress={() => answer(true)}
              style={{ flex: 1 }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: space.xl },
  dialog: { borderRadius: radius.xl, borderWidth: 1, borderTopWidth: 3, padding: space.lg, gap: space.md, maxWidth: 440, width: '100%', alignSelf: 'center' },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
