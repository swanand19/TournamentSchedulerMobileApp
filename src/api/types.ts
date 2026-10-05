// The shapes the API answers with, as the app reads them. JSON is camelCase and enums travel as
// their names (JsonStringEnumConverter in Program.cs). The source of truth is the C# in
// TournamentScheduler.Api/Models — when a field changes there, change it here.

import type { Sport } from '@/theme/theme';

// ---------------------------------------------------------------------------------------------
// Accounts (Models/Accounts/AccountDtos.cs)

export type Account = {
  userId: number;
  name: string;
  email: string | null;
  roleId: number;
  roleName: string | null;
  memberSince: string;
  /** Their own cricket profile, copied to every cricket team place linked to them. */
  cricket: CricketProfile | null;
  /** Admin accounts are removed by another admin, not from the app. */
  canDelete: boolean;
};

export type SendOtpResponse = { email: string; expiresInSeconds: number; resendAfterSeconds: number };

/** "NeedsName": the code is right but the email is new — send the same code again with a name. */
export type VerifyOtpResponse = {
  outcome: 'SignedIn' | 'NeedsName';
  isNewUser: boolean;
  sessionToken: string | null;
  sessionId: string | null;
  expiresAt: string | null;
  user: Account | null;
};

export type LogoutAllResponse = { signedOutDevices: number };

// ---------------------------------------------------------------------------------------------
// Tournaments, teams, players

export type TournamentStatus = 'Upcoming' | 'Live' | 'Completed' | 'Cancelled';

/** What the signed-in person is in a tournament: "creator", "owner", "scorer", "player". */
export type TournamentRole = 'creator' | 'owner' | 'scorer' | 'player';

export type TournamentListItem = {
  id: number;
  name: string;
  sport: Sport;
  createdAt: string;
  isStarted: boolean;
  status: TournamentStatus;
  /** "YYYY-MM-DD"; null on tournaments from before dates existed. */
  startDate: string | null;
  endDate: string | null;
  hasSchedule: boolean;
  latestScheduleId: number | null;
  myRoles: TournamentRole[];
};

/** What the signed-in person may do in this tournament (Models/Accounts/TournamentAccessModels.cs). */
export type TournamentAccess = {
  myRoles: TournamentRole[];
  /** Their own squad place here, when they play in it. */
  myPlayerId: number | null;
  myTeamId: number | null;
  canEdit: boolean;
  canScore: boolean;
  canManageMembers: boolean;
  canDelete: boolean;
  canLeave: boolean;
  canComplete: boolean;
  /** Live and every match is over: ask once "All matches played. Mark the tournament complete?" */
  allMatchesPlayed: boolean;
};

export type Tournament = {
  id: number;
  name: string;
  sport: Sport;
  createdAt: string;
  isStarted: boolean;
  startedAt: string | null;
  status: TournamentStatus;
  startDate: string | null;
  endDate: string | null;
  access: TournamentAccess | null;
};

export type TournamentMember = {
  userId: number;
  name: string;
  /** Only owners see emails. */
  email: string | null;
  role: 'Creator' | 'Owner' | 'Scorer';
  isCreator: boolean;
  isMe: boolean;
  canRemove: boolean;
};

export type Person = { userId: number; name: string };

/** Who is scoring a match and what the caller may do about it — on every match answer as `scoring`. */
export type Scoring = {
  activeScorer: Person | null;
  isActiveScorer: boolean;
  canScore: boolean;
  canRequestScoring: boolean;
  canTakeOverScoring: boolean;
  pendingRequest: { by: Person; requestedAt: string; expiresAt: string } | null;
  canRespondToRequest: boolean;
};

export type CricketRole = 'Batter' | 'Bowler' | 'AllRounder' | 'WicketKeeper' | 'WicketKeeperBatter';
export type BattingStyle = 'RightHand' | 'LeftHand';
export type BowlingArm = 'Right' | 'Left';
export type BowlingType = 'Fast' | 'FastMedium' | 'MediumFast' | 'Medium' | 'FingerSpin' | 'WristSpin';

