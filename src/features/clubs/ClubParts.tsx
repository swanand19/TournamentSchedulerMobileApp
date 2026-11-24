import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Club, ClubListItem } from '@/api/types';
import { PhotoBadge } from '@/components/Badges';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Sheet from '@/components/Sheet';
import SwitchRow from '@/components/SwitchRow';
import TextField from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { capitalizeWords, plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { lip, radius, space, type Typography } from '@/theme/theme';

// Lasting teams (2026-11-20, step 2 of docs/reusable-teams-plan.md). People only ever read "team" (C-21); the code and
// the API say club. Shared here: a team's row on Home's Teams tab, and the sheet that makes one.

/** "You run it · 15 players · 2 tournaments being played" — what a row on the Teams tab says under the name. */
export function clubLine(c: ClubListItem): string {
  const who = c.isAdmin ? 'You run it' : 'You play';
  const playing = c.live > 0 ? plural(c.live, 'tournament') + ' being played' : c.tournaments > 0 ? plural(c.tournaments, 'tournament') : null;
  return [who, plural(c.players, 'player'), playing].filter(Boolean).join(' · ');
}

/** A team on Home's Teams tab: its logo (or initials), name, one line of context, "Admin" for the ones you run. */
export function ClubRow({ club, onPress }: { club: ClubListItem; onPress: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  const line = clubLine(club);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${club.name}, ${line}`}
      accessibilityHint="Opens the team"
      style={light ? [styles.lightRow, { borderBottomColor: theme.cardDivider }] : [styles.row, { backgroundColor: theme.cream }, lip(theme)]}
    >
      <PhotoBadge link={club.logoUrl} name={club.name} size={light ? 44 : 52} square />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.lead, { color: theme.ink }, light && { fontSize: 18, lineHeight: 24 }]} numberOfLines={2}>
          {club.name}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={2}>
          {line}
        </Text>
      </View>
      {club.isAdmin && (
        <View style={[styles.tag, { backgroundColor: theme.tint }]}>
          <Text style={[type.label, { color: light ? theme.deep : theme.accent }]}>Admin</Text>
        </View>
      )}
      <Icon name="chevron-right" size={20} color={theme.muted} />
    </PressableScale>
  );
}

/**
 * "Make a team": a name, where it plays, and whether you play for it too (on: you're its first player as well as its
 * first admin). The sport is the one chosen on Home (C-8: one sport per team).
 */
export function MakeTeamSheet({ visible, onClose, sport, onMade }: {
  visible: boolean;
  onClose: () => void;
  sport: 'Football' | 'Cricket';
  onMade: (club: Club) => void;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [iPlay, setIPlay] = useState(true);
  const [nameError, setNameError] = useState('');

  const make = async () => {
    if (!name.trim()) {
      setNameError('Give the team a name first.');
      return;
    }
    const res = await action.run(() => api.call<Club>('CLUB_CREATE', { body: { name: name.trim(), sport, area: area.trim() || null, iPlay } }));
    if (!res.ok) return;
    haptic.success();
    onMade(res.value);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Make a ${sport.toLowerCase()} team`}
      subtitle="Keep your players once and enter tournaments with them."
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Make team" icon="check" onPress={make} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <TextField
        label="Team name"
        value={name}
        onChangeText={(v) => {
          setName(capitalizeWords(v));
          if (nameError) setNameError('');
        }}
        placeholder="e.g. Karve Nagar Falcons"
        autoCapitalize="words"
        maxLength={60}
        error={nameError}
        hint="Other teams may have the same name; that's fine."
      />
      <TextField
        label="Where it plays (optional)"
        value={area}
        onChangeText={setArea}
        placeholder="e.g. Pune"
        autoCapitalize="words"
        maxLength={60}
      />
      <SwitchRow label="I play for this team" hint="You're its first player as well as its admin" value={iPlay} onChange={setIPlay} />
      <Text style={[type.caption, { color: theme.muted }]}>
        Anyone can see a team’s page: its players’ names and its results. Emails and numbers stay with its admins.
      </Text>
    </Sheet>
  );
}

const makeStyles = (_: Typography) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  lightRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1 },
  tag: { borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
});
