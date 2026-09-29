import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import TeamsList from '@/features/teams/TeamsList';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { plural } from '@/lib/format';

// Teams & rosters: the first step of the setup checklist.

export default function TeamsScreen() {
  const { id, name, isStarted } = useTournament();
  const teams = useTeams(id);
  const players = teams.data?.reduce((n, t) => n + t.players.length, 0) ?? 0;

  return (
    <Screen onRefresh={teams.refresh} refreshing={teams.refreshing} error={teams.error} onRetry={teams.refresh}>
      <SectionHeader
        eyebrow={teams.data ? `${name} · ${plural(teams.data.length, 'team')} · ${plural(players, 'player')}` : name}
        title="Teams & rosters"
        large
      />
      {teams.data ? (
        <TeamsList tournamentId={id} teams={teams.data} editable={!isStarted} onChanged={teams.reload} />
      ) : teams.loading ? (
        <Skeleton rows={5} />
      ) : null}
    </Screen>
  );
}
