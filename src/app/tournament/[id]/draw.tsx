import { useRouter } from 'expo-router';

import EmptyState from '@/components/EmptyState';
import Screen from '@/components/Screen';
import Skeleton from '@/components/Skeleton';
import { useDraw, useDrawMoments } from '@/features/auction/DrawParts';
import { DrawLive, DrawResults, DrawSetup } from '@/features/auction/DrawScreens';
import { useTournament } from '@/hooks/useTournament';

// The team draw, one screen for everyone; what it shows depends on where the draw stands (the
// server says): owners set it up, then the live draw (the drawer's controls, or the board for
// everyone watching), then the teams drawn — move, swap, start again, confirm.

export default function DrawScreen() {
  const t = useTournament();
  const router = useRouter();
  const draw = useDraw(t.id);
  const state = draw.data;
  useDrawMoments(state);

  if (!state) {
    return (
      <Screen error={draw.error} onRetry={draw.refresh}>
        <Skeleton rows={3} height={120} />
      </Screen>
    );
  }

  const props = { state, tournamentId: t.id, tournamentName: t.name, onState: draw.setData, offset: draw.offset };
  if (state.status === 'None' || state.status === 'Setup') {
    if (state.me.isOwner) return <DrawSetup {...props} />;
    return (
      <Screen onRefresh={draw.refresh} refreshing={draw.refreshing}>
        <EmptyState
          icon="shuffle-variant"
          title="The draw hasn't started"
          message={
            state.me.poolPlayerId != null
              ? "You're in the player pool. When the organiser starts the draw you'll get a notification, and you can watch here which team you're drawn for."
              : 'The organisers are still setting it up. Watch it here once it starts.'
          }
          actionLabel="See the player pool"
          onAction={() => router.push({ pathname: '/tournament/[id]/pool', params: { id: String(t.id) } })}
        />
      </Screen>
    );
  }
  if (state.status === 'Live' && !state.allDrawn) return <DrawLive {...props} />;
  return <DrawResults {...props} />;
}
