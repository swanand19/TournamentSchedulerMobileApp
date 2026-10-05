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
  'AUTH_OTP_SEND',
  'AUTH_OTP_VERIFY',
  'AUTH_LOGOUT',
  'AUTH_LOGOUT_ALL',
  'ACCOUNT_GET',
  'ACCOUNT_UPDATE',
  'ACCOUNT_DELETE_PREVIEW', // emails the code that confirms it
  'ACCOUNT_DELETE',

  // Tournaments
  'TOURNAMENT_LIST', // query: sport
  'TOURNAMENT_CREATE',
  'TOURNAMENT_GET', // id
  'TOURNAMENT_DELETE', // id
  'TOURNAMENT_START', // id
  'TOURNAMENT_MATCHES', // id
  'TOURNAMENT_STATS', // id
  'TOURNAMENT_CRICKET_STATS', // id
  'TOURNAMENT_UPDATE', // id
  'TOURNAMENT_COMPLETE', // id

  // Owners and scorers
  'TOURNAMENT_MEMBER_LIST', // id
  'TOURNAMENT_MEMBER_ADD', // id
  'TOURNAMENT_MEMBER_REMOVE', // id, userId
  'TOURNAMENT_LEAVE', // id

  // Who is scoring a match — sport ('football' | 'cricket'), matchId
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
  'PLAYER_CREATE', // id, teamId
  'PLAYER_UPDATE', // id, teamId, playerId
  'PLAYER_DELETE', // id, teamId, playerId
  'PLAYER_UNLINK', // id, teamId, playerId — an owner, or the player themselves
  'TEAM_JOIN_CODE_RESET', // id, teamId

  // Joining a team with its code (the person isn't in the tournament yet)
  'TEAM_JOIN_PREVIEW',
  'TEAM_JOIN',

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
  'CRICKET_INNINGS_END',
  'CRICKET_REDUCE_OVERS',
  'CRICKET_FOLLOW_ON',
  'CRICKET_SUPER_OVER_START',
  'CRICKET_COMPLETE',
  'CRICKET_SCORECARD',
  'CRICKET_AWARDS',
] as const;

export type ServiceRequestId = (typeof SERVICES)[number];
