import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { FollowResult, FollowSummary, PersonRow } from '@/api/types';
import Button from '@/components/Button';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useAction } from '@/hooks/useAction';
import { initials } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { pictureUri } from '@/lib/pictures';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// Following people (2026-11-23, item 6; canvas "Proposal · Following people"): the Follow button every screen uses
// (search, profile, lists, the inbox's "Follow back") and a person's row. Following works at once; the button shows
// the new state as soon as it's tapped and goes back if the server says no.

type FollowState = { isFollowing: boolean; followsMe: boolean };

/** Follow / Following / Follow back. Tapping Following stops following. */
export function FollowButton({
  userId,
  name,
  state,
  size = 'sm',
  compact,
  onChanged,
}: {
  userId: number;
  name: string;
  state: FollowState;
  size?: 'sm' | 'md' | 'lg';
  /** No icon: for rows where the name needs the room. */
  compact?: boolean;
  onChanged?: (follow: FollowSummary) => void;
}) {
  const action = useAction();
  // What the person sees right now: the tap's result straight away, the server's when it answers.
  const [following, setFollowing] = useState<boolean | null>(null);
  const on = following ?? state.isFollowing;

  const toggle = async () => {
    const next = !on;
    setFollowing(next);
    const res = await action.run(() =>
      api.call<FollowResult>(next ? 'PERSON_FOLLOW' : 'PERSON_UNFOLLOW', { routeParams: { userId } }),
    );
    if (!res.ok) {
      setFollowing(!next);
      return;
    }
    if (next) haptic.success();
    setFollowing(res.value.follow.isFollowing);
    onChanged?.(res.value.follow);
  };

  const label = on ? 'Following' : state.followsMe ? 'Follow back' : 'Follow';
  return (
    <Button
      label={label}
      icon={compact ? undefined : on ? 'check' : 'plus'}
      size={size}
      variant={on ? 'secondary' : 'primary'}
      onPress={toggle}
      disabled={action.busy}
      accessibilityLabel={on ? `Following ${name}. Tap to stop following` : `${label} ${name}`}
    />
  );
}

/** A photo, or initials while there's none. */
export function Avatar({ name, photoUrl, size = 40 }: { name: string; photoUrl: string | null; size?: number }) {
  const theme = useSportTheme();
  const { fonts } = useTypography();
  const uri = pictureUri(photoUrl);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.tint }}>
      {uri ? (
        <Image source={{ uri }} cachePolicy="memory-disk" contentFit="cover" accessibilityIgnoresInvertColors style={StyleSheet.absoluteFill} />
      ) : (
        <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: size * 0.36, color: theme.deep }}>{initials(name)}</Text>
      )}
    </View>
  );
}

/** One person: tap opens their profile; the button follows; ⋮ (your own followers only) offers Remove follower. */
export function PersonLine({ person, onOpen, onMore, onChanged }: { person: PersonRow; onOpen: () => void; onMore?: () => void; onChanged?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const { type } = useTypography();
  return (
    <View style={styles.row}>
      <PressableScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${person.name}${person.line ? `, ${person.line}` : ''}${person.followsMe ? ', follows you' : ''}. Opens their profile`}
        style={styles.who}
      >
        <Avatar name={person.name} photoUrl={person.photoUrl} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
            {person.name}
            {person.isMe ? ' (you)' : ''}
          </Text>
          <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
            {[person.followsMe && !person.isFollowing ? 'Follows you' : null, person.line].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </PressableScale>
      {!person.isMe && <FollowButton userId={person.userId} name={person.name} state={person} compact={!!onMore} onChanged={onChanged} />}
      {onMore && (
        <PressableScale onPress={onMore} accessibilityRole="button" accessibilityLabel={`More for ${person.name}`} style={styles.more}>
          <Icon name="dots-vertical" size={22} color={theme.muted} />
        </PressableScale>
      )}
    </View>
  );
}

const makeStyles = (_: Typography) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 60 },
    who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
    more: { width: 32, height: 48, alignItems: 'center', justifyContent: 'center' },
  });
