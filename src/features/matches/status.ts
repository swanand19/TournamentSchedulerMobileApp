import type { ChipTone } from '@/components/StatusChip';
import type { CricketMatchCard, FootballMatchCard, MatchCard } from '@/api/types';

// How a match's state reads on a card. Words only — every rule behind them lives on the server.

export type MatchPhase = 'live' | 'upcoming' | 'completed';

export function phaseOf(m: MatchCard): MatchPhase {
  if (m.sport === 'Football') {
    if (m.status === 'NotStarted') return 'upcoming';
    if (m.status === 'Completed') return 'completed';
    return 'live';
  }
  if (m.status === 'NotStarted') return 'upcoming';
  if (m.status === 'Completed' || m.status === 'Abandoned') return 'completed';
  return 'live';
}

function footballLine(m: FootballMatchCard): { label: string; tone: ChipTone } {
  switch (m.status) {
    case 'NotStarted':
      return { label: 'Upcoming', tone: 'done' };
    case 'PenaltyShootout':
      return { label: `Penalties ${m.penaltyHomeScore ?? 0}–${m.penaltyAwayScore ?? 0}`, tone: 'live' };
    case 'Completed':
      if (m.forfeitWinnerTeamId) return { label: 'Awarded', tone: 'warn' };
      if (m.penaltyWinnerTeamId) return { label: `FT · pens ${m.penaltyHomeScore}–${m.penaltyAwayScore}`, tone: 'ready' };
      return { label: m.currentHalf > 2 ? 'FT · AET' : 'FT', tone: 'ready' };
    default: {
      if (m.periodState === 'Ended') return { label: m.currentHalf === 1 ? 'Half-time' : 'Break', tone: 'setup' };
      if (m.periodState === 'Stopped') return { label: 'Play stopped', tone: 'setup' };
      const period = m.currentHalf === 1 ? '1st half' : m.currentHalf === 2 ? '2nd half' : `ET ${m.currentHalf - 2}`;
      return { label: `Live · ${period}`, tone: 'live' };
    }
  }
}

function cricketLine(m: CricketMatchCard): { label: string; tone: ChipTone } {
  switch (m.status) {
    case 'NotStarted':
      return { label: 'Upcoming', tone: 'done' };
    case 'InningsBreak':
      return { label: 'Innings break', tone: 'setup' };
    case 'SuperOver':
      return { label: 'Super over', tone: 'live' };
    case 'Completed':
      return { label: m.isNoResult ? 'No result' : m.isTie ? 'Tied' : m.isDraw ? 'Drawn' : 'Result', tone: 'ready' };
    case 'Abandoned':
      return { label: 'Abandoned', tone: 'danger' };
    default:
      return { label: 'Live', tone: 'live' };
  }
}

export function statusLine(m: MatchCard) {
  return m.sport === 'Football' ? footballLine(m) : cricketLine(m);
}
