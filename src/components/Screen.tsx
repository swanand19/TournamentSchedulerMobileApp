import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERVER_ACTION_LABEL } from '@/config/server';
import { NetworkError } from '@/api/errors';
import ErrorBanner from '@/components/ErrorBanner';
import Glass from '@/components/Glass';
import { useKeyboardRoom } from '@/hooks/useKeyboardRoom';
import { materialize } from '@/lib/motion';
import { useSportTheme } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// The scaffold for a screen under the native header: a scroll area with pull-to-refresh, the
// error banner in a consistent place, and an optional footer — the thumb-zone actions the design
// puts at the bottom of every task screen. The ground (wallpaper or white) is drawn by the stack
// under every screen (ThemedScreen), so this stays clear.
//
// Glass theme: the footer floats and the content scrolls under it. Its buttons are glass
// themselves, so by default they float bare over a scroll-edge fade (the content dims as it
// passes beneath, keeping the buttons and any words with them readable); `pad` puts the footer in
// a glass pad instead, for scoring keys, which are plain fills. It materializes the first time it
// appears. The scroll area ends with room for it, measured, so the last row always scrolls clear.
// Light theme: a white bar closed by a hairline.

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Glass theme: the footer is a pad of keys (scoring), drawn inside a glass pad. */
  pad?: boolean;
  /** Pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** A load error, shown at the top with a retry or "Change server". */
  error?: Error | null;
  onRetry?: () => void;
  scroll?: boolean;
};

export default function Screen({ children, footer, pad, onRefresh, refreshing = false, error, onRetry, scroll = true }: Props) {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rootRef: keyboardRootRef, scrollRef: keyboardScrollRef, room: keyboardRoom, onScroll: onKeyboardScroll } = useKeyboardRoom<ScrollView>();
  const glass = theme.mode === 'dark';
  const [footerHeight, setFooterHeight] = useState(0);
  const bottomInset = keyboardRoom ? 0 : insets.bottom;

  const banner = (
    <ErrorBanner
      message={error?.message}
      actionLabel={error instanceof NetworkError ? SERVER_ACTION_LABEL : onRetry ? 'Try again' : undefined}
      onAction={error instanceof NetworkError ? () => router.push('/server') : onRetry}
    />
  );

  const contentEnd = footer ? (glass ? footerHeight + space.sm : space.lg) : insets.bottom + space.xxl;

  return (
    // While typing, the screen ends at the keyboard (Android; see useKeyboardRoom), footer included.
    <View ref={keyboardRootRef} style={{ flex: 1, paddingBottom: keyboardRoom }}>
      {scroll ? (
        <ScrollView
          ref={keyboardScrollRef}
          onScroll={onKeyboardScroll}
          scrollEventThrottle={16}
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={[styles.content, { paddingBottom: contentEnd }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.deep]} />
            ) : undefined
          }
        >
          {banner}
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>
          {banner}
          {children}
        </View>
      )}
      {footer ? (
        glass ? (
          <Animated.View
            entering={materialize}
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={[styles.floating, { paddingBottom: bottomInset + space.sm }, !pad && edgeFade(theme.page)]}
          >
            {pad ? (
              <Glass floating radius={34} style={styles.pad}>
                {footer}
              </Glass>
            ) : (
              <View style={styles.bare}>{footer}</View>
            )}
          </Animated.View>
        ) : (
          <View
            style={[
              styles.footer,
              { backgroundColor: theme.deck, borderTopColor: theme.cardDivider, paddingBottom: bottomInset + space.md },
            ]}
          >
            {footer}
          </View>
        )
      ) : null}
    </View>
  );
}

/** The scroll edge effect: content fades into the ground as it passes under floating controls. */
export function edgeFade(page: string, edge: 'bottom' | 'top' = 'bottom') {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(page.slice(i, i + 2), 16));
  const image = `linear-gradient(${edge === 'bottom' ? '180deg' : '0deg'}, rgba(${r},${g},${b},0) 0%, rgba(${r},${g},${b},0.82) 42%, rgba(${r},${g},${b},0.92) 100%)`;
  return Platform.OS === 'web' ? ({ backgroundImage: image } as object) : { experimental_backgroundImage: image };
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, gap: space.sm },
  floating: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10 },
  pad: { padding: space.md, gap: space.sm },
  bare: { paddingTop: space.xl, paddingHorizontal: 6, gap: space.sm },
});
