import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Club, ClubSquadQuestion } from '@/api/types';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Sheet from '@/components/Sheet';
import { useAction } from '@/hooks/useAction';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { space } from '@/theme/theme';

// The one-sheet question (C-5, C-6, C-20; board Club-AddPlayer-Ask). A player added to a lasting team is already in
// its squads for tournaments still to come; for the ones being played now, the admin ticks which (all ticked to start,
// one sheet however many there are). Leaving works the same way the other round. The server says what was done and
// what can be ticked (`question`); a row it greys carries its reason.

type Props = {
  club: Club;
  question: ClubSquadQuestion | null;
  onClose: () => void;
  onSaved: (club: Club) => void;
};

export default function ClubSquadSheet({ club, question, onClose, onSaved }: Props) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const open = question?.live.filter((l) => !l.reason) ?? [];
  const [ticked, setTicked] = useState<Set<number>>(() => new Set(open.map((l) => l.teamId)));
  const adding = question?.change !== 'remove';
  const who = question?.playerName ?? 'them';
  const count = open.filter((l) => ticked.has(l.teamId)).length;

  const toggle = (teamId: number) => {
    haptic.select();
    setTicked((s) => {
      const next = new Set(s);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const apply = async () => {
    if (!question || count === 0) return onClose();
    const chosen = open.filter((l) => ticked.has(l.teamId));
    const body = adding
      ? { clubPlayerId: question.clubPlayerId, teamIds: chosen.map((l) => l.teamId) }
      : { playerIds: chosen.map((l) => l.playerId).filter((id): id is number => id != null) };
    const res = await action.run(() => api.call<Club>('CLUB_SQUADS_APPLY', { routeParams: { clubId: club.clubId }, body }));
    if (!res.ok) return;
    haptic.success();
    onSaved(res.value);
    onClose();
  };

  const done = question?.done ?? [];
  return (
    <Sheet
      visible={!!question}
      onClose={onClose}
      title={adding ? `Add ${who} to the tournaments being played now?` : `Leave ${who} out of the tournaments being played now?`}
      subtitle={
        done.length > 0
          ? `${adding ? 'Already in' : 'Already out of'} the squad for ${done.join(', ')}, which ${done.length === 1 ? 'hasn’t' : 'haven’t'} started.`
          : undefined
      }
      footer={
        <>
          <Button label={adding ? 'Only the team for now' : 'Keep them in for now'} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={count === 0 ? 'Done' : `${adding ? 'Add to' : 'Leave out of'} ${plural(count, 'tournament')}`}
            onPress={apply}
            busy={action.busy}
            style={{ flex: 1.3 }}
          />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      {question?.live.map((l) => {
        const on = !l.reason && ticked.has(l.teamId);
        return (
          <PressableScale
            key={l.teamId}
            onPress={l.reason ? undefined : () => toggle(l.teamId)}
            disabled={!!l.reason}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on, disabled: !!l.reason }}
            accessibilityLabel={`${l.tournamentName}, as ${l.teamName}${l.reason ? `. ${l.reason}` : ''}`}
            style={[styles.row, { borderBottomColor: theme.cardDivider, opacity: l.reason ? 0.55 : 1 }]}
          >
            <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={on ? theme.successSolid : theme.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={2}>
                {l.tournamentName}
              </Text>
              <Text style={[type.caption, { color: theme.muted }]}>{l.reason ?? `As ${l.teamName}`}</Text>
            </View>
          </PressableScale>
        );
      })}
      <Text style={[type.caption, { color: theme.muted }]}>
        {adding
          ? 'Not now? You can add them later from the tournament’s team page.'
          : 'Matches they have played stay on the scorecards either way.'}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: 1 },
});
