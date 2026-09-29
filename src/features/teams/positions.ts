// Football positions are free text on the API ("CB", "Left wing", "GK"). The app offers four
// quick lines and sorts whatever was typed into one of them for counts and filters.

export type Line = 'GK' | 'DEF' | 'MID' | 'FWD';

export const LINES: { key: Line; label: string }[] = [
  { key: 'GK', label: 'Keeper' },
  { key: 'DEF', label: 'Defender' },
  { key: 'MID', label: 'Midfield' },
  { key: 'FWD', label: 'Forward' },
];

export function lineOf(position: string | null | undefined): Line | null {
  const p = (position ?? '').trim().toUpperCase();
  if (!p) return null;
  if (p === 'GK' || p.startsWith('GOAL') || p.startsWith('KEEP')) return 'GK';
  if (p.startsWith('DEF') || /\b(CB|LB|RB|LWB|RWB|SW)\b/.test(p) || p.includes('BACK')) return 'DEF';
  if (p.startsWith('MID') || /\b(CM|CDM|CAM|DM|AM|LM|RM)\b/.test(p)) return 'MID';
  if (p.startsWith('FW') || p.startsWith('FOR') || p.startsWith('STR') || p.includes('WING') || /\b(ST|CF|LW|RW|SS)\b/.test(p)) return 'FWD';
  return null;
}
