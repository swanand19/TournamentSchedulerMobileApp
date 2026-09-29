// Small formatting helpers shared by the screens. Anything that decides a rule lives on the server;
// these only turn server values into words.

/**
 * The API stores UTC but some timestamps arrive without a zone ("2026-09-28T10:00:00"), which
 * Date would read as local time. Same fix as the website's parseUtc.
 */
export function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

/** "3 days ago", "yesterday", "just now". Coarse on purpose — it's a list hint, not a record. */
export function relativeDate(value: string | null | undefined): string {
  const date = parseUtc(value);
  if (!date) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return date.toLocaleDateString();
}

/** mm:ss with a minutes column that can pass 99. */
export function stopwatch(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 45 → "45'", or 45 + 2 → "45+2'". */
export function minuteLabel(minute: number, stoppage?: number | null): string {
  return stoppage ? `${minute}+${stoppage}'` : `${minute}'`;
}

/** "PenaltyShootout" → "Penalty shootout". For enum names the server sends as-is. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Rovers FC" → "RF", "United" → "UN". For the little team badges. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A → 0, B → 1… for grouping, and back. */
export const groupLabel = (i: number) => String.fromCharCode(65 + i);
