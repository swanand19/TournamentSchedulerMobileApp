// Every API service the app calls, by service ID.
//
// Screens name the service ("TOURNAMENT_LIST"), never a URL. The ID travels in the encrypted
// gateway request's header and the API finds the action from it — the routes live only on the
// server now ([ServiceRequestId] on each controller action). Route parameters are filled by name,
// so the names used in `routeParams` are part of the contract too: the tournament is `id`, then
// `teamId`, `playerId`, `scheduleId` and `matchId`.
//
// The API's architecture tests check every ID here, and every api.call('…') in the app, exists on
// the server.

export const SERVICES = [
  'HEALTH_CHECK',

  // Signing in (the only ones that work signed out) and the account
  'AUTH_OPTIONS', // whether mobile numbers are on
  'AUTH_OTP_SEND', // body: contact (email or mobile number)
  'AUTH_OTP_VERIFY',
  'AUTH_LOGOUT',
  'AUTH_LOGOUT_ALL',
  'ACCOUNT_GET',
  'ACCOUNT_UPDATE',
  'ACCOUNT_PHOTO_SET', // body: { image } (base64 JPEG, see lib/pictures)
  'ACCOUNT_PHOTO_REMOVE',
  'ACCOUNT_CONTACT_SEND', // a code to an email or number being added
  'ACCOUNT_CONTACT_VERIFY',
  'ACCOUNT_CONTACT_REMOVE', // body: kind (Email | Phone)
  'ACCOUNT_DELETE_PREVIEW', // sends the code that confirms it
  'ACCOUNT_DELETE',

  // Profiles and careers (query: userId | playerId; none = me)
  'PROFILE_GET',
  'PROFILE_CAREER', // query: sport

  // Your inbox (phase 6D)
  'NOTIFICATION_LIST', // query: before, take
  'NOTIFICATION_UNREAD',
  'LIVE_TICKET', // live updates (realtime/live.ts): opens the line once
  'LIVE_WATCH_TOURNAMENT', // connectionId, id
  'LIVE_WATCH_MATCH', // connectionId, sport, matchId
  'LIVE_UNWATCH', // connectionId; { tournamentId } | { sport, matchId }
  'NOTIFICATION_READ', // notificationId
  'NOTIFICATION_READ_ALL',
  // Following people (2026-11-23)
  'PEOPLE_SEARCH',
  'PERSON_FOLLOW',
  'PERSON_UNFOLLOW',
  'PERSON_FOLLOWER_REMOVE',
  'PERSON_FOLLOWERS',
  'PERSON_FOLLOWING',

  // Watching a match (Round 2; routeParams: sport = football | cricket, matchId)
  'WATCH_MATCH', // the sides: squads before the start, line-ups after
  'WATCH_ACTIVITY', // query: before, take — what happened, newest first
  'KNOCKOUT_GET', // id — the knockout stage (everyone)
  'KNOCKOUT_PRESETS', // id — owners: formats that fit the groups
  'KNOCKOUT_APPLY', // id; { preset, thirdPlace, startDate?, endDate? }
  'KNOCKOUT_CLEAR', // id
  'KNOCKOUT_FIXTURE_ADD', // id; { round, label, home, away }
  'KNOCKOUT_FIXTURE_UPDATE', // id, fixtureId
  'KNOCKOUT_FIXTURE_DELETE', // id, fixtureId
  'KNOCKOUT_TEAM_SET', // id, fixtureId; { side, teamId }

  // Tournaments
  'TOURNAMENT_LIST', // query: sport
  'TOURNAMENT_PICTURE_SET', // routeParams: id, kind (logo | banner); body: { image }
  'TOURNAMENT_PICTURE_REMOVE', // routeParams: id, kind
  'TOURNAMENT_CREATE',
  'TOURNAMENT_GET', // id
  'TOURNAMENT_DELETE', // id
  'TOURNAMENT_START', // id
  'TOURNAMENT_MATCHES', // id
  'TOURNAMENT_STATS', // id
  'TOURNAMENT_CRICKET_STATS', // id
  'TOURNAMENT_PLAYER_LINES', // id, playerId — a leaderboard row unfolded
  'TOURNAMENT_UPDATE', // id
  'TOURNAMENT_COMPLETE', // id

  // Owners and scorers
  'TOURNAMENT_MEMBER_LIST', // id
  'TOURNAMENT_MEMBER_ADD', // id
  'TOURNAMENT_MEMBER_REMOVE', // id, userId
  'TOURNAMENT_INVITE_RESEND', // id, inviteId
  'TOURNAMENT_INVITE_CANCEL', // id, inviteId
  'TOURNAMENT_LEAVE', // id

  // Public live scores (6E): finding and following (every tournament is public; the public pages are the website's)
  'FOLLOW_SEARCH', // query: q — public tournaments by name, code or link
  'FOLLOW_ADD', // { code } (or the whole link)
  'FOLLOW_REMOVE', // tournamentId

  // Who is scoring a match — sport ('football' | 'cricket'), matchId
  'SCORING_CLAIM',
  'SCORING_REQUEST',
  'SCORING_RESPOND',
  'SCORING_TAKE_OVER',

  // Groups and schedule
  'SCHEDULE_ACTIVE', // id
  'SCHEDULE_HISTORY', // id
  'SCHEDULE_ACTIVATE', // id, scheduleId
  'TOURNAMENT_GROUPS_RANDOMIZE',
  'TOURNAMENT_GROUPS_MANUAL',
  'TOURNAMENT_SCHEDULE_GENERATE',
  'TOURNAMENT_SCHEDULE_APPROVE',

  // Teams and players
  'TEAM_LIST', // id
  'TEAM_GET', // id, teamId
  'TEAM_CREATE', // id
  'TEAM_UPDATE', // id, teamId
  'TEAM_DELETE', // id, teamId
  'PLAYER_CONTACT_LOOKUP', // id, teamId; { contact } — who an email or number belongs to
  'PLAYER_CREATE', // id, teamId
  'PLAYER_UPDATE', // id, teamId, playerId
  'PLAYER_DELETE', // id, teamId, playerId
  'PLAYER_UNLINK', // id, teamId, playerId — an owner, or the player themselves
  'TEAM_JOIN_CODE_RESET', // id, teamId
  'PLAYER_RESTORE', // id, teamId, playerId — back into the squad after being left out
  'TEAM_ADMIN_ADD', // id, teamId; { playerId } | { contact } — owners name who runs a team
  'TEAM_ADMIN_REMOVE', // id, teamId, userId — an owner, or the admin stepping down

  // Joining a team with its code (the person isn't in the tournament yet)
  'TEAM_JOIN_PREVIEW',
  'TEAM_JOIN',

  // Lasting teams (2026-11-20, step 2): people see "team", the ids say club. All take clubId except where noted.
  'CLUB_LIST', // the caller's own teams (Home's Teams tab)
  'CLUB_CREATE', // { name, sport, area, iPlay }
  'CLUB_GET',
  'CLUB_UPDATE', // { name, area, captainClubPlayerId, setCaptain }
  'CLUB_DELETE',
  'CLUB_LOGO_SET', // { image }
  'CLUB_LOGO_REMOVE',
  'CLUB_JOIN_CODE_RESET',
  'CLUB_PLAYER_LOOKUP', // { contact }
  'CLUB_PLAYER_ADD',
  'CLUB_PLAYER_UPDATE', // clubId, clubPlayerId
  'CLUB_PLAYER_REMOVE', // clubId, clubPlayerId — an admin, or the player leaving
  'CLUB_ADMIN_ADD', // { clubPlayerId } | { contact }
  'CLUB_ADMIN_REMOVE', // clubId, userId — an admin, or stepping down
  'CLUB_JOIN_PREVIEW', // { code } — 8 characters
  'CLUB_JOIN', // { code, clubPlayerId }
  'CLUB_FROM_TEAM', // id, teamId — "Keep this team" (the team's own admins)
  'CLUB_SQUADS_PREVIEW', // clubId, clubPlayerId — the live tournaments a new player could join
  'CLUB_SQUADS_APPLY', // clubId { clubPlayerId, teamIds } | { playerIds }
  // Entering a tournament with its code (2026-11-21, step 3).
  'ENTRY_PREVIEW', // { clubId, code } | { clubId, entryId }
  'ENTRY_REQUEST', // { clubId, code, teamName, clubPlayerIds }
  'ENTRY_UPDATE', // entryId { teamName, clubPlayerIds }
  'ENTRY_WITHDRAW', // entryId
  'TOURNAMENT_ENTRY_LIST', // id (owners)
  'TOURNAMENT_ENTRY_CODE', // id { open }
  'TOURNAMENT_ENTRY_ACCEPT', // id, entryId
  'TOURNAMENT_ENTRY_DECLINE', // id, entryId

  // Football matches — all take matchId
  'MATCH_GET',
  'MATCH_SETUP',
  'MATCH_EVENT_RECORD',
  'MATCH_EVENTS',
  'MATCH_CLOCK_PAUSE',
  'MATCH_CLOCK_RESUME',
  'MATCH_CLOCK_ADD_TIME',
  'MATCH_PERIOD_END',
  'MATCH_PERIOD_NEXT',
  'MATCH_COMPLETE',
  'MATCH_PENALTIES_START',
  'MATCH_PENALTIES_GET',
  'MATCH_PENALTY_KICK',
  'MATCH_PENALTIES_END',

  // Cricket matches — all take matchId, and every one answers with the whole match state
  'CRICKET_MATCH_GET',
  'CRICKET_SETUP_OPTIONS',
  'CRICKET_SETUP',
  'CRICKET_INNINGS_START',
  'CRICKET_BALL_RECORD',
  'CRICKET_BALL_UNDO',
  'CRICKET_BATTER_SET',
  'CRICKET_BOWLER_SET',
  'CRICKET_PLAYER_REPLACE', // matchId; { playerId, replacementId }
  'CRICKET_INNINGS_END',
  'CRICKET_REDUCE_OVERS',
  'CRICKET_FOLLOW_ON',
  'CRICKET_SUPER_OVER_START',
  'CRICKET_COMPLETE',
  'CRICKET_SCORECARD',
  'CRICKET_AWARDS',

  // The player pool and the auction (2026-11-17) — id is the tournament
  'POOL_GET', // id — the pool, its tiers and the registration code (owners)
  'POOL_LOOKUP', // id; { contact } — who an email or number belongs to
  'POOL_PLAYER_ADD', // id; { email | phone | name, position, cricketRole, tierId }
  'POOL_PLAYER_UPDATE', // id, poolPlayerId; { name, position, cricketRole, tierId + setTier, withdrawn }
  'POOL_PLAYER_REMOVE', // id, poolPlayerId
  'POOL_MOVE', // id; { playerIds, tierId }
  'POOL_TIERS_SAVE', // id; { tiers } — the whole set, top first
  'POOL_REGISTRATION', // id; { open }
  'POOL_JOIN_PREVIEW', // { code } — a 7-character pool code
  'POOL_JOIN', // { code }
  'AUCTION_GET', // id — the whole state as the caller sees it
  'AUCTION_SETTINGS', // id; the rules (only the clock while paused)
  'AUCTION_BIDDER_SET', // id; { teamId, playerId | contact | none }
  'AUCTION_START',
  'AUCTION_NEXT', // id; { lotId? }
  'AUCTION_BID', // id; { teamId, amount } — a bidder, or the auctioneer for the room
  'AUCTION_SELL',
  'AUCTION_UNSOLD',
  'AUCTION_UNDO_BID',
  'AUCTION_UNDO_SALE', // id; { lotId }
  'AUCTION_PAUSE',
  'AUCTION_RESUME',
  'AUCTION_TAKE_OVER',
  'AUCTION_ROUND_START', // id; { prices: [{ tierId, price }] }
  'AUCTION_FINISH',
  'AUCTION_ASSIGN', // id; { poolPlayerId, teamId, price }
  'AUCTION_CONFIRM',
  'AUCTION_CANCEL',
  'AUCTION_MOVE', // id; { lotId, teamId, price? } — a bought player to another team (finished, before confirming)
  'AUCTION_SWAP', // id; { lotId, otherLotId } — two bought players change teams, keeping their prices
  'AUCTION_FILL_PREVIEW', // id — what "Fill the gaps by draw" will do (counts per team)
  'AUCTION_FILL', // id — deal the unsold players to the teams short of the minimum
  'POOL_METHOD_SET', // id; { method: Draw | Auction } — until either way starts
  'DRAW_GET', // id — the team draw as the caller sees it
  'DRAW_SETTINGS', // id; { kind?, setPace, autoSeconds? }
  'DRAW_START', // the live draw; the caller draws
  'DRAW_NEXT', // the next name (lands a few seconds later)
  'DRAW_REST', // id; { all } — the rest of this tier, or everyone left, at once
  'DRAW_QUICK', // the whole draw at once ("Shuffle again" once drawn)
  'DRAW_RESTART', // everyone back in the pool
  'DRAW_TAKE_OVER',
  'DRAW_MOVE', // id; { poolPlayerId, teamId }
  'DRAW_SWAP', // id; { poolPlayerId, otherPoolPlayerId }
  'DRAW_CONFIRM', // every name drawn becomes a squad place
  // Leagues and seasons (2026-11-24). A season starts with TOURNAMENT_CREATE { leagueId }.
  'LEAGUE_LIST', // ?sport — the leagues the caller runs
  'LEAGUE_CANDIDATES', // ?sport — the caller's tournaments that could become earlier seasons
  'LEAGUE_CREATE', // { name, shortName, sport, area, tournamentIds }
  'LEAGUE_GET', // leagueId — anyone signed in
  'LEAGUE_UPDATE', // leagueId; { name, shortName, area }
  'LEAGUE_DELETE', // leagueId — its tournaments stay
  'LEAGUE_LOGO_SET', // leagueId; { image }
  'LEAGUE_LOGO_REMOVE',
  'LEAGUE_ORGANISER_ADD', // leagueId; { contact }
  'LEAGUE_ORGANISER_REMOVE', // leagueId, userId
  'LEAGUE_SEASON_ADD', // leagueId; { tournamentId }
  'LEAGUE_SEASON_REMOVE', // leagueId, tournamentId
  'LEAGUE_STATS', // leagueId; ?season
  'LEAGUE_TEAMS', // leagueId — titles and every team's record
  'LEAGUE_BRING_BACK_OPTIONS', // id — a season's "Bring back teams"
  'LEAGUE_BRING_BACK', // id; { teamIds }
] as const;

export type ServiceRequestId = (typeof SERVICES)[number];
