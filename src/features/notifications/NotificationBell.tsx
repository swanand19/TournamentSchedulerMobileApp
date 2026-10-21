import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { api } from '@/api/client';
import type { UnreadCount } from '@/api/types';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useQuery } from '@/hooks/useQuery';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius } from '@/theme/theme';

// The bell on Home: how many notifications are unread, asked for every 30 seconds while Home is on
// screen (and again whenever it comes back into view, e.g. after reading them). Opens the inbox.

const POLL_MS = 30_000;

export default function NotificationBell({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useSportTheme();
  const router = useRouter();
  const fetcher = useCallback(() => api.call<UnreadCount>('NOTIFICATION_UNREAD'), []);
  const unread = useQuery(fetcher, { pollMs: POLL_MS });
  const count = unread.data?.unreadCount ?? 0;

  return (
    <PressableScale
      onPress={() => router.push('/notifications')}
      style={[style, { borderColor: theme.borderOnDark, backgroundColor: theme.deck }]}
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Icon name={count > 0 ? 'bell-badge-outline' : 'bell-outline'} size={20} color={theme.onDark} />
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.accentInk }]}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 20, height: 20, borderRadius: radius.pill, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
});
