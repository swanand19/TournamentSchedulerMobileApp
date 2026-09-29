// Every API the app calls, by service ID.
//
// Screens name the service ("TOURNAMENT_LIST"), never a URL. Today the client turns the ID into
// the REST route below; once the encrypted gateway exists, the same IDs go into the envelope and
// this table is no longer needed on the client — so no screen changes when encryption arrives.
// IDs match the design doc: AREA_ACTION, in capitals.

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const ROUTES = {
  HEALTH_CHECK: { method: 'GET', path: 'health' },

  // Tournaments
  TOURNAMENT_LIST: { method: 'GET', path: 'tournaments' },
  TOURNAMENT_CREATE: { method: 'POST', path: 'tournaments' },
  TOURNAMENT_GET: { method: 'GET', path: 'tournaments/{id}' },
  TOURNAMENT_DELETE: { method: 'DELETE', path: 'tournaments/{id}' },
  TOURNAMENT_START: { method: 'POST', path: 'tournaments/{id}/start' },
  TOURNAMENT_MATCHES: { method: 'GET', path: 'tournaments/{id}/matches' },
  TOURNAMENT_STATS: { method: 'GET', path: 'tournaments/{id}/stats' },
  TOURNAMENT_CRICKET_STATS: { method: 'GET', path: 'tournaments/{id}/cricket-stats' },

  // Groups and schedule
  SCHEDULE_ACTIVE: { method: 'GET', path: 'tournaments/{id}/schedule' },
  SCHEDULE_HISTORY: { method: 'GET', path: 'tournaments/{id}/schedules' },
  SCHEDULE_ACTIVATE: { method: 'POST', path: 'tournaments/{id}/schedules/{scheduleId}/activate' },
  TOURNAMENT_GROUPS_RANDOMIZE: { method: 'POST', path: 'tournament/groups/randomize' },
  TOURNAMENT_GROUPS_MANUAL: { method: 'POST', path: 'tournament/groups/manual' },
  TOURNAMENT_SCHEDULE_GENERATE: { method: 'POST', path: 'tournament/schedule' },
  TOURNAMENT_SCHEDULE_APPROVE: { method: 'POST', path: 'tournament/schedule/approve' },

  // Teams and players
  TEAM_LIST: { method: 'GET', path: 'tournaments/{id}/teams' },
  TEAM_GET: { method: 'GET', path: 'tournaments/{id}/teams/{teamId}' },
  TEAM_CREATE: { method: 'POST', path: 'tournaments/{id}/teams' },
  TEAM_UPDATE: { method: 'PUT', path: 'tournaments/{id}/teams/{teamId}' },
  TEAM_DELETE: { method: 'DELETE', path: 'tournaments/{id}/teams/{teamId}' },
  PLAYER_CREATE: { method: 'POST', path: 'tournaments/{id}/teams/{teamId}/players' },
  PLAYER_UPDATE: { method: 'PUT', path: 'tournaments/{id}/teams/{teamId}/players/{playerId}' },
  PLAYER_DELETE: { method: 'DELETE', path: 'tournaments/{id}/teams/{teamId}/players/{playerId}' },

  // Football matches
  MATCH_GET: { method: 'GET', path: 'matches/{matchId}' },
  MATCH_SETUP: { method: 'POST', path: 'matches/{matchId}/setup' },
  MATCH_EVENT_RECORD: { method: 'POST', path: 'matches/{matchId}/events' },
  MATCH_EVENTS: { method: 'GET', path: 'matches/{matchId}/events' },
  MATCH_CLOCK_PAUSE: { method: 'POST', path: 'matches/{matchId}/clock/pause' },
  MATCH_CLOCK_RESUME: { method: 'POST', path: 'matches/{matchId}/clock/resume' },
  MATCH_CLOCK_ADD_TIME: { method: 'POST', path: 'matches/{matchId}/clock/add-time' },
  MATCH_PERIOD_END: { method: 'POST', path: 'matches/{matchId}/half/end' },
  MATCH_PERIOD_NEXT: { method: 'POST', path: 'matches/{matchId}/half/next' },
  MATCH_COMPLETE: { method: 'POST', path: 'matches/{matchId}/complete' },
  MATCH_PENALTIES_START: { method: 'POST', path: 'matches/{matchId}/penalties/start' },
  MATCH_PENALTIES_GET: { method: 'GET', path: 'matches/{matchId}/penalties' },
  MATCH_PENALTY_KICK: { method: 'POST', path: 'matches/{matchId}/penalties/kick' },
  MATCH_PENALTIES_END: { method: 'POST', path: 'matches/{matchId}/penalties/end' },

  // Cricket matches — every one of these answers with the whole match state.
  CRICKET_MATCH_GET: { method: 'GET', path: 'cricket-matches/{matchId}' },
  CRICKET_SETUP_OPTIONS: { method: 'GET', path: 'cricket-matches/{matchId}/setup-options' },
  CRICKET_SETUP: { method: 'POST', path: 'cricket-matches/{matchId}/setup' },
  CRICKET_INNINGS_START: { method: 'POST', path: 'cricket-matches/{matchId}/innings/start' },
  CRICKET_BALL_RECORD: { method: 'POST', path: 'cricket-matches/{matchId}/balls' },
  CRICKET_BALL_UNDO: { method: 'POST', path: 'cricket-matches/{matchId}/balls/undo' },
  CRICKET_BATTER_SET: { method: 'POST', path: 'cricket-matches/{matchId}/batter' },
  CRICKET_BOWLER_SET: { method: 'POST', path: 'cricket-matches/{matchId}/bowler' },
  CRICKET_INNINGS_END: { method: 'POST', path: 'cricket-matches/{matchId}/innings/end' },
  CRICKET_REDUCE_OVERS: { method: 'POST', path: 'cricket-matches/{matchId}/innings/reduce-overs' },
  CRICKET_FOLLOW_ON: { method: 'POST', path: 'cricket-matches/{matchId}/follow-on' },
  CRICKET_SUPER_OVER_START: { method: 'POST', path: 'cricket-matches/{matchId}/super-over/start' },
  CRICKET_COMPLETE: { method: 'POST', path: 'cricket-matches/{matchId}/complete' },
  CRICKET_SCORECARD: { method: 'GET', path: 'cricket-matches/{matchId}/scorecard' },
  CRICKET_AWARDS: { method: 'GET', path: 'cricket-matches/{matchId}/awards' },
} as const satisfies Record<string, { method: HttpMethod; path: string }>;

export type ServiceRequestId = keyof typeof ROUTES;
