import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressRetentionContext } from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// One page of the started hub. Each page scrolls on its own (so switching tabs keeps your place
// on each) and can pin one of its own children under the hub's tab bar — the stats page pins its
// leaderboard header this way. `stickyIndex` counts direct children, so pass them flat.
//
// The pinned band is also a detent. A fling up from inside the list comes to rest exactly where
// the band un-pins — the top of the list — instead of flying on into the overview; a fling down
// from the overview lands there too. The next scroll from that point moves on freely, and a slow
// drag is never pulled back. This is the platform's own snapping (snapToOffsets with snapToStart
// and snapToEnd off: snap only when a fling would cross the offset), so it decelerates with the
// platform's physics on both iOS and Android rather than being stopped by hand.

const BandLayoutContext = createContext<((y: number) => void) | null>(null);

type Props = {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  stickyIndex?: number;
};

export default function HubPage({ children, onRefresh, refreshing = false, stickyIndex }: Props) {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const [bandY, setBandY] = useState<number | null>(null);
  const flingFrom = useRef<number | null>(null);

  const onBandLayout = useCallback((y: number) => setBandY((prev) => (prev === null || Math.abs(prev - y) > 0.5 ? y : prev)), []);

  // A light tick when a fling settles on the detent — the one moment the user should feel it.
  const onMomentumScrollBegin = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    flingFrom.current = e.nativeEvent.contentOffset.y;
  };
  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const from = flingFrom.current;
    flingFrom.current = null;
    if (bandY === null || from === null) return;
    const y = e.nativeEvent.contentOffset.y;
    if (Math.abs(y - bandY) < 1.5 && Math.abs(from - bandY) > 24) haptic.detent();
  };

  const detent = stickyIndex !== undefined && bandY !== null && bandY > 0;

  return (
    <BandLayoutContext.Provider value={stickyIndex !== undefined ? onBandLayout : null}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
        stickyHeaderIndices={stickyIndex !== undefined ? [stickyIndex] : undefined}
        snapToOffsets={detent ? [bandY] : undefined}
        snapToStart={false}
        snapToEnd={false}
        onMomentumScrollBegin={detent ? onMomentumScrollBegin : undefined}
        onMomentumScrollEnd={detent ? onMomentumScrollEnd : undefined}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.deep]} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </BandLayoutContext.Provider>
  );
}

/**
 * The section directly above the pinned band. It reports where it ends, which is where the band
 * starts — the detent. (The band can't report that itself: the sticky header sits inside a wrapper
 * of the scroll view's own, so its layout is always at 0 within it.)
 */
export function AboveSticky({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const report = useContext(BandLayoutContext);
  const onLayout = report
    ? (e: LayoutChangeEvent) => report(e.nativeEvent.layout.y + e.nativeEvent.layout.height + CONTENT_GAP)
    : undefined;
  return (
    <View onLayout={onLayout} style={style}>
      {children}
    </View>
  );
}

/**
 * The pinned band. Opaque and full-bleed, so rows slide cleanly underneath it; the hairline under
 * it only matters once something is scrolling beneath.
 */
export function StickyBand({ children }: { children: ReactNode }) {
  const theme = useSportTheme();
  return (
    <View style={[styles.band, { backgroundColor: theme.page, borderBottomColor: theme.borderOnDark }]}>
      {/* Pinned by a transform the press logic can't see; see PressRetentionContext. */}
      <PressRetentionContext.Provider value={100000}>{children}</PressRetentionContext.Provider>
    </View>
  );
}

/** The gap between the page's children — between the section above the band and the band. */
const CONTENT_GAP = space.lg;

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: CONTENT_GAP },
  band: {
    marginHorizontal: -space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
