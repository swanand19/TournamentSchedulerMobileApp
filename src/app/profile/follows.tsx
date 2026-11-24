import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { api } from '@/api/client';
import type { PersonList, PersonRow } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Screen from '@/components/Screen';
import Sheet from '@/components/Sheet';
import { SkeletonBlock } from '@/components/Skeleton';
import UnderlineTabs from '@/components/UnderlineTabs';
import { Avatar, PersonLine } from '@/features/people/PeopleParts';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// Someone's followers and the people they follow (2026-11-23; canvas board Follow-Lists). Opened from a profile's
// counts. On your own followers, ⋮ opens a sheet with View profile and Remove follower; they aren't told.
type Tab = 'followers' | 'following';

export default function FollowsScreen() {
  const { userId, tab: initial } = useLocalSearchParams<{ userId: string; tab?: Tab }>();
  const router = useRouter();
  const theme = useSportTheme();
  const { type } = useTypography();
  const [tab, setTab] = useState<Tab>(initial === 'following' ? 'following' : 'followers');
  const fetcher = useCallback(
    () => api.call<PersonList>(tab === 'followers' ? 'PERSON_FOLLOWERS' : 'PERSON_FOLLOWING', { routeParams: { userId } }),
    [tab, userId],
  );
  const list = useQuery(fetcher);
  const remove = useAction();
  const [picked, setPicked] = useState<PersonRow | null>(null);
  const [removed, setRemoved] = useState<PersonList | null>(null);
  const data = removed && removed.userId === list.data?.userId && tab === 'followers' ? removed : list.data;

  const removeFollower = async () => {
    if (!picked) return;
    const res = await remove.run(() => api.call<PersonList>('PERSON_FOLLOWER_REMOVE', { routeParams: { userId: picked.userId } }));
    if (!res.ok) return;
    setRemoved(res.value);
    setPicked(null);
  };

  const open = (p: PersonRow) => router.push({ pathname: '/profile', params: { userId: String(p.userId) } });

  return (
    <Screen onRefresh={list.refresh} refreshing={list.refreshing} error={list.error} onRetry={list.refresh}>
      <Stack.Screen options={{ title: data?.name ?? '' }} />
      <UnderlineTabs
        tabs={[
          { key: 'followers', label: `Followers${data ? ` · ${data.followers}` : ''}` },
          { key: 'following', label: `Following${data ? ` · ${data.following}` : ''}` },
        ]}
        value={tab}
        onChange={(t) => {
          setRemoved(null);
          setTab(t);
        }}
      />

      {!data ? (
        list.error ? null : (
          <View style={{ gap: space.sm }}>
            <SkeletonBlock />
            <SkeletonBlock />
          </View>
        )
      ) : data.items.length === 0 ? (
        <EmptyState
          icon="account-heart-outline"
          title={tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          message={
            data.isMine
              ? tab === 'followers'
                ? 'When someone follows you, they show up here.'
                : 'Find people under Find → People on Home, and follow them to hear when they play.'
              : tab === 'followers'
                ? `Nobody follows ${data.name} yet.`
                : `${data.name} doesn't follow anyone yet.`
          }
        />
      ) : (
        <Card>
          <View style={{ gap: space.xs }}>
            {data.items.map((p) => (
              <PersonLine
                key={p.userId}
                person={p}
                onOpen={() => open(p)}
                onMore={data.isMine && tab === 'followers' ? () => setPicked(p) : undefined}
              />
            ))}
          </View>
        </Card>
      )}

      <Sheet visible={picked != null} onClose={() => setPicked(null)} title={picked?.name ?? ''} subtitle="Follows you">
        {picked && (
          <View style={{ gap: space.md }}>
            <ErrorBanner message={remove.error?.message} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={picked.name} photoUrl={picked.photoUrl} size={44} />
              <Text style={[type.caption, { color: theme.muted, flex: 1 }]}>{picked.line ?? ''}</Text>
            </View>
            <Button
              label="View profile"
              variant="secondary"
              onPress={() => {
                const p = picked;
                setPicked(null);
                open(p);
              }}
            />
            <Button label="Remove follower" variant="secondary" busy={remove.busy} onPress={removeFollower} />
            <Text style={[type.caption, { color: theme.muted, textAlign: 'center' }]}>
              {picked.name.split(' ')[0]} isn’t told, and can follow you again later.
            </Text>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
