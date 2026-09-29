// The wording of cricket roles and bowling styles, mirroring BowlingStyles.Describe and
// CricketRoles.Describe on the API (Models/Cricket/CricketEnums.cs) and the website's
// cricketLabels.js. The `value`s are exactly what travels over the wire.

import type { BattingStyle, BowlingArm, BowlingType, CricketProfile, CricketRole } from '@/api/types';

export const CRICKET_ROLES: { value: CricketRole; label: string; short: string }[] = [
  { value: 'Batter', label: 'Batter', short: 'BAT' },
  { value: 'Bowler', label: 'Bowler', short: 'BOWL' },
  { value: 'AllRounder', label: 'All-rounder', short: 'AR' },
  { value: 'WicketKeeper', label: 'Wicket-keeper', short: 'WK' },
  { value: 'WicketKeeperBatter', label: 'WK batter', short: 'WK' },
];

export const BATTING_STYLES: { value: BattingStyle; label: string; short: string }[] = [
  { value: 'RightHand', label: 'Right-hand', short: 'RHB' },
  { value: 'LeftHand', label: 'Left-hand', short: 'LHB' },
];

export const BOWLING_ARMS: { value: BowlingArm; label: string }[] = [
  { value: 'Right', label: 'Right arm' },
  { value: 'Left', label: 'Left arm' },
];

export const BOWLING_TYPES: { value: BowlingType; label: string }[] = [
  { value: 'Fast', label: 'Fast' },
  { value: 'FastMedium', label: 'Fast-medium' },
  { value: 'MediumFast', label: 'Medium-fast' },
  { value: 'Medium', label: 'Medium' },
  { value: 'FingerSpin', label: 'Finger spin' },
  { value: 'WristSpin', label: 'Wrist spin' },
];

// The arm decides the name: a left-armer's finger spin is "slow left-arm orthodox", a
// right-armer's is an off break.
const BOWLING_STYLE_LABELS: Record<string, string> = {
  'Right:Fast': 'Right-arm fast',
  'Right:FastMedium': 'Right-arm fast-medium',
  'Right:MediumFast': 'Right-arm medium-fast',
  'Right:Medium': 'Right-arm medium',
  'Right:FingerSpin': 'Right-arm off break',
  'Right:WristSpin': 'Right-arm leg break',
  'Left:Fast': 'Left-arm fast',
  'Left:FastMedium': 'Left-arm fast-medium',
  'Left:MediumFast': 'Left-arm medium-fast',
  'Left:Medium': 'Left-arm medium',
  'Left:FingerSpin': 'Slow left-arm orthodox',
  'Left:WristSpin': 'Left-arm wrist spin (chinaman)',
};

export function roleLabel(role: CricketRole | null | undefined): string {
  return CRICKET_ROLES.find((r) => r.value === role)?.label ?? '';
}

export function roleShort(role: CricketRole | null | undefined): string {
  return CRICKET_ROLES.find((r) => r.value === role)?.short ?? '';
}

export function battingShort(style: BattingStyle | null | undefined): string {
  return BATTING_STYLES.find((s) => s.value === style)?.short ?? '';
}

/** Null unless both halves are known — half a style has no name. */
export function bowlingStyleLabel(arm: BowlingArm | null | undefined, type: BowlingType | null | undefined): string | null {
  if (!arm || !type) return null;
  return BOWLING_STYLE_LABELS[`${arm}:${type}`] ?? `${arm}-arm ${type}`;
}

/** Whether to ask this role how they bowl. A pure batter is not asked. */
export function roleBowls(role: CricketRole | null | undefined): boolean {
  return role === 'Bowler' || role === 'AllRounder';
}

/** Who is suggested as wicket-keeper for an XI. */
export function roleKeeps(role: CricketRole | null | undefined): boolean {
  return role === 'WicketKeeper' || role === 'WicketKeeperBatter';
}

/** "RHB · Right-arm leg break", skipping whatever is unset. */
export function describeCricketer(cricket: CricketProfile | null | undefined): string {
  if (!cricket) return '';
  return [
    roleLabel(cricket.primaryRole),
    battingShort(cricket.battingStyle),
    bowlingStyleLabel(cricket.bowlingArm, cricket.bowlingType),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "RunOut" → "Run out", "LBW" stays "LBW". */
export function dismissalLabel(type: string): string {
  if (type === 'LBW') return 'LBW';
  return type.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^(\w)(.*)$/, (_, a: string, b: string) => a + b.toLowerCase());
}

/** Mirrors DismissalRules.CanDismissNonStriker: everything else only befalls the batter facing. */
export function dismissalCanTakeNonStriker(type: string): boolean {
  return type === 'RunOut' || type === 'ObstructingTheField' || type === 'RetiredHurt' || type === 'RetiredOut';
}

/** Dismissals that record a fielder — the catcher, the thrower, or the keeper. */
export function dismissalTakesFielder(type: string): boolean {
  return type === 'Caught' || type === 'RunOut' || type === 'Stumped';
}
