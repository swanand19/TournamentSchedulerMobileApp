import { useRouter } from 'expo-router';
import { View } from 'react-native';

import EmptyState from '@/components/EmptyState';
import Screen from '@/components/Screen';
import Skeleton from '@/components/Skeleton';
import { AuctionBidder, AuctionConsole, AuctionWatch } from '@/features/auction/AuctionLive';
import { SoldOverlay, useAuction, useAuctionMoments } from '@/features/auction/AuctionParts';
import { AuctionResults } from '@/features/auction/AuctionResults';
import { AuctionSetup } from '@/features/auction/AuctionSetup';
import { useTournament } from '@/hooks/useTournament';

// The player auction, one screen for everyone; what it shows depends on who's looking and where
// the auction stands (the server says both):
//  setup     – owners set the rules and bidders; everyone else waits
//  live      – the auctioneer's console, a bidder's screen, or the board to watch
//  after     – another round or the end, results, assigning by hand, confirming the teams
// A sale lands on every phone at once as the SOLD card, over whichever of these is showing.

export default function AuctionScreen() {
  const t = useTournament();
  const router = useRouter();
  const auction = useAuction(t.id);
  const state = auction.data;
  const { moment, dismiss } = useAuctionMoments(state);

  if (!state) {
    return (
      <Screen error={auction.error} onRetry={auction.refresh}>
        <Skeleton rows={3} height={120} />
      </Screen>
    );
  }

  const props = { state, tournamentId: t.id, onState: auction.setData };
  let view;
  switch (state.status) {
    case 'None':
    case 'Setup':
      view = state.me.isOwner ? (
        <AuctionSetup {...props} tournamentName={t.name} />
      ) : (
        <Screen onRefresh={auction.refresh} refreshing={auction.refreshing}>
          <EmptyState
            icon="gavel"
            title="The auction hasn't started"
            message={
              state.me.poolPlayerId != null
                ? "You're in the player pool. When the organiser starts the auction you'll get a notification, and you can watch here which team buys you."
                : state.me.bidderForTeamId != null
                  ? `You bid for ${state.teams.find((x) => x.teamId === state.me.bidderForTeamId)?.name}. You'll get a notification when it starts; bid from this screen.`
                  : 'The organisers are still setting it up. Watch it here once it starts.'
            }
            actionLabel="See the player pool"
            onAction={() => router.push({ pathname: '/tournament/[id]/pool', params: { id: String(t.id) } })}
          />
        </Screen>
      );
      break;
    case 'Live':
    case 'Paused':
      view = state.me.isAuctioneer ? (
        <AuctionConsole {...props} offset={auction.offset} />
      ) : state.me.bidderForTeamId != null ? (
        <AuctionBidder {...props} offset={auction.offset} />
      ) : (
        <AuctionWatch {...props} offset={auction.offset} />
      );
      break;
    default:
      view = <AuctionResults {...props} tournamentName={t.name} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {view}
      <SoldOverlay
        result={moment}
        unit={state.settings.unit}
        myTeamId={state.me.bidderForTeamId}
        teams={state.teams}
        min={state.settings.minSquad}
        max={state.settings.maxSquad}
        onDismiss={dismiss}
      />
    </View>
  );
}
