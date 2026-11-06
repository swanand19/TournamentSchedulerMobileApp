import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { api } from '@/api/client';
import type { UnreadCount } from '@/api/types';
import Glass from '@/components/Glass';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useQuery } from '@/hooks/useQuery';
import { useSportTheme, useThemedStyles } from '@/theme/SportTheme';
import { radius, type Typography } from '@/theme/theme';

// The bell on Home: how many notifications are unread — asked for at once when the live line says
// the inbox changed, and every 30 seconds while Home is on screen (every minute while the line is
// open; again whenever it comes back into view, e.g. after reading them). Opens the inbox.
// Glass theme: a round glass button with the count in a small tinted badge on its shoulder.

const POLL_MS = 30_000;
const INBOX = { kind: 'inbox' } as const;

export default function NotificationBell({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const fetcher = useCallback(() => api.call<UnreadCount>('NOTIFICATION_UNREAD'), []);
  const unread = useQuery(fetcher, { pollMs: POLL_MS, live: INBOX });
  const count = unread.data?.unreadCount ?? 0;
  const glass = theme.mode === 'dark';

  return (
    <PressableScale
      onPress={() => router.push('/notifications')}
      feel={glass ? 'glass' : 'press'}
      glowRadius={22}
      style={[glass ? styles.circle : { borderColor: theme.borderOnDark, backgroundColor: theme.deck }, style]}
      accessibilityLabel={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
    >
      {glass && <Glass pointerEvents="none" radius={22} interactive style={StyleSheet.absoluteFill} />}
      <Icon name={count > 0 ? 'bell-badge-outline' : 'bell-outline'} size={glass ? 22 : 20} color={theme.onDark} />
      {count > 0 && (
        <View style={[styles.badge, glass && styles.shoulder, { backgroundColor: theme.accent }]}>
          <Text style={[styles.badgeText, { color: theme.accentInk }]}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </PressableScale>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 20, height: 20, borderRadius: radius.pill, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  shoulder: { position: 'absolute', top: -4, right: -4 },
  badgeText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
});
