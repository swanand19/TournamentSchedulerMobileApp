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
  /** Their profile photo: a signed link that lasts a day or two (HLD P-26); load it with lib/pictures' pictureUri. */
  photoUrl: string | null;
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
export type TournamentRole = 'creator' | 'owner' | 'scorer' | 'player' | 'follower' | 'auction' | 'teamAdmin';

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
  /** The tournament's logo (signed link, HLD P-26), or null. */
  logoUrl: string | null;
  myRoles: TournamentRole[];
  /** "Season 3" of a league (2026-11-24); null for a one-off. */
  league: LeagueBadge | null;
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
  /** The teams they run here as a team admin (owners change every squad through canEdit). */
  managedTeamIds: number[];
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
  /** Anyone with the link may watch, no account needed (6E). Always true since 2026-11-23 unless an admin hid it. */
  isPublic: boolean;
  /** The public link unless an admin hid it: the code, and the whole address when the server knows the web app's. */
  share: PublicShare | null;
  /** The tournament's square logo and 16:9 banner (owners set them; signed links, HLD P-26). */
  logoUrl: string | null;
  bannerUrl: string | null;
  /** The league it's a season of (2026-11-24); left out for a one-off. */
  league?: LeagueBadge;
};

/** ACCOUNT_PHOTO_SET / REMOVE, TOURNAMENT_PICTURE_SET / REMOVE: the picture's new link, null once removed. */
export type PictureResult = { url: string | null };

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
  /** The linked person's profile photo (signed link); null when not linked or no photo. */
  photoUrl?: string | null;
  /** Left out of the squad after they had played (2026-11-20): only on a team's leftPlayers. */
  leftOn?: string | null;
};

/** Someone who runs a team inside a tournament (2026-11-20). */
export type TeamAdmin = {
  userId: number;
  name: string;
  isMe: boolean;
  /** Owners may remove anyone; an admin may step down. */
  canRemove: boolean;
};

/**
 * A team's invite link (2026-11-23): its join code as an address; whoever opens it joins straight in. `note` says
 * when it stops working; `url` is null for an organiser looking at a lasting team's side (its admins share it).
 */
export type InviteLink = { url: string | null; note: string };

