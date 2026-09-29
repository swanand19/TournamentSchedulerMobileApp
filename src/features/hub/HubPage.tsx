import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressRetentionContext } from '@/components/PressableScale';
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
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      stickyHeaderIndices={stickyIndex !== undefined ? [stickyIndex] : undefined}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.deep]} /> : undefined
      }
    >
      {children}
    </ScrollView>
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
