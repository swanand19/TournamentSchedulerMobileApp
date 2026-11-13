import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SERVER_ACTION_LABEL } from '@/config/server';
import { api } from '@/api/client';
import { ApiError, NetworkError } from '@/api/errors';
import type { Profile } from '@/api/types';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Glass from '@/components/Glass';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import SegmentedControl from '@/components/SegmentedControl';
import Skeleton from '@/components/Skeleton';
import { SportSlice } from '@/features/profile/ProfileParts';
import { useQuery } from '@/hooks/useQuery';
import { formatPhone, initials, monthYear, plural } from '@/lib/format';
import { switchThemeMode, useThemeMode } from '@/theme/appearance';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type ThemeMode, type Typography } from '@/theme/theme';

// The base profile: who someone is, and a card per sport that opens their career in it. Opened
// from the account button on Home (yours: with email, phone, Edit and the app's appearance) or
// from a player's name (`playerId`, the squad place tapped; or `userId`). It belongs to no sport,
// so it sits on the neutral night ground; each sport's card brings its own colours.

const APPEARANCES: { key: ThemeMode; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
];

export default function ProfileScreen() {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const mode = useThemeMode();
  // Light ("B · Profile"): a thin sentence-case name, contacts as hairline rows, a plain Edit.
  const light = mode === 'light';
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
    // Glass: clear, so the stack's neutral wallpaper shows; the bar floats over it.
    <View style={{ flex: 1, backgroundColor: light ? theme.night : 'transparent' }}>
      <Stack.Screen
        options={{
          title: p && !p.isMe ? 'Player' : 'Profile',
          headerStyle: { backgroundColor: light ? theme.night : 'transparent' },
          headerTintColor: light ? theme.ink : theme.onDark,
          headerTitleStyle: { fontFamily: light ? fonts.body : fonts.bodySemiBold, fontSize: 17, color: theme.onDark },
          contentStyle: { backgroundColor: theme.night },
          headerRight: p?.isMe
            ? () => (
                <PressableScale
                  onPress={() => router.push('/account')}
                  accessibilityRole="button"
                  accessibilityLabel="Edit account"
                  feel={light || Platform.OS === 'ios' ? 'press' : 'glass'}
                  glowRadius={22}
                  style={[styles.edit, { borderColor: 'transparent' }]}
                >
                  {/* iPhone's bar already puts its buttons on glass; elsewhere we draw it. */}
                  {!light && Platform.OS !== 'ios' && <Glass pointerEvents="none" radius={22} interactive style={StyleSheet.absoluteFill} />}
                  <Text style={[light ? type.body : type.bodyStrong, { color: light ? theme.deep : theme.onDark }]}>Edit</Text>
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
            actionLabel={profile.error instanceof NetworkError ? SERVER_ACTION_LABEL : 'Try again'}
            onAction={profile.error instanceof NetworkError ? () => router.push('/server') : profile.refresh}
          />
        )}

        {!p && !profile.error ? <Skeleton rows={3} height={120} /> : null}

        {p ? (
          <>
            <View style={styles.identity}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: theme.glassFill, borderColor: theme.glassBorder, boxShadow: light ? undefined : `inset 0 1px 0 ${theme.glassRim}` },
                  light && { borderWidth: 1, borderColor: theme.fieldBorder, width: 72, height: 72 },
                ]}
              >
                <Text style={[styles.avatarText, light && { fontSize: 26, letterSpacing: 0 }, { color: theme.onDark }]}>{initials(p.name)}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={[light ? [type.title, { fontSize: 30, lineHeight: 36 }] : styles.name, { color: theme.onDark }]}
                  accessibilityRole="header"
                  numberOfLines={2}
                >
                  {p.name}
                </Text>
                <Text style={[type.body, { color: theme.onDarkSoft }]}>Playing since {monthYear(p.memberSince)}</Text>
                {p.tournamentsRun > 0 ? (
                  <Text style={[type.caption, { color: theme.onDarkSoft }]}>Organiser of {plural(p.tournamentsRun, 'tournament')}</Text>
                ) : null}
              </View>
            </View>

            {p.isMe && (p.email || p.phone) ? (
              <View style={{ gap: space.sm }}>
                <View style={[styles.contact, light ? { borderTopWidth: 1, borderColor: theme.cardDivider } : { backgroundColor: theme.cream, borderRadius: radius.glass }]}>
                  {p.email ? (
                    <View
                      style={[
                        styles.contactRow,
                        light && styles.lightContactRow,
                        p.phone || light ? { borderBottomWidth: light ? 1 : StyleSheet.hairlineWidth, borderBottomColor: theme.borderOnDark } : null,
                      ]}
                    >
                      <Icon name="email-outline" size={18} color={theme.onDarkSoft} />
                      <Text style={[type.body, { color: theme.onDark, flex: 1 }]} numberOfLines={1}>
                        {p.email}
                      </Text>
                    </View>
                  ) : null}
                  {p.phone ? (
                    <View style={[styles.contactRow, light && [styles.lightContactRow, { borderBottomWidth: 1, borderBottomColor: theme.borderOnDark }]]}>
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

            {p.isMe ? (
              <View style={{ gap: space.sm }}>
                <Text style={[type.label, { color: theme.onDarkSoft }]}>Appearance</Text>
                <SegmentedControl accessibilityLabel="Appearance" segments={APPEARANCES} value={mode} onChange={switchThemeMode} />
                <Text style={[type.caption, { color: theme.onDarkSoft }]}>Kept on this phone until you sign out.</Text>
              </View>
            ) : null}

            <Text style={[type.headline, { color: theme.onDark, marginTop: space.sm }]} accessibilityRole="header">
              {p.isMe ? 'Your sports' : 'Sports'}
            </Text>
            <View style={{ gap: light ? 0 : space.md }}>
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

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  edit: { height: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 28 },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  contact: { borderRadius: radius.lg },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, paddingHorizontal: space.md + 2 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.xs },
  lightContactRow: { paddingHorizontal: 0, minHeight: 52 },
});
