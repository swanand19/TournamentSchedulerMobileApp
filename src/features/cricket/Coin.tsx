import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import Button from '@/components/Button';
import Sheet from '@/components/Sheet';
import { haptic } from '@/lib/haptics';
import { EASE_OUT } from '@/lib/motion';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { coinColours as C, space, type Typography } from '@/theme/theme';

// The toss coin. The toss itself happens on the field and the scorer records it; the flip sheet
// is only a stand-in for when nobody has a coin, so it decides nothing — it just lands on a side.

type Side = 'H' | 'T';

const brass = Platform.OS === 'web' ? ({ backgroundImage: C.face } as object) : { experimental_backgroundImage: C.face };

/** One face of the coin: brass, a rim, the letter (and the word on the big flip coin). */
export function CoinFace({ side, size, word = false }: { side: Side; size: number; word?: boolean }) {
  const { fonts } = useTypography();
  const ring = Math.max(4, Math.round(size / 18));
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: C.flat, alignItems: 'center', justifyContent: 'center' },
        { boxShadow: `inset 0 0 0 ${ring}px ${C.shine}, inset 0 0 0 ${ring + 3}px ${C.rim}` },
        brass,
      ]}
    >
      <Text style={{ fontFamily: fonts.bodyBold, fontSize: size * 0.36, lineHeight: size * 0.4, color: C.ink }}>{side}</Text>
      {word && <Text style={{ fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.2, color: C.ink }}>{side === 'H' ? 'HEADS' : 'TAILS'}</Text>}
    </View>
  );
}

/** The resting coin on the toss screen. */
export function Coin({ size = 112 }: { size?: number }) {
  return (
    <View style={{ borderRadius: size / 2, boxShadow: `0 16px 40px ${C.shadow}` }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <CoinFace side="H" size={size} />
    </View>
  );
}

const SIZE = 132;
const SPIN_MS = 1100;

/** "Flip a coin": tap Flip, it rises, spins and lands on a random side. Reduce Motion: just the side. */
export function CoinFlipSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  const lift = useSharedValue(0);
  const [side, setSide] = useState<Side | null>(null);
  const [flipping, setFlipping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flip = () => {
    if (flipping) return;
    const next: Side = Math.random() < 0.5 ? 'H' : 'T';
    haptic.select();
    if (reduced) {
      turn.value = next === 'H' ? 0 : 180;
      setSide(next);
      return;
    }
    setSide(null);
    setFlipping(true);
    // It rests on 0 (heads) or 180 (tails); five turns on lands on 1800 (heads) or 1980 (tails).
    const from = turn.value % 360;
    turn.value = from;
    turn.value = withTiming(1800 + (next === 'T' ? 180 : 0), { duration: SPIN_MS, easing: Easing.out(Easing.cubic) });
    lift.value = withSequence(
      withTiming(-90, { duration: SPIN_MS * 0.45, easing: EASE_OUT }),
      withTiming(0, { duration: SPIN_MS * 0.45, easing: Easing.in(Easing.quad) }),
      withTiming(-8, { duration: SPIN_MS * 0.05 }),
      withTiming(0, { duration: SPIN_MS * 0.05 }),
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSide(next);
      setFlipping(false);
      haptic.tap();
    }, SPIN_MS);
  };

  // Each face turns on its own and shows only while it faces us: hiding the back of a rotated
  // parent's children (backfaceVisibility) isn't honoured everywhere, and showed a mirrored H.
  const facing = (offset: number) => {
    'worklet';
    const a = (((turn.value + offset) % 360) + 360) % 360;
    return a < 90 || a > 270;
  };
  const front = useAnimatedStyle(() => ({
    opacity: facing(0) ? 1 : 0,
    transform: [{ perspective: 700 }, { translateY: lift.value }, { rotateY: `${turn.value}deg` }],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: facing(180) ? 1 : 0,
    transform: [{ perspective: 700 }, { translateY: lift.value }, { rotateY: `${turn.value + 180}deg` }],
  }));
  const shadow = useAnimatedStyle(() => {
    const k = 1 + lift.value / 180; // 1 on the ground, 0.5 at the top
    return { transform: [{ scaleX: k }, { scaleY: k }], opacity: 0.4 + 0.6 * k };
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      dark
      title="Flip a coin"
      subtitle="For when nobody has one. Let the captains call first."
      footer={
        <>
          <Button label={side ? 'Flip again' : 'Flip'} variant={side ? 'deck' : 'primary'} onPress={flip} disabled={flipping} style={{ flex: side ? 1 : 2 }} />
          {side && <Button label="Done" onPress={onClose} style={{ flex: 2 }} />}
        </>
      }
    >
      <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.shadow, shadow]} />
        <View style={styles.coin}>
          <Animated.View style={[styles.face, front]}>
            <CoinFace side="H" size={SIZE} word />
          </Animated.View>
          <Animated.View style={[styles.face, back]}>
            <CoinFace side="T" size={SIZE} word />
          </Animated.View>
        </View>
      </View>
      <View style={styles.result} accessibilityLiveRegion="polite">
        {side ? (
          <>
            <Text style={[styles.landed, { color: theme.onDark }]}>{side === 'H' ? 'Heads' : 'Tails'}</Text>
            <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>
              Whoever called {side === 'H' ? 'heads' : 'tails'} won the toss.
            </Text>
          </>
        ) : (
          <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>{flipping ? ' ' : 'Tap Flip once a captain has called.'}</Text>
        )}
      </View>
    </Sheet>
  );
}

const makeStyles = ({ fonts }: Typography) =>
  StyleSheet.create({
    stage: { height: 260, alignItems: 'center', justifyContent: 'flex-end' },
    shadow: { position: 'absolute', bottom: 4, width: 120, height: 16, borderRadius: 60, backgroundColor: C.shadow },
    coin: { width: SIZE, height: SIZE, marginBottom: 20 },
    face: { position: 'absolute', inset: 0 },
    result: { minHeight: 58, alignItems: 'center', gap: 2, paddingBottom: space.xs },
    landed: { fontFamily: fonts.bodyBold, fontSize: 30, lineHeight: 36 },
  });