export type CricketProfile = {
  primaryRole: CricketRole;
  battingStyle: BattingStyle | null;
  bowlingArm: BowlingArm | null;
  bowlingType: BowlingType | null;
  battingOrderPreference: number | null;
  bowlingStyleLabel?: string | null;
  roleLabel?: string;
};

/** A squad place. Once linked to an account it shows that person's name and cricket profile. */
export type Player = {
  id: number;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  teamId: number;
  isLinked: boolean;
  /** The signed-in person's own place. */
  isMe: boolean;
  /** Owners only: the email that links (or will link) it to an account. */
  email: string | null;
  cricket: CricketProfile | null;
};

export type Team = {
  id: number;
  name: string;
  tournamentId: number;
  defaultCaptainPlayerId: number | null;
  /** Owners only: what players type under "Join a team". */
  joinCode: string | null;
  players: Player[];
};

// Joining a team with its code (Models/Accounts/PlayerAccountModels.cs)

export type JoinPlace = { playerId: number; name: string; detail: string | null };

export type JoinTeamPreview = {
  tournamentId: number;
  tournamentName: string;
  sport: Sport;
  teamId: number;
  teamName: string;
  /** "Are you one of these?" — names nobody has claimed yet. */
  places: JoinPlace[];
};

export type JoinTeamResult = {
  tournamentId: number;
  tournamentName: string;
  sport: Sport;
  teamId: number;
  teamName: string;
  playerId: number;
};

export type AccountDeletionPreview = {
  codeSentTo: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  tournamentsDeleted: { id: number; name: string; sport: Sport; otherPeople: number }[];
  tournamentsHandedOver: { id: number; name: string; newCreator: string }[];
  tournamentsLeft: number;
  squadPlaces: number;
};

// ---------------------------------------------------------------------------------------------
// Groups and schedule

export type GroupInput = { name: string; teams: string[] };

export type Fixture = { id: number; home: string; away: string; round: number };

export type GroupSchedule = {
  groupName: string;
  fixtures: Fixture[];
  roundsUsed: number;
  maxPossibleMatchesPerTeam: number;
  teamCount: number;
  requestedMatchesPerTeam: number;
  minMatchesPerTeam: number;
  maxMatchesPerTeam: number;
  fullRoundRobinLegs: number;
  extraMatchesPerTeam: number;
  maxMeetingsBetweenAnyPair: number;
  repeatFixturesAllowed: boolean;
  warnings: string[];
  matchesByTeam: Record<string, number>;
};

export type TournamentSchedule = { groups: GroupSchedule[]; totalMatches: number; warnings: string[] };

