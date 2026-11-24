import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { EntryRow, TournamentEntries } from '@/api/types';
import { PhotoBadge } from '@/components/Badges';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import SwitchRow from '@/components/SwitchRow';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { confirm } from '@/lib/confirm';
import { plural, relativeDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// The organiser's side of entering with a code (board Org-Entries; plan section 6), on the tournament's Teams screen
// before the start: the "Teams can enter with a code" switch with the code and Share, then "Asking to enter" — each
// lasting team's entry with its squad, Accept or Decline (C-7). Accepting makes the team (`onTeamsChanged` reloads the
// list below). Entries close by themselves when the schedule is approved (C-10); the server says so in `closed`.

export default function EntriesPanel({ tournamentId, onTeamsChanged }: { tournamentId: number; onTeamsChanged: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const fetcher = useCallback(() => api.call<TournamentEntries>('TOURNAMENT_ENTRY_LIST', { routeParams: { id: tournamentId } }), [tournamentId]);
  const entries = useQuery(fetcher);
  const switchAction = useAction();
  const answerAction = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  const e = entries.data;
  if (!e) return null;

  const setOpen = async (open: boolean) => {
    const res = await switchAction.run(() => api.call<TournamentEntries>('TOURNAMENT_ENTRY_CODE', { routeParams: { id: tournamentId }, body: { open } }));
    if (res.ok) {
      haptic.select();
      entries.setData(res.value);
    }
  };

  const answer = async (row: EntryRow, accept: boolean) => {
    if (!accept) {
      const ok = await confirm({
        title: `Decline ${row.teamName}?`,
        message: `${row.requestedBy} will hear that you didn't take the entry.`,
        confirmLabel: 'Decline',
        destructive: true,
      });
      if (!ok) return;
    }
    const res = await answerAction.run(() =>
      api.call<TournamentEntries>(accept ? 'TOURNAMENT_ENTRY_ACCEPT' : 'TOURNAMENT_ENTRY_DECLINE', { routeParams: { id: tournamentId, entryId: row.entryId } }),
    );
    if (res.ok) {
      if (accept) haptic.success();
      else haptic.heavy();
      setNotice(res.value.notice ?? null);
      entries.setData(res.value);
      if (accept) onTeamsChanged();
    }
  };

  return (
    <>
      <Card>
        <ErrorBanner message={switchAction.error?.message} />
        <SwitchRow
          label="Teams can enter with a code"
          hint={e.closed ?? 'Send the code to the lasting teams you want. You accept or decline each one.'}
          value={e.open}
          onChange={setOpen}
          disabled={switchAction.busy || (!!e.closed && !e.open)}
        />
        {e.open && e.code && (
          <>
            <Text style={[styles.code, { color: theme.ink }]} selectable accessibilityLabel={`Entry code ${e.code.split('').join(' ')}`}>
              {e.code}
            </Text>
            <Text style={[type.caption, { color: theme.muted }]}>
              A team’s admin opens their team, taps Enter a tournament and types it. Entries close when you approve the schedule.
            </Text>
            <Button label="Share the code" icon="share-variant" variant="secondary" onPress={() => Share.share({ message: e.shareText ?? e.code! })} />
          </>
        )}
      </Card>

      {notice && (
        <Card>
          <Text style={[type.body, { color: theme.ink }]}>{notice}</Text>
        </Card>
      )}

      {e.waiting.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Text style={[type.eyebrow, { color: theme.mode === 'light' ? theme.muted : theme.onDarkSoft }]} accessibilityRole="header">
            Asking to enter · {e.waiting.length}
          </Text>
          <ErrorBanner message={answerAction.error?.message} />
          {e.waiting.map((row) => (
            <EntryCard key={row.entryId} row={row} busy={answerAction.busy} onAnswer={(accept) => answer(row, accept)} />
          ))}
        </View>
      )}
    </>
  );
}

function EntryCard({ row, busy, onAnswer }: { row: EntryRow; busy: boolean; onAnswer: (accept: boolean) => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const [open, setOpen] = useState(false);
  const blocked = row.players.filter((p) => p.reason);
  return (
    <Card>
      <PressableScale
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${row.teamName}, ${plural(row.players.length, 'player')}, sent by ${row.requestedBy}`}
        accessibilityHint={open ? 'Hides the squad' : 'Shows the squad'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
      >
        <PhotoBadge link={row.logoUrl} name={row.clubName} size={44} square />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
            {row.teamName}
          </Text>
          <Text style={[type.caption, { color: theme.muted }]} numberOfLines={2}>
            {[row.area, plural(row.players.length, 'player'), row.record].filter(Boolean).join(' · ')}
          </Text>
          <Text style={[type.caption, { color: theme.muted }]}>
            Sent by {row.requestedBy} {relativeDate(row.requestedAt)}
          </Text>
        </View>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.muted} />
      </PressableScale>
      {open &&
        row.players.map((p) => (
          <Text key={p.clubPlayerId} style={[type.body, { color: p.reason ? theme.muted : theme.ink }]}>
            {p.name}
            {p.isCaptain ? ' · Captain' : ''}
            {p.detail ? ` · ${p.detail}` : ''}
            {p.reason ? ` — ${p.reason}` : ''}
          </Text>
        ))}
      {row.problem && <Text style={[type.caption, { color: theme.muted }]}>{row.problem} Ask them to change their name, or decline.</Text>}
      {blocked.length > 0 && !row.problem && (
        <Text style={[type.caption, { color: theme.muted }]}>
          {plural(blocked.length, 'player')} already {blocked.length === 1 ? 'has' : 'have'} a place here and won’t come into the squad.
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Decline" variant="secondary" onPress={() => onAnswer(false)} disabled={busy} style={{ flex: 1 }} />
        <Button label="Accept" icon="check" onPress={() => onAnswer(true)} busy={busy} disabled={!!row.problem} style={{ flex: 1.3 }} />
      </View>
    </Card>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  code: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, letterSpacing: 4 },
});
