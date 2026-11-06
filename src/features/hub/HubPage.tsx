import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_ROOM } from '@/components/GlassTabBar';
import { PressRetentionContext } from '@/components/PressableScale';
import { useKeyboardRoom } from '@/hooks/useKeyboardRoom';
import { useSportTheme } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// One page of the started hub. Each page scrolls on its own (so switching tabs keeps your place
// on each) and can pin one of its own children under the hub's tab bar — the stats page pins its
// leaderboard header this way. `stickyIndex` counts direct children, so pass them flat.

type Props = {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  stickyIndex?: number;
};

export default function HubPage({ children, onRefresh, refreshing = false, stickyIndex }: Props) {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  // The Teams page's "Add a team" field stays above the keyboard (Android; see useKeyboardRoom).
  const { rootRef: keyboardRootRef, scrollRef: keyboardScrollRef, room: keyboardRoom, onScroll: onKeyboardScroll } = useKeyboardRoom<ScrollView>();

  return (
    <View ref={keyboardRootRef} style={{ flex: 1, paddingBottom: keyboardRoom }}>
      <ScrollView
        ref={keyboardScrollRef}
        onScroll={onKeyboardScroll}
        scrollEventThrottle={16}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        // Glass: the page ends clear of the floating tab bar.
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + (theme.mode === 'dark' ? TAB_BAR_ROOM : space.xxl) }]}
        stickyHeaderIndices={stickyIndex !== undefined ? [stickyIndex] : undefined}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.deep]} /> : undefined
        }
      >
        {children}
      </ScrollView>
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
    // Glass: the wallpaper's base, a touch see-through, so rows passing under it dim rather than vanish.
    <View style={[styles.band, { backgroundColor: theme.mode === 'dark' ? `${theme.page}EB` : theme.page, borderBottomColor: theme.borderOnDark }]}>
      {/* Pinned by a transform the press logic can't see; see PressRetentionContext. */}
      <PressRetentionContext.Provider value={100000}>{children}</PressRetentionContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  band: {
    marginHorizontal: -space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
