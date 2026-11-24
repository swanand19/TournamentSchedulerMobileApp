import { useState } from 'react';
import { Text } from 'react-native';

import Button from '@/components/Button';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import EntriesPanel from '@/features/clubs/EntriesPanel';
import { BringBackSheet } from '@/features/leagues/LeagueParts';
import TeamsList from '@/features/teams/TeamsList';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { plural } from '@/lib/format';
import { useSportTheme, useTypography } from '@/theme/SportTheme';

// Teams & rosters: the first step of the setup checklist. Owners also let lasting teams enter with a code here
// (EntriesPanel) until the tournament starts. A league's season can bring back earlier seasons' teams (leagues, 2026-11-24).

export default function TeamsScreen() {
  const { id, name, isStarted, access, query } = useTournament();
  const teams = useTeams(id);
  const { type } = useTypography();
  const theme = useSportTheme();
  const [bringing, setBringing] = useState({ open: false, key: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const league = query.data?.league;
  const canBringBack = !!league && !isStarted && access.canEdit && league.season > 1;
  const players = teams.data?.reduce((n, t) => n + t.players.length, 0) ?? 0;

  return (
    <Screen onRefresh={teams.refresh} refreshing={teams.refreshing} error={teams.error} onRetry={teams.refresh}>
      <SectionHeader
        eyebrow={teams.data ? `${name} · ${plural(teams.data.length, 'team')} · ${plural(players, 'player')}` : name}
        title="Teams & rosters"
        large
      />
      {canBringBack && (
        <Button
          label="Bring back teams"
          icon="history"
          variant="secondary"
          onPress={() => setBringing((b) => ({ open: true, key: b.key + 1 }))}
        />
      )}
      {!!notice && <Text style={[type.caption, { color: theme.onDarkSoft }]}>{notice}</Text>}
      {!isStarted && access.canEdit && <EntriesPanel tournamentId={id} onTeamsChanged={teams.reload} />}
      {teams.data ? (
        <TeamsList tournamentId={id} teams={teams.data} editable={!isStarted && access.canEdit} onChanged={teams.reload} />
      ) : teams.loading ? (
        <Skeleton rows={5} />
      ) : null}
      {canBringBack && (
        <BringBackSheet
          key={bringing.key}
          tournamentId={id}
          visible={bringing.open}
          onClose={() => setBringing((b) => ({ ...b, open: false }))}
          onDone={(text) => {
            setNotice(text);
            teams.reload();
          }}
        />
      )}
    </Screen>
  );
}
