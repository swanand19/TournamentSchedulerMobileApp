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
  /** E.164, e.g. "+919876543210". An account has an email, a number or both. */
  phone: string | null;
  roleId: number;
  roleName: string | null;
  memberSince: string;
  /** Their own cricket profile, copied to every cricket team place linked to them. */
  cricket: CricketProfile | null;
  /** Admin accounts are removed by another admin, not from the app. */
  canDelete: boolean;
  /** The server keeps one way to sign in, and an admin's email. */
  canRemoveEmail: boolean;
  canRemovePhone: boolean;
};

/** What the sign-in screen offers. Mobile numbers stay off until the server can send texts. */
/** Whether this app version is the latest, should update or must update (HLD P-25). */
export type ClientUpdate = {
  status: 'None' | 'Suggested' | 'Required';
  latestVersion: string | null;
  description: string | null;
  storeUrl: string | null;
  message: string | null;
};

export type AuthOptions = { phone: boolean; phoneVia?: 'WhatsApp' | 'Sms' | null; defaultCountryCode: string; clientUpdate?: ClientUpdate };

export type SendOtpResponse = {
  /** The email or number the code went to, as the server stores it. */
  sentTo: string;
  channel: 'Email' | 'Sms';
  email: string | null;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

/** "NeedsName": the code is right but the email or number is new — send the same code again with a name. */
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

/** What the signed-in person is in a tournament: "creator", "owner", "scorer", "player", "follower" (6E: follows it while it's public). */
export type TournamentRole = 'creator' | 'owner' | 'scorer' | 'player' | 'follower';

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
  /** They follow it (6E) — offer "Stop following". */
  isFollowing: boolean;
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
  /** The owners' switch (6E): anyone with the link may watch, no account needed. */
  isPublic: boolean;
  /** The public link while it is public: the code, and the whole address when the server knows the web app's. */
  share: PublicShare | null;
};

export type PublicShare = { code: string; url: string | null };

/** FOLLOW_ADD: the tournament just followed. */
export type FollowedTournament = { tournamentId: number; name: string; sport: Sport; isStarted: boolean };

/** FOLLOW_SEARCH: a public tournament found by name or code — enough to tell two of the same name apart. */
export type PublicSearchResult = {
  tournamentId: number;
  code: string;
  name: string;
  sport: Sport;
  status: TournamentStatus;
  startDate: string | null;
  endDate: string | null;
  teams: number;
  /** They follow it already. */
  isFollowing: boolean;
  /** They run, score or play in it — it's on their Home already. */
  isMine: boolean;
};

export type TournamentMember = {
  userId: number;
  name: string;
  /** Only owners see emails and numbers. */
  email: string | null;
  phone: string | null;
  role: 'Creator' | 'Owner' | 'Scorer';
  isCreator: boolean;
  isMe: boolean;
  canRemove: boolean;
};

/** Someone asked for by an email or number with no account yet; they get the role on signing up. */
export type TournamentInvite = {
  inviteId: number;
  /** The email or E.164 number it went to. */
  contact: string;
  channel: 'Email' | 'Sms';
  role: 'Owner' | 'Scorer';
  invitedBy: string;
  sentAt: string;
  expiresAt: string;
  /** It no longer gives the role; sending it again renews it. */
  isExpired: boolean;
};

/** People & settings: members, open invites (owners only), and what the last change did. */
export type TournamentPeople = { members: TournamentMember[]; invites: TournamentInvite[]; notice: string | null };

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
  /** Owners only: the mobile number that links (or will link) it, E.164. */
  phone: string | null;
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