export type SavedFixture = {
  id: number;
  matchNumber: number;
  round: number;
  home: string;
  away: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

export type SavedSchedule = {
  id: number;
  createdAt: string;
  matchesPerTeam: number;
  totalMatches: number;
  isActive: boolean;
  groups: { id: number; groupName: string; fixtures: SavedFixture[] }[];
};

export type ScheduleHistoryItem = {
  id: number;
  createdAt: string;
  isActive: boolean;
  matchesPerTeam: number;
  totalMatches: number;
  groups: { groupName: string; fixtures: { id: number; matchNumber: number; home: string; away: string }[] }[];
};

// ---------------------------------------------------------------------------------------------
// Match list (one card shape per sport, from GET tournaments/{id}/matches)

export type FootballMatchStatus = 'NotStarted' | 'InProgress' | 'Paused' | 'Completed' | 'PenaltyShootout';
export type PeriodState = 'NotStarted' | 'InPlay' | 'Stopped' | 'Ended';

export type FootballMatchCard = {
  id: number;
  sport: 'Football';
  groupName: string;
  matchNumber: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  status: FootballMatchStatus;
  periodState: PeriodState;
  currentHalf: number;
  homeScore: number;
  awayScore: number;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
  penaltyWinnerTeamId: number | null;
  forfeitWinnerTeamId: number | null;
};

export type CricketMatchStatus = 'NotStarted' | 'InProgress' | 'InningsBreak' | 'SuperOver' | 'Completed' | 'Abandoned';

export type CricketMatchCard = {
  id: number;
  sport: 'Cricket';
  groupName: string;
  matchNumber: number;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  status: CricketMatchStatus;
  winnerTeamId: number | null;
  resultSummary: string | null;
  isTie: boolean;
  isDraw: boolean;
  isNoResult: boolean;
  homeLine: string | null;
  awayLine: string | null;
};

export type MatchCard = FootballMatchCard | CricketMatchCard;

// ---------------------------------------------------------------------------------------------
// Football match

export type SquadStatus = 'Starting' | 'Bench' | 'Unavailable' | 'SubstitutedOff' | 'SentOff';

export type MatchPlayer = {
  id: number;
  playerId: number;
  teamId: number;
  squadStatus: SquadStatus;
  startedMatch: boolean;
};

/** GET matches/{id}: the stored match plus the flow flags the server derives. */
export type FootballMatch = {
  id: number;
  scoring: Scoring | null;
  tournamentId: number;
  groupName: string;
  matchNumber: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeTeamName: string;
  awayTeamName: string;
  status: FootballMatchStatus;
  periodState: PeriodState;
  maxPlayersPerSide: number | null;
  minPlayersPerSide: number | null;
  minutesPerHalf: number | null;
  extraTimeAllowed: boolean;
  drawAllowed: boolean;
  maxSubstitutions: number | null;
  rollingSubsAllowed: boolean;
  currentHalf: number;
  isClockRunning: boolean;
  homeScore: number;
  awayScore: number;
  pausedDurationMs: number;
  pausedAt: string | null;
  extraMinutesAddedThisHalf: number;
  halfStartedAt: string | null;
  extraTimeMinutesPerHalf: number | null;
  isPenaltyShootout: boolean;
  penaltyTakersPerSide: number | null;
  penaltyWinnerTeamId: number | null;
  finalWhistleMinute: number | null;
  penaltyHomeScore: number | null;
  penaltyAwayScore: number | null;
  forfeitWinnerTeamId: number | null;
  matchPlayers: MatchPlayer[];

  // Derived on the server ([NotMapped] in MatchModels.cs). Buttons read these; never re-derive.
  scoresLevel: boolean;
  extraTimeApplicable: boolean;
  maxPeriods: number;
  isFinalPeriod: boolean;
  currentPeriodMinutes: number;
  priorPeriodsMinutes: number;
  maxStoppageThisPeriod: number;
  stoppageRemainingThisPeriod: number;
  isLiveOrPaused: boolean;
  canEndPeriod: boolean;
  canStartNextPeriod: boolean;
  currentPeriodLabel: string;
  nextPeriodLabel: string | null;
  awaitingResolution: boolean;
  canStartPenalties: boolean;
  penaltiesRequired: boolean;
  canCompleteNormally: boolean;
};

export type MatchEventType =
  | 'Goal'
  | 'YellowCard'
  | 'RedCard'
  | 'SubstitutionIn'
  | 'SubstitutionOut'
  | 'HalfStart'
  | 'HalfEnd'
  | 'ExtraTimeStart'
  | 'ExtraTimeAdded'
  | 'ClockPaused'
  | 'ClockResumed'
  | 'MatchCompleted'
  | 'PenaltyShootoutStarted'
  | 'PenaltyKick'
  | 'MatchAbandoned';

export type MatchEvent = {
  id: number;
  eventType: MatchEventType;
  minuteOfMatch: number;
  stoppageMinute: number | null;
  teamId: number | null;
  playerId: number | null;
  relatedPlayerId: number | null;
  penaltyScored: boolean | null;
  penaltyHomeScoreAfter: number | null;
  penaltyAwayScoreAfter: number | null;
  createdAt: string;
};

export type RecordEventResponse = {
  eventId: number | null;
  homeScore: number;
  awayScore: number;
  matchAbandoned?: boolean;
};

export type ShootoutOutcome = 'InProgress' | 'HomeWins' | 'AwayWins';

export type PenaltyState = {
  kicks: { id: number; teamId: number; playerId: number | null; roundNumber: number; isSuddenDeath: boolean; scored: boolean }[];
  penaltyTakersPerSide: number | null;
  penaltyWinnerTeamId: number | null;
  outcome: ShootoutOutcome;
  homeScore: number;
  awayScore: number;
  nextTeamId: number | null;
  homeAvailableTakerIds: number[];
  awayAvailableTakerIds: number[];
};

// ---------------------------------------------------------------------------------------------
// Cricket match

export type CricketFormat = 'LimitedOvers' | 'MultiInningsLimitedOvers' | 'MultiInningsTimed';
export type TieResolution = 'AllowTie' | 'SuperOver' | 'Bowlout' | 'BoundaryCount';
export type BallType = 'Leather' | 'Tennis' | 'Tape' | 'Other';
export type PitchType = 'Turf' | 'Matting' | 'Astroturf' | 'Concrete' | 'Other';
export type CricketSquadStatus = 'Playing' | 'Bench' | 'Unavailable';

export type CricketRules = {
  format: CricketFormat;
  inningsPerSide: number;
  oversPerInnings: number | null;
  ballsPerOver: number;
  maxOversPerBowler: number | null;
  playersPerSide: number;
  lastManStanding: boolean;
  widePenaltyRuns: number;
  noBallPenaltyRuns: number;
  freeHitAfterNoBall: boolean;
  freeHitAfterWide: boolean;
  byesAllowed: boolean;
  legByesAllowed: boolean;
  penaltyRunsAllowed: boolean;
  overthrowsAllowed: boolean;
  lbwEnabled: boolean;
  powerplayOvers: string | null;
  tieResolution: TieResolution;
  drawAllowed: boolean;
  followOnMargin: number | null;
  dlsEnabled: boolean;
  ballType: BallType;
  pitchType: PitchType;
};

export type CricketSetupOptions = {
  id: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  presets: { name: string; rules: CricketRules }[];
  lastFormat: { matchNumber: number; rules: CricketRules } | null;
  teams: {
    id: number;
    name: string;
    defaultCaptainPlayerId: number | null;
    players: {
      id: number;
      name: string;
      jerseyNumber: number | null;
      cricket: {
        role: CricketRole;
        roleLabel: string;
        battingStyle: BattingStyle | null;
        bowlingStyleLabel: string | null;
        battingOrderPreference: number | null;
      } | null;
    }[];
    lastSquad: {
      matchId: number;
      matchNumber: number;
      opponent: string;
      players: { playerId: number; playing: boolean; isCaptain: boolean; isWicketKeeper: boolean; battingOrder: number | null }[];
    } | null;
  }[];
};

export type CricketSquadSelection = {
  playerId: number;
  teamId: number;
  squadStatus: CricketSquadStatus;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  battingOrder: number | null;
};

export type CricketSquadMember = {
  playerId: number;
  teamId: number;
  playerName: string;
  squadStatus: CricketSquadStatus;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  battingOrder: number | null;
};

export type InningsSummary = {
  id: number;
  inningsNumber: number;
  battingTeamId: number;
  battingTeamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  overs: string;
  oversLimit: number | null;
  target: number | null;
  status: string;
  endReason: string | null;
  isSuperOver: boolean;
  isFollowOn: boolean;
  scoreLine: string;
  runRate: number;
};

export type CreaseBatter = {
  playerId: number;
  playerName: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  onStrike: boolean;
};

export type CreaseBowler = {
  playerId: number;
  playerName: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
};

export type BallSummary = {
  sequenceNumber: number;
  overNumber: number;
  display: string;
  runs: number;
  isWicket: boolean;
  isBoundary: boolean;
  isExtra: boolean;
  isFreeHit: boolean;
};

export type InningsLiveState = {
  id: number;
  inningsNumber: number;
  battingTeamId: number;
  bowlingTeamId: number;
  battingTeamName: string;
  runs: number;
  wickets: number;
  overs: string;
  oversLimit: number | null;
  scoreLine: string;
  runRate: number;
  target: number | null;
  runsRequired: number | null;
  ballsRemaining: number | null;
  requiredRunRate: number | null;
  extrasTotal: number;
  freeHitPending: boolean;
  striker: CreaseBatter | null;
  nonStriker: CreaseBatter | null;
  bowler: CreaseBowler | null;
  previousBowlerId: number | null;
  thisOver: BallSummary[];
  partnershipRuns: number;
  partnershipBalls: number;
};

export type CricketDlsState = {
  edition: string;
  team1Score: number;
  team1Resources: number;
  team2Resources: number | null;
  target: number | null;
  targetRevised: boolean;
  team2ResourcesUsed: number | null;
  team2ResourcesRemaining: number | null;
  parScore: number | null;
  runsAheadOfPar: number | null;
  minimumOversForResult: number;
  resultPossibleNow: boolean;
  interruptions: { inningsNumber: number; battingTeamName: string; atOvers: string; oversBefore: number; oversAfter: number }[];
};

export type CricketActions = {
  canSetUp: boolean;
  canStartInnings: boolean;
  canRecordBall: boolean;
  canUndo: boolean;
  needsBatter: boolean;
  needsBowler: boolean;
  canDeclare: boolean;
  canEndInnings: boolean;
  canEnforceFollowOn: boolean;
  canStartSuperOver: boolean;
  canComplete: boolean;
  canReduceOvers: boolean;
  nextBattingTeamId: number | null;
  nextBowlingTeamId: number | null;
  availableBatters: CricketSquadMember[];
  availableBowlers: CricketSquadMember[];
  possibleDismissals: string[];
};

export type CricketMatchState = {
  id: number;
  scoring: Scoring | null;
  tournamentId: number;
  groupName: string;
  matchNumber: number;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeTeamName: string;
  awayTeamName: string;
  status: CricketMatchStatus;
  rules: CricketRules;
  tossWinnerTeamId: number | null;
  tossDecision: string | null;
  teamBattingFirstId: number | null;
  tossSummary: string | null;
  isSetUp: boolean;
  maxInnings: number;
  currentInningsNumber: number;
  followOnEnforced: boolean;
  winnerTeamId: number | null;
  isTie: boolean;
  isDraw: boolean;
  isNoResult: boolean;
  resultSummary: string | null;
  squad: CricketSquadMember[];
  innings: InningsSummary[];
  current: InningsLiveState | null;
  dls: CricketDlsState | null;
  actions: CricketActions;
};

export type RecordBallRequest = {
  runsOffBat: number;
  isWide: boolean;
  isNoBall: boolean;
  wideExtraRuns: number;
  byes: number;
  legByes: number;
  penaltyRuns: number;
  wicketType?: string | null;
  dismissedPlayerId?: number | null;
  fielderId?: number | null;
  isDirectHit?: boolean;
  runOutReceiverId?: number | null;
  battersCrossed?: boolean;
};

export type BattingCardRow = {
  playerId: number;
  playerName: string;
  position: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalText: string;
  isStriker: boolean;
  isNonStriker: boolean;
  hasBatted: boolean;
};

export type BowlingCardRow = {
  playerId: number;
  playerName: string;
  legalBalls: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  economy: number;
};

export type InningsCard = {
  inningsId: number;
  inningsNumber: number;
  battingTeamName: string;
  bowlingTeamName: string;
  battingTeamId: number;
  status: string;
  endReason: string | null;
  isSuperOver: boolean;
  isFollowOn: boolean;
  runs: number;
  wickets: number;
  overs: string;
  oversLimit: number | null;
  runRate: number;
  target: number | null;
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penaltyRuns: number;
  extrasTotal: number;
  batting: BattingCardRow[];
  bowling: BowlingCardRow[];
  fallOfWickets: { wicketNumber: number; runs: number; overs: string; playerId: number; playerName: string }[];
  partnershipRuns: number;
  partnershipBalls: number;
};

export type CricketAward = {
  playerId: number;
  playerName: string;
  teamId: number;
  teamName: string;
  /** The points it was decided on: the total for player of the match, else that discipline's. */
  points: number;
  summary: string;
};

/** All null until the match is completed; bestFielder stays null if nobody took a dismissal. */
export type CricketMatchAwards = {
  matchId: number;
  playerOfMatch: CricketAward | null;
  bestBatter: CricketAward | null;
  bestBowler: CricketAward | null;
  bestFielder: CricketAward | null;
};

export type CricketScorecard = {
  matchId: number;
  homeTeamName: string;
  awayTeamName: string;
  status: string;
  tossSummary: string | null;
  resultSummary: string | null;
  innings: InningsCard[];
};

// ---------------------------------------------------------------------------------------------
// Stats

export type PlayerStatRow = {
  playerId: number;
  playerName: string;
  jerseyNumber: number | null;
  position: string | null;
  teamId: number;
  teamName: string;
  value: number;
  appearances: number;
  minutesPlayed: number;
  perMatch: number | null;
  detail: Record<string, number>;
  rank: number;
};

export type StatBoard = {
  key: string;
  title: string;
  valueLabel: string;
  note: string | null;
  detailColumns: string[];
  showPerMatch: boolean;
  rows: PlayerStatRow[];
};

export type TeamStandingRow = {
  teamId: number;
  teamName: string;
  groupName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  shootoutsWon: number;
  shootoutsLost: number;
  rank: number;
};

export type FootballStats = {
  tournamentId: number;
  tournamentName: string;
  basis: string;
  summary: {
    totalMatches: number;
    matchesCompleted: number;
    matchesInProgress: number;
    matchesNotStarted: number;
    totalGoals: number;
    goalsPerMatch: number;
    totalAssists: number;
    totalYellowCards: number;
    totalRedCards: number;
    totalSubstitutions: number;
    cleanSheets: number;
    matchesDrawn: number;
    shootoutsPlayed: number;
    matchesAbandoned: number;
    playersUsed: number;
    teamsInvolved: number;
    highestScoringMatch: string | null;
    biggestWin: string | null;
  };
  playerBoards: StatBoard[];
  standings: TeamStandingRow[];
  notes: string[];
};

export type CricketStandingRow = {
  rank: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  drawn: number;
  noResult: number;
  points: number;
  netRunRate: number;
  runsFor: number;
  oversFor: string;
  runsAgainst: number;
  oversAgainst: string;
  form: string[];
};

export type CricketBoard = {
  key: string;
  title: string;
  valueLabel: string;
  qualification: string | null;
  columns: string[];
  rows: {
    rank: number;
    playerId: number;
    playerName: string;
    teamId: number;
    teamName: string;
    value: string;
    detail: Record<string, string>;
    note: string | null;
  }[];
};

export type CricketTeamRecord = { teamName: string; value: string; detail: string };

export type CricketStats = {
  tournamentId: number;
  tournamentName: string;
  basis: string;
  summary: {
    totalMatches: number;
    matchesCompleted: number;
    matchesInProgress: number;
    totalRuns: number;
    totalWickets: number;
    fours: number;
    sixes: number;
    fifties: number;
    hundreds: number;
    extras: number;
    highestTeamTotal: string | null;
    highestScore: string | null;
    bestBowling: string | null;
    topRunScorer: string | null;
    topWicketTaker: string | null;
    mvp: string | null;
  };
  pointsTable: { groupName: string; rows: CricketStandingRow[] }[];
  battingBoards: CricketBoard[];
  bowlingBoards: CricketBoard[];
  fieldingBoards: CricketBoard[];
  mvp: CricketBoard;
  playersOfMatch: {
    matchId: number;
    matchNumber: number;
    fixture: string;
    playerId: number;
    playerName: string;
    teamName: string;
    points: number;
    summary: string;
  }[];
  pointsSystem: { category: string; item: string; points: number }[];
  records: {
    highestTotals: CricketTeamRecord[];
    lowestTotals: CricketTeamRecord[];
    biggestWins: CricketTeamRecord[];
    highestPartnerships: CricketTeamRecord[];
  };
  notes: string[];
};
