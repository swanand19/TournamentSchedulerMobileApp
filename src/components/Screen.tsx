import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NetworkError } from '@/api/errors';
import ErrorBanner from '@/components/ErrorBanner';
import PitchBackground from '@/components/PitchBackground';
import { useSportTheme } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// The scaffold for a screen under the native header: the striped pitch, a scroll area with
// pull-to-refresh, the error banner in a consistent place, and an optional sticky footer — the
// thumb-zone action bar the design puts at the bottom of every task screen.

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** A load error, shown at the top with a retry or "Change server". */
  error?: Error | null;
  onRetry?: () => void;
  scroll?: boolean;
};

export default function Screen({ children, footer, onRefresh, refreshing = false, error, onRetry, scroll = true }: Props) {
  const theme = useSportTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const banner = (
    <ErrorBanner
      message={error?.message}
      actionLabel={error instanceof NetworkError ? 'Change server' : onRetry ? 'Try again' : undefined}
      onAction={error instanceof NetworkError ? () => router.push('/server') : onRetry}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      <PitchBackground theme={theme} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: (footer ? space.lg : insets.bottom + space.xxl) }]}
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
        <View
          style={[
            styles.footer,
            { backgroundColor: theme.deck, borderTopColor: theme.accentSoft, paddingBottom: insets.bottom + space.md },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: 1, gap: space.sm },
});
