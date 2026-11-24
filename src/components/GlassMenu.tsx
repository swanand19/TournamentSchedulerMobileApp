import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
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

import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { EASE_OUT, MATERIALIZE } from '@/lib/motion';
import { useGlassSupport } from '@/theme/glass';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// A menu of glass that springs out of the top bar's ⋯ button, the way Liquid Glass buttons morph
// into their menus: it grows from that corner with one soft overshoot as it gains opacity, and
// shrinks back into it, quicker, when it closes. The screen behind dims a little and a tap there
// closes it. Reduce Motion: it fades in and out where it stands. Rows are plain (no glass on glass);
// the risky ones sit apart below a hairline.

export type GlassMenuItem<K extends string> = { key: K; label: string; icon: IconName; apart?: boolean };

type Props<K extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: GlassMenuItem<K>[];
  onPick: (key: K) => void;
  footnote?: string;
};

export default function GlassMenu<K extends string>({ visible, onClose, title, items, onPick, footnote }: Props<K>) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const support = useGlassSupport();

  // Mounted through the closing animation, then gone (decided during render so opening isn't late).
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  if (!visible && mounted && reduced) setMounted(false);

  const open = useSharedValue(0);
  // Android puts a modal's window on screen a frame or two after React mounts it, so growing the
  // menu from the mount lost the start of the motion. It grows once the window reports itself shown.
  const shown = useRef(false);
  const grow = () => {
    shown.current = true;
    open.set(reduced ? withTiming(1, { duration: 150 }) : withSpring(1, MATERIALIZE));
  };
  useEffect(() => {
    if (!mounted) {
      shown.current = false;
      return undefined;
    }
    if (visible) {
      // Reopened while it was still closing: the window is already there.
      if (shown.current) grow();
      // A platform that never reports the window as shown must not leave the menu invisible.
      const fallback = setTimeout(() => !shown.current && grow(), 200);
      return () => clearTimeout(fallback);
    }
    if (!reduced)
      open.set(
        withTiming(0, { duration: 170, easing: EASE_OUT }, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    return undefined;
    // grow reads the motion setting and the value above; listing it would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mounted, reduced, open]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.get(), [0, 0.35], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: reduced ? 1 : interpolate(open.get(), [0, 1], [0.55, 1]) }],
  }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: interpolate(open.get(), [0, 1], [0, 1], Extrapolation.CLAMP) }));

  if (!mounted) return null;

  const top = insets.top + (Platform.OS === 'ios' ? 44 : 56) + 2;
  const plain = items.filter((i) => !i.apart);
  const apart = items.filter((i) => i.apart);

  const row = (i: GlassMenuItem<K>) => (
    <PressableScale
      key={i.key}
      onPress={() => onPick(i.key)}
      accessibilityRole="menuitem"
      glow
      glowRadius={18}
      style={styles.item}
    >
      <Icon name={i.icon} size={20} color={theme.onDark} />
      <Text style={[styles.label, { color: theme.onDark }]} numberOfLines={1}>
        {i.label}
      </Text>
    </PressableScale>
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => !shown.current && visible && grow()}
      onRequestClose={onClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        accessibilityRole="menu"
        accessibilityLabel={title}
        style={[
          styles.panel,
          {
            top,
            backgroundColor: support === 'blur' ? theme.sheetFill : theme.glassSolid,
            borderColor: theme.glassBorder,
            boxShadow: `inset 0 1px 0 ${theme.glassRim}, 0 16px 40px rgba(0,0,0,0.45)`,
          },
          panelStyle,
        ]}
      >
        {support === 'blur' && <BlurView intensity={60} tint="dark" style={[StyleSheet.absoluteFill, styles.clip]} />}
        <Text style={[styles.title, { color: theme.onDarkSoft }]}>{title}</Text>
        {plain.map(row)}
        {apart.length > 0 && <View style={[styles.rule, { backgroundColor: theme.cardDivider }]} />}
        {apart.map(row)}
        {footnote ? <Text style={[styles.footnote, { color: theme.onDarkSoft }]}>{footnote}</Text> : null}
      </Animated.View>
    </Modal>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  dim: { backgroundColor: 'rgba(0,0,0,0.28)' },
  panel: {
    position: 'absolute',
    right: space.lg,
    width: 280,
    maxWidth: '86%',
    padding: 6,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    // Grows out of the ⋯ button in the top right corner.
    transformOrigin: 'top right',
  },
  clip: { borderRadius: 28, overflow: 'hidden' },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 50, paddingHorizontal: 14, borderRadius: 18 },
  label: { fontFamily: fonts.body, fontSize: 16, flexShrink: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginHorizontal: 14, marginVertical: 4 },
  footnote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10 },
});