export type Team = {
  id: number;
  name: string;
  tournamentId: number;
  defaultCaptainPlayerId: number | null;
  /** Owners and this team's admins only: what players type under "Join a team". */
  joinCode: string | null;
  /** Owners and this team's admins only, until the tournament is over. */
  invite?: InviteLink;
  /** The squad (players who left are in leftPlayers). */
  players: Player[];
  /** The next four come only on team answers (TEAM_GET / TEAM_LIST and changes), not inside a match. */
  /** Left out after they had played: kept for the scorecards; admins can bring them back. */
  leftPlayers?: Player[];
  /** The people who run this team here. */
  admins?: TeamAdmin[];
  /** May change this squad: an owner, or one of its admins (and the tournament isn't over). */
  canManage?: boolean;
  /** May add or remove its admins: owners. */
  canManageAdmins?: boolean;
  /** The lasting team this squad belongs to (step 2 of the lasting-teams plan): kept from here, or entered with a code. */
  clubId?: number | null;
  /** The caller may keep it for other tournaments: one of its admins, while it isn't kept yet (C-23). */
  canKeep?: boolean;
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
  /** An invite link opened by someone already in the team: nothing changed. */
  alreadyIn?: boolean;
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

/** One match's line under a leaderboard row: "45* (32)", "4-0-28-2" or a goal's minute. */
export type PlayerMatchLine = {
  matchId: number;
  matchNumber: number;
  opponent: string;
  value: string;
  /** "6 fours · 2 sixes", "from Arjun", "for Ravi". */
  detail: string | null;
  /** The match is still being played. */
  inPlay: boolean;
};

/** TOURNAMENT_PLAYER_LINES: one player's innings and spells (cricket) or goals and assists (football). */
export type PlayerMatchLines = {
  playerId: number;
  playerName: string;
  teamName: string;
  batting: PlayerMatchLine[];
  bowling: PlayerMatchLine[];
  goals: PlayerMatchLine[];
  assists: PlayerMatchLine[];
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
  /** Their profile photo (signed link). */
  photoUrl: string | null;
  tournamentsRun: number;
  sports: SportCard[];
  /** Followers, following, and how you and they follow each other (2026-11-23). */
  follow?: FollowSummary;
  /** Matches they're in now that you may watch. */
  playingNow?: PlayingNow[];
};

// --- Following people (2026-11-23, item 6) -------------------------------------------------------------------

export type FollowSummary = { followers: number; following: number; isFollowing: boolean; followsMe: boolean };

/** Someone in a search or a followers list. `line` is "Cricket · Karve Nagar Falcons" (their latest team). */
export type PersonRow = {
  userId: number;
  name: string;
  photoUrl: string | null;
  line: string | null;
  isFollowing: boolean;
  followsMe: boolean;
  isMe: boolean;
};

export type PersonList = { userId: number; name: string; followers: number; following: number; isMine: boolean; items: PersonRow[] };

export type FollowResult = { userId: number; follow: FollowSummary };

export type PlayingNow = { tournamentId: number; tournamentName: string; sport: Sport; matchId: number; match: string };

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
  | 'EndDateReminder'
  | 'Auction'
  | 'Draw'
  | 'Club'
  | 'Social'
  | 'League';

/** The inbox's chips (2026-11-23). */
export type NotificationCategory = 'Social' | 'Scoring' | 'Tournaments' | 'Teams';

/** One line in your inbox. The words come from the server; the ids say where tapping it goes. */
export type AppNotification = {
  notificationId: number;
  kind: NotificationKind;
  title: string;
  body: string;
  tournamentId: number | null;
  sport: 'Football' | 'Cricket' | null;
  matchId: number | null;
  /** A team inside the tournament (KeepTeam opens its page with the keep sheet). */
  teamId?: number | null;
  /** A lasting team: opens its page. */
  clubId?: number | null;
  /** Someone who joined a lasting team with its code: its page opens with the live-tournaments question for them. */
  clubPlayerId?: number | null;
  /** Someone who followed you: opens their profile. */
  profileUserId?: number | null;
  /** A league you were made an organiser of: opens its page. */
  leagueId?: number | null;
  category: NotificationCategory;
  createdAt: string;
  isRead: boolean;
};

// --- Lasting teams (2026-11-20, step 2 of docs/reusable-teams-plan.md) -------------------------------------
// People only ever see "team" (C-21); the API and these types say club.

/** A row on Home's Teams tab: a team the person runs or plays for. */
export type ClubListItem = {
  clubId: number;
  name: string;
  sport: 'Football' | 'Cricket';
  area: string | null;
  logoUrl: string | null;
  isAdmin: boolean;
  isPlayer: boolean;
  players: number;
  tournaments: number;
  /** Tournaments it's playing in now. */
  live: number;
};

export type ClubAdmin = { userId: number; name: string; isMe: boolean; canRemove: boolean };

export type ClubPlayer = {
  clubPlayerId: number;
  name: string;
  jerseyNumber: number | null;
  position: string | null;
  isCaptain: boolean;
  isLinked: boolean;
  /** An email or number is waiting for this person to sign up. */
  isWaiting: boolean;
  isMe: boolean;
  isAdmin: boolean;
  cricket: CricketProfile | null;
  photoUrl: string | null;
  /** The team's admins only. */
  email: string | null;
  phone: string | null;
};

export type ClubTournament = {
  tournamentId: number;
  name: string;
  sport: 'Football' | 'Cricket';
  status: 'Upcoming' | 'Live' | 'Completed' | 'Cancelled';
  startDate: string | null;
  endDate: string | null;
  logoUrl: string | null;
  teamId: number;
  teamName: string;
  /** Being played, still to play, played (C-12). */
  section: 'live' | 'upcoming' | 'past';
  played: number;
  won: number;
  champion: boolean;
  squad: number;
  /** "Champions · 5 played, 5 won", "Played 4 · won 3", "Starts 12 Dec · 14 in the squad". */
  line: string;
  canOpen: boolean;
  /** An entry still waiting for the organiser (admins only): opens the entry to change or withdraw it. */
  entryId?: number;
};

/** A lasting team's page: anyone signed in sees it (C-15); emails, numbers and the code only its admins. */
export type Club = {
  clubId: number;
  name: string;
  sport: 'Football' | 'Cricket';
  area: string | null;
  logoUrl: string | null;
  joinCode: string | null;
  /** Its admins only. */
  invite?: InviteLink;
  canManage: boolean;
  myClubPlayerId: number | null;
  admins: ClubAdmin[];
  players: ClubPlayer[];
  tournaments: ClubTournament[];
  totals: { tournaments: number; matches: number; won: number; titles: number };
  /** The public page's link (signed out, names and results only); `url` only when the server knows the website's address. */
  share: { code: string; url: string | null } | null;
  /** After a player is added or leaves: the live tournaments to ask about (C-6). */
  question?: ClubSquadQuestion;
};

/** The one-sheet question after a team's player is added or leaves (C-5, C-6, C-20). */
export type ClubSquadQuestion = {
  change: 'add' | 'remove';
  clubPlayerId: number | null;
  playerName: string;
  /** Upcoming tournaments already changed by themselves. */
  done: string[];
  live: {
    tournamentId: number;
    tournamentName: string;
    teamId: number;
    teamName: string;
    /** For "remove": the squad place to leave out. */
    playerId: number | null;
    /** Why this one can't be ticked. */
    reason: string | null;
  }[];
};

// --- Entering a tournament with its code (2026-11-21, step 3) ------------------------------------------------

export type EntryPlayer = {
  clubPlayerId: number;
  name: string;
  detail: string | null;
  isCaptain: boolean;
  ticked: boolean;
  /** Why they can't play here ("Plays for Tigers in this tournament"). */
  reason: string | null;
};

/** What a team's admin sees after typing the code, or opening an entry already sent. */
export type EntryPreview = {
  tournamentId: number;
  tournamentName: string;
  sport: 'Football' | 'Cricket';
  status: 'Upcoming' | 'Live' | 'Completed' | 'Cancelled';
  startDate: string | null;
  endDate: string | null;
  logoUrl: string | null;
  organiser: string;
  teams: string[];
  clubId: number;
  clubName: string;
  teamName: string;
  teamNameProblem: string | null;
  players: EntryPlayer[];
  entryId: number | null;
  entryStatus: 'Waiting' | 'Accepted' | 'Declined' | 'Withdrawn' | 'Cancelled' | null;
  code: string | null;
};

/** The organiser's side (board Org-Entries): the code and the entries waiting for an answer. */
export type TournamentEntries = {
  open: boolean;
  code: string | null;
  shareText: string | null;
  url: string | null;
  /** Why the switch can't be turned on. */
  closed: string | null;
  waiting: EntryRow[];
  notice?: string;
};

export type EntryRow = {
  entryId: number;
  clubId: number;
  clubName: string;
  area: string | null;
  logoUrl: string | null;
  teamName: string;
  requestedBy: string;
  requestedAt: string;
  /** "3 tournaments on KickCricket". */
  record: string;
  players: EntryPlayer[];
  /** Why it can't be accepted as it is. */
  problem: string | null;
};

export type ClubPlayerLookup = {
  kind: 'Email' | 'Phone';
  contact: string;
  display: string;
  found: boolean;
  name: string | null;
  /** They're in this team already. */
  alreadyIn: boolean;
};

export type ClubJoinPreview = {
  clubId: number;
  name: string;
  sport: 'Football' | 'Cricket';
  area: string | null;
  logoUrl: string | null;
  players: number;
  places: { clubPlayerId: number; name: string; detail: string | null }[];
};

export type ClubJoinResult = { clubId: number; name: string; sport: 'Football' | 'Cricket'; alreadyIn?: boolean };

/** A page of the inbox, newest first; ask again with `before` = the last id while `hasMore`. */
export type NotificationPage = {
  items: AppNotification[];
  unreadCount: number;
  hasMore: boolean;
  /** Unread per chip, whichever chip was asked for. */
  unreadByCategory: Record<NotificationCategory, number>;
};

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

// --- The player pool and the auction (2026-11-17) ------------------------------

export type PoolTier = {
  id: number;
  name: string;
  order: number;
  basePrice: number;
  /** The most one team may buy from this tier; null = no limit. */
  maxPerTeam: number | null;
  players: number;
};

export type PoolPlayerStatus = 'Available' | 'InAuction' | 'Sold' | 'Unsold' | 'Drawn';

/** How the pool fills the teams; null until chosen. Fixed once that way starts. */
export type PoolMethod = 'Draw' | 'Auction';

export type PoolPlayer = {
  id: number;
  name: string;
  /** "Batter", "All-rounder", "Defender" — what they play, if known. */
  role: string | null;
  position: string | null;
  cricketRole: CricketRole | null;
  tierId: number | null;
  isLinked: boolean;
  joinedByCode: boolean;
  isWithdrawn: boolean;
  isMe: boolean;
  /** Owners only. */
  email: string | null;
  phone: string | null;
  status: PoolPlayerStatus;
  teamId: number | null;
  teamName: string | null;
  price: number | null;
};

export type Pool = {
  /** The registration code, owners only. */
  joinCode: string | null;
  registrationOpen: boolean;
  canEdit: boolean;
  canAdd: boolean;
  tiers: PoolTier[];
  players: PoolPlayer[];
  teams: number;
  keptPlayers: number;
  myPoolPlayerId: number | null;
  method: PoolMethod | null;
  canChooseMethod: boolean;
  drawStatus: DrawStatus;
  /** 'None' or the auction's status: with drawStatus, whether there are results to show. */
  auctionStatus: AuctionStatus | 'None';
};

// --- The team draw (2026-11-17) -------------------------------------------------

export type DrawStatus = 'None' | 'Setup' | 'Live' | 'Confirmed';
export type DrawKind = 'ByTier' | 'Random';

export type DrawPick = {
  pickId: number;
  poolPlayerId: number;
  name: string;
  role: string | null;
  tierName: string | null;
  teamId: number;
  teamName: string;
  order: number;
  landedAt: string;
  movedFromTeamName: string | null;
  isMe: boolean;
};

export type DrawTeam = {
  teamId: number;
  name: string;
  /** 1, 2, 3… round the table once started. */
  turn: number | null;
  players: number;
  /** In the team before the draw (the captain, anyone added by hand). */
  kept: string[];
  drawn: DrawPick[];
  /** A name is being drawn for this team right now. */
  isDrawing: boolean;
};

/** A name being drawn: the team and the pot are known, the name isn't until `landsAt`. */
export type DrawSpin = {
  pickId: number;
  teamId: number;
  teamName: string;
  pickedAt: string;
  landsAt: string;
  potName: string;
  names: string[];
};

export type DrawActions = {
  canChooseMethod: boolean;
  canEditKind: boolean;
  canEditPace: boolean;
  canStart: boolean;
  canQuickDraw: boolean;
  canDrawNext: boolean;
  canDrawRestOfPot: boolean;
  canDrawAll: boolean;
  canRestart: boolean;
  canTakeOver: boolean;
  canMove: boolean;
  canConfirm: boolean;
  confirmProblem: string | null;
};

export type DrawState = {
  status: DrawStatus;
  allDrawn: boolean;
  serverNow: string;
  method: PoolMethod | null;
  kind: DrawKind;
  autoSeconds: number | null;
  times: number;
  drawer: { userId: number; name: string } | null;
  me: { isOwner: boolean; isDrawer: boolean; poolPlayerId: number | null; drawnForTeamId: number | null };
  teams: DrawTeam[];
  spin: DrawSpin | null;
  last: DrawPick | null;
  pot: { name: string; players: { poolPlayerId: number; name: string; role: string | null }[]; nextName: string | null; nextCount: number } | null;
  nextTeamId: number | null;
  counts: { players: number; drawn: number; left: number };
  preview: {
    line: string;
    note: string | null;
    teams: { teamId: number; name: string; has: number; gets: number; endsWith: number; orOneMore: boolean }[];
    tiers: { name: string; players: number }[];
  } | null;
  startProblem: string | null;
  actions: DrawActions;
};

export type PoolJoinPreview = { tournamentId: number; tournamentName: string; sport: Sport; players: number };
export type PoolJoinResult = { tournamentId: number; tournamentName: string; sport: Sport; poolPlayerId: number };

export type AuctionStatus = 'None' | 'Setup' | 'Live' | 'Paused' | 'RoundOver' | 'Finished' | 'Confirmed';
export type BidStep = { upTo: number | null; step: number };

export type AuctionSettings = {
  unit: string;
  purse: number;
  minSquad: number;
  maxSquad: number;
  keptPlayerPrice: number;
  noTierBasePrice: number;
  bidSteps: BidStep[];
  clockOn: boolean;
  firstBidSeconds: number;
  nextBidSeconds: number;
  order: 'ByTier' | 'ListOrder';
  unsoldPlan: 'AnotherRound' | 'AssignByHand';
};

export type AuctionTeam = {
  teamId: number;
  name: string;
  bidder: { userId: number; name: string } | null;
  bidderIsCaptain: boolean;
  captainName: string | null;
  captainPlayerId: number | null;
  captainWithoutAccount: boolean;
  players: number;
  spent: number;
  purseLeft: number;
  needs: number;
  isFull: boolean;
  maxBid: number;
  canBid: boolean;
  cantBidReason: string | null;
  isHighest: boolean;
};

export type AuctionBidRow = { bidId: number; teamId: number; teamName: string; amount: number; at: string; fromRoom: boolean };

export type AuctionLot = {
  lotId: number;
  player: { poolPlayerId: number; name: string; role: string | null; tierName: string | null; isLinked: boolean; isMe: boolean };
  basePrice: number;
  currentBid: number | null;
  currentTeamId: number | null;
  currentTeamName: string | null;
  nextBid: number;
  twoStepsBid: number;
  fiveStepsBid: number;
  openedAt: string | null;
  /** UTC; count down from the server's clock (`serverNow`), not the phone's. Null with the clock off or paused. */
  closesAt: string | null;
  secondsLeftWhenPaused: number | null;
  number: number;
  ofTotal: number;
  bids: AuctionBidRow[];
};

export type AuctionResult = {
  lotId: number;
  playerName: string;
  sold: boolean;
  teamId: number | null;
  teamName: string | null;
  price: number | null;
  at: string;
  isMe: boolean;
};

export type AuctionActions = {
  canEditSettings: boolean;
  canEditClock: boolean;
  canSetBidders: boolean;
  canStart: boolean;
  canOpenNext: boolean;
  canSell: boolean;
  canMarkUnsold: boolean;
  canUndoBid: boolean;
  canUndoSale: boolean;
  canPause: boolean;
  canResume: boolean;
  canTakeOver: boolean;
  canStartRound: boolean;
  canFinish: boolean;
  canAssign: boolean;
  canConfirm: boolean;
  canCancel: boolean;
  /** Bought players may be moved or swapped (finished, before confirming). */
  canMoveSales: boolean;
  /** Teams are short and players unsold: "Fill the gaps by draw". */
  canFill: boolean;
  confirmProblem: string | null;
};

export type AuctionSale = {
  lotId: number;
  poolPlayerId: number;
  name: string;
  role: string | null;
  tierName: string | null;
  teamId: number;
  price: number;
  round: number;
  assigned: boolean;
  /** Dealt by "Fill the gaps by draw". */
  byDraw: boolean;
  /** Moved or swapped after the auction: the team that bought them. */
  movedFromTeamName: string | null;
};

/** What "Fill the gaps by draw" will do: how many each short team gets (who goes where is drawn when it's done). */
export type AuctionFillPreview = {
  line: string;
  note: string;
  teams: { teamId: number; name: string; has: number; gets: number; purseLeft: number }[];
  left: number;
};

export type AuctionUnsold = { poolPlayerId: number; name: string; role: string | null; tierId: number | null; tierName: string | null; basePrice: number };

export type AuctionState = {
  status: AuctionStatus;
  /** The pool's chosen way: a "Draw" means there's no auction. */
  method: PoolMethod | null;
  serverNow: string;
  settings: AuctionSettings;
  round: number;
  auctioneer: { userId: number; name: string } | null;
  me: { isOwner: boolean; isAuctioneer: boolean; bidderForTeamId: number | null; poolPlayerId: number | null };
  teams: AuctionTeam[];
  lot: AuctionLot | null;
  upNext: { lotId: number; name: string; role: string | null; tierName: string | null; basePrice: number }[];
  last: AuctionResult | null;
  counts: { players: number; sold: number; unsold: number; waiting: number };
  actions: AuctionActions;
  sales: AuctionSale[] | null;
  unsold: AuctionUnsold[] | null;
  startProblem: string | null;
  startWarning: string | null;
  tiers: PoolTier[];
};

// --- Leagues and seasons (2026-11-24, Models/Leagues/LeagueModels.cs) ------------------------------------------------------

/** "Season 3 of Corporate Premier League" on a season's tournament (and its Home row). */
export type LeagueBadge = {
  leagueId: number;
  name: string;
  shortName: string;
  season: number;
  logoUrl: string | null;
  leagueCode: string;
  /** "Last season: Kothrud Kings won · all-time stats" — on the tournament's own answer only. */
  line?: string;
};

/** LEAGUE_LIST: the leagues the caller runs. */
export type LeagueListItem = {
  leagueId: number;
  name: string;
  shortName: string;
  sport: Sport;
  logoUrl: string | null;
  seasons: number;
  line: string;
};

/** LEAGUE_CANDIDATES: a tournament the caller could tick in as an earlier season. */
export type LeagueCandidate = { tournamentId: number; name: string; status: TournamentStatus; startDate: string | null; line: string };

export type LeagueSeason = {
  number: number;
  tournamentId: number;
  name: string;
  status: TournamentStatus;
  startDate: string | null;
  endDate: string | null;
  logoUrl: string | null;
  section: 'live' | 'upcoming' | 'past';
  /** The champions' name once it has them, else the tournament's. */
  title: string;
  line: string;
  championName: string | null;
  teams: number;
  /** In it already: opens straight away. Otherwise the app follows it first (every tournament is public). */
  canOpen: boolean;
  liveCode: string | null;
  /** An admin hid it (only organisers see such a season). */
  hidden: boolean;
};

export type League = {
  leagueId: number;
  name: string;
  shortName: string;
  sport: Sport;
  area: string | null;
  logoUrl: string | null;
  runBy: string[];
  organisers: { userId: number; name: string; isMe: boolean; canRemove: boolean }[];
  totals: { seasons: number; teams: number; matches: number; champions: number };
  /** Newest first. */
  seasons: LeagueSeason[];
  nextSeason: number;
  canManage: boolean;
  share: PublicShare | null;
};

export type LeagueBoardRow = { rank: number; name: string; line: string; value: string; userId: number | null; playerId: number };

export type LeagueBoard = { key: string; title: string; valueLabel: string; qualification: string | null; total: number; rows: LeagueBoardRow[] };

/** LEAGUE_STATS: Batting · Bowling · Fielding · MVP (football: Scoring · Playing · Discipline), each a set of boards. */
export type LeagueStats = {
  leagueId: number;
  sport: Sport;
  seasons: { number: number; name: string }[];
  season: number | null;
  basis: string;
  groups: { key: string; title: string; boards: LeagueBoard[] }[];
  notes: string[];
};

export type LeagueTeams = {
  titles: { name: string; seasons: number[]; count: number }[];
  teams: { name: string; seasons: number; played: number; won: number; lost: number; drawn: number; winPercent: number; titles: number }[];
  note: string;
};

/** LEAGUE_BRING_BACK_OPTIONS: every earlier season's teams. */
export type BringBackOptions = {
  seasons: { tournamentId: number; number: number; name: string; teams: { teamId: number; name: string; line: string; players: number; reason: string | null }[] }[];
};
