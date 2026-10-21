import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { ApiError, NetworkError } from '@/api/errors';
import type { Profile } from '@/api/types';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Skeleton from '@/components/Skeleton';
import { SportSlice } from '@/features/profile/ProfileParts';
import { useQuery } from '@/hooks/useQuery';
import { formatPhone, initials, monthYear, plural } from '@/lib/format';
import { fonts, footballTheme as theme, radius, space, type } from '@/theme/theme';

// The base profile: who someone is, and a card per sport that opens their career in it. Opened
// from the account button on Home (yours: with email, phone and Edit) or from a player's name
// (`playerId`, the squad place tapped; or `userId`). It belongs to no sport, so it sits on the
// neutral night ground; each sport's card brings its own colours.

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, playerId } = useLocalSearchParams<{ userId?: string; playerId?: string }>();
  const fetcher = useCallback(() => api.call<Profile>('PROFILE_GET', { query: { userId, playerId } }), [userId, playerId]);
  const profile = useQuery(fetcher);
  const p = profile.data;

  // An unlinked squad place, or someone who isn't a player: a calm empty state, not a red banner.
  const missing = !p && profile.error instanceof ApiError && profile.error.status === 404;

  const openSport = (sport: string) =>
    router.push({ pathname: '/profile/[sport]', params: p && !p.isMe ? { sport, userId: String(p.userId) } : { sport } });

  return (
    <View style={{ flex: 1, backgroundColor: theme.night }}>
      <Stack.Screen
        options={{
          title: p && !p.isMe ? 'Player' : 'Profile',
          headerStyle: { backgroundColor: theme.night },
          headerTintColor: theme.accent,
          headerTitleStyle: { fontFamily: fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          contentStyle: { backgroundColor: theme.night },
          headerRight: p?.isMe
            ? () => (
                <PressableScale
                  onPress={() => router.push('/account')}
                  accessibilityRole="button"
                  accessibilityLabel="Edit account"
                  style={[styles.edit, { borderColor: theme.borderOnDark }]}
                >
                  <Icon name="pencil-outline" size={16} color={theme.onDark} />
                  <Text style={[type.bodyStrong, { color: theme.onDark }]}>Edit</Text>
                </PressableScale>
              )
            : undefined,
        }}
      />
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.lg }}
        refreshControl={<RefreshControl refreshing={profile.refreshing} onRefresh={profile.refresh} tintColor={theme.accent} colors={[theme.deep]} />}
      >
        {missing ? (
          <EmptyState icon="account-question-outline" title="No profile to show" message={profile.error!.message} />
        ) : (
          <ErrorBanner
            message={profile.error?.message}
            actionLabel={profile.error instanceof NetworkError ? 'Change server' : 'Try again'}
            onAction={profile.error instanceof NetworkError ? () => router.push('/server') : profile.refresh}
          />
        )}

        {!p && !profile.error ? <Skeleton rows={3} height={120} /> : null}

        {p ? (
          <>
            <View style={styles.identity}>
              <View style={[styles.avatar, { backgroundColor: theme.deckRaised, borderColor: theme.borderOnDark }]}>
                <Text style={[styles.avatarText, { color: theme.onDark }]}>{initials(p.name)}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.name, { color: theme.onDark }]} accessibilityRole="header" numberOfLines={2}>
                  {p.name.toUpperCase()}
                </Text>
                <Text style={[type.body, { color: theme.onDarkSoft }]}>Playing since {monthYear(p.memberSince)}</Text>
                {p.tournamentsRun > 0 ? (
                  <Text style={[type.caption, { color: theme.onDarkSoft }]}>Organiser of {plural(p.tournamentsRun, 'tournament')}</Text>
                ) : null}
              </View>
            </View>

            {p.isMe && (p.email || p.phone) ? (
              <View style={{ gap: space.sm }}>
                <View style={[styles.contact, { backgroundColor: theme.surfaceOnDark }]}>
                  {p.email ? (
                    <View style={[styles.contactRow, p.phone ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderOnDark } : null]}>
                      <Icon name="email-outline" size={18} color={theme.onDarkSoft} />
                      <Text style={[type.body, { color: theme.onDark, flex: 1 }]} numberOfLines={1}>
                        {p.email}
                      </Text>
                    </View>
                  ) : null}
                  {p.phone ? (
                    <View style={styles.contactRow}>
                      <Icon name="cellphone" size={18} color={theme.onDarkSoft} />
                      <Text style={[type.body, { color: theme.onDark }]}>{formatPhone(p.phone)}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.privacy}>
                  <Icon name="lock-outline" size={13} color={theme.onDarkSoft} />
                  <Text style={[type.caption, { color: theme.onDarkSoft }]}>Only you see your email and phone.</Text>
                </View>
              </View>
            ) : null}

            <Text style={[type.headline, { color: theme.onDark, marginTop: space.sm }]} accessibilityRole="header">
              {p.isMe ? 'Your sports' : 'Sports'}
            </Text>
            <View style={{ gap: space.md }}>
              {p.sports.map((card) => (
                <SportSlice key={card.sport} card={card} onPress={() => openSport(card.sport)} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  edit: { height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 30, letterSpacing: 1 },
  name: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: 0.5 },
  contact: { borderRadius: radius.lg },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.xs },
});