/** PLAYER_CONTACT_LOOKUP: who an email or number belongs to, before adding them to a team. */
export type PlayerLookup = {
  /** Which PLAYER_CREATE field to send `contact` in. */
  kind: 'Email' | 'Phone';
  /** As stored: lower-case email, or E.164. */
  contact: string;
  /** For the screen: "+91 98765 43210", or the email. */
  display: string;
  /** An account uses it: the player can be added without a name. */
  found: boolean;
  name: string | null;
  /** The team they already play for in this tournament (they can't be in two). */
  playsFor: string | null;
  /** A place in this tournament already waiting on this email or number. */
  waitingIn: string | null;
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

export type MatchStage = 'Group' | 'Knockout';

export type FootballMatchCard = {
  id: number;
  sport: 'Football';
  groupName: string;
  /** "Knockout" for a knockout match (groupName is then empty); older servers send nothing. */
  stage?: MatchStage;
  /** "Semi-final 1"; null in a group. */
  roundLabel?: string | null;
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
  stage?: MatchStage;
  roundLabel?: string | null;
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
  /** A knockout match must have a winner: no draws (the setup doesn't offer one). */
  isKnockout?: boolean;
  roundLabel?: string | null;
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
  /** A knockout match: no "allow a tie", no draw — it must send a side through. */
  isKnockout?: boolean;
  roundLabel?: string | null;
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
  /** "No result" may be recorded — never in a knockout match (award it instead). Older servers: absent. */
  canRecordNoResult?: boolean;
  canReduceOvers: boolean;
  nextBattingTeamId: number | null;
  nextBowlingTeamId: number | null;
  availableBatters: CricketSquadMember[];
  availableBowlers: CricketSquadMember[];
  possibleDismissals: string[];
  /** Corrections: the batters at the crease may be swapped for anyone in the XI yet to bat (their whole stay
   *  moves); this over's bowler for anyone allowed to bowl it. Empty / null when nothing can be corrected. */
  replaceableBatters: CricketSquadMember[];
  batterReplacements: CricketSquadMember[];
  replaceableBowler: CricketSquadMember | null;
  bowlerReplacements: CricketSquadMember[];
};

export type CricketMatchState = {
  id: number;
  scoring: Scoring | null;
  tournamentId: number;
  groupName: string;
  isKnockout?: boolean;
  roundLabel?: string | null;
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
  /** The Final's winner, once it has one. */
  championTeamId?: number | null;
  championName?: string | null;
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
  championTeamId?: number | null;
  championName?: string | null;
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

// ---------------------------------------------------------------------------------------------
// Profiles and careers (Models/Profiles/ProfileModels.cs). Figures arrive formatted, with the
// server's wording; completed matches only.

/** One figure: "Runs" "312" "off 251 balls". */
export type ProfileStat = { key: string; label: string; value: string; sub: string | null };

export type SportCard = { sport: Sport; matches: number; tournaments: number; headline: ProfileStat[] };

export type Profile = {
  userId: number;
  name: string;
  isMe: boolean;
  memberSince: string;
  /** Your own profile only. */
  email: string | null;
  phone: string | null;
  tournamentsRun: number;
  sports: SportCard[];
};

export type StatGroup = { key: string; title: string; stats: ProfileStat[] };

export type CareerTeam = {
  teamId: number;
  teamName: string;
  tournamentId: number;
  tournamentName: string;
  tournamentStatus: TournamentStatus;
  matches: number;
  isCaptain: boolean;
  /** The viewer may open this tournament (they own, score or play in it). */
  canOpen: boolean;
};

export type CareerTournament = {
  tournamentId: number;
  name: string;
  status: TournamentStatus;
  startDate: string | null;
  endDate: string | null;
  teamId: number;
  teamName: string;
  matches: number;
  canOpen: boolean;
  highlights: ProfileStat[];
};

export type Honour = {
  kind: 'PlayerOfMatch' | 'TournamentMvp' | 'TopScorer' | 'MostAssists' | string;
  title: string;
  detail: string;
  tournamentId: number;
  tournamentName: string;
  matchId: number | null;
  context: string | null;
  date: string | null;
};

export type Career = {
  userId: number;
  name: string;
  isMe: boolean;
  sport: Sport;
  basis: string;
  matches: number;
  statGroups: StatGroup[];
  teams: CareerTeam[];
  tournaments: CareerTournament[];
  honourStats: ProfileStat[];
  honours: Honour[];
};

// --- The inbox (phase 6D) --------------------------------------------------

export type NotificationKind =
  | 'ScoringRequested'
  | 'ScoringAllowed'
  | 'ScoringDeclined'
  | 'ScoringTakenOver'
  | 'AddedToTournament'
  | 'InviteAccepted'
  | 'LinkedToTeam'
  | 'AllMatchesPlayed'
  | 'EndDateReminder';

/** One line in your inbox. The words come from the server; the ids say where tapping it goes. */
export type AppNotification = {
  notificationId: number;
  kind: NotificationKind;
  title: string;
  body: string;
  tournamentId: number | null;
  sport: 'Football' | 'Cricket' | null;
  matchId: number | null;
  createdAt: string;
  isRead: boolean;
};

/** A page of the inbox, newest first; ask again with `before` = the last id while `hasMore`. */
export type NotificationPage = { items: AppNotification[]; unreadCount: number; hasMore: boolean };

export type UnreadCount = { unreadCount: number };

// --- Watching a match (Round 2) ---------------------------------------------

/** Before the first ball or kick, under way, or over. */
export type WatchPhase = 'Preview' | 'Live' | 'Finished';

export type WatchMarkKind = 'Goal' | 'YellowCard' | 'RedCard' | 'SubbedOn' | 'SubbedOff';

export type WatchPlayer = {
  playerId: number;
  name: string;
  jerseyNumber: number | null;
  /** A football position or a cricket role. */
  role: string | null;
  isCaptain: boolean;
  isWicketKeeper: boolean;
  battingOrder: number | null;
  /** Football: goals, cards and substitutions, in match order. */
  marks: { kind: WatchMarkKind; minute: string }[];
};

export type WatchSide = {
  teamId: number | null;
  name: string;
  /** "Squad", "Playing XI" or "Starting line-up". */
  heading: string;
  players: WatchPlayer[];
  bench: WatchPlayer[];
};

/** The match as a watcher sees it: header lines and both sides. The score comes from the sport's own match answer. */
export type WatchMatch = {
  matchId: number;
  sport: 'Football' | 'Cricket';
  tournamentId: number;
  tournamentName: string;
  groupName: string;
  /** "Semi-final 1" for a knockout match, shown instead of the group. */
  roundLabel?: string | null;
  matchNumber: number;
  phase: WatchPhase;
  formatLine: string | null;
  tossLine: string | null;
  resultLine: string | null;
  home: WatchSide;
  away: WatchSide;
};

export type ActivityKind =
  | 'Dot'
  | 'Run'
  | 'Extra'
  | 'Four'
  | 'Six'
  | 'Wicket'
  | 'Milestone'
  | 'OverEnd'
  | 'Innings'
  | 'Toss'
  | 'Goal'
  | 'YellowCard'
  | 'SecondYellow'
  | 'RedCard'
  | 'Substitution'
  | 'Period'
  | 'Clock'
  | 'Penalty'
  | 'Result'
  | 'Note';

/** One line of match activity, worded by the server. `id` counts up through the match. */
export type ActivityItem = {
  id: number;
  kind: ActivityKind;
  /** "13.4" or "67'". */
  marker: string | null;
  /** The ball as a scorer writes it ("4", "W", "wd"), or the score after a goal ("2–1"). */
  chip: string | null;
  text: string;
  detail: string | null;
  teamId: number | null;
  inningsNumber: number | null;
};

/** Newest first; ask again with `before` = the last id while `hasMore`. */
export type ActivityPage = { items: ActivityItem[]; hasMore: boolean };

// ---------------------------------------------------------------------------------------------
// Knockouts (Models/Knockouts/KnockoutModels.cs, 2026-10-21)

export type KnockoutRound =
  | 'Eliminator' | 'Qualifier' | 'RoundOf16' | 'QuarterFinal' | 'SemiFinal' | 'ThirdPlace' | 'Final' | 'Other';

export type KnockoutSlotKind = 'Team' | 'GroupPlace' | 'WinnerOf' | 'LoserOf';

/** Where a side comes from: a team, a place in a group, or the winner / loser of an earlier knockout match (by its order). */
export type KnockoutSlot = {
  kind: KnockoutSlotKind;
  teamId: number | null;
  groupName: string | null;
  place: number | null;
  fromOrder: number | null;
};

export type KnockoutSide = {
  /** The team, once known. */
  teamId: number | null;
  teamName: string | null;
  /** "Group A winner", "Winner of Semi-final 1", or the team's name. */
  source: string;
  slot: KnockoutSlot;
  /** An owner put this team here by hand. */
  setByOwner: boolean;
};

export type KnockoutFixture = {
  id: number;
  order: number;
  round: KnockoutRound;
  label: string;
  home: KnockoutSide;
  away: KnockoutSide;
  /** The playable match, once the tournament has started. */
  matchId: number | null;
  matchNumber: number | null;
  status: string | null;
  resultLine: string | null;
  winnerTeamId: number | null;
  /** Hasn't started: its sides may change and it may be deleted. */
  canChange: boolean;
};

export type KnockoutStage = {
  fixtures: KnockoutFixture[];
  groups: { groupName: string; teams: number; finished: boolean }[];
  /** A knockout match has started: presets can no longer replace the stage. */
  started: boolean;
  championTeamId: number | null;
  championName: string | null;
};

export type KnockoutPreset = {
  id: string;
  name: string;
  description: string;
  offersThirdPlace: boolean;
  fixtures: { round: KnockoutRound; label: string; home: string; away: string }[];
};
