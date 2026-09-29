import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FootballMatch } from '@/api/types';
import { parseUtc, stopwatch } from '@/lib/format';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, space, type } from '@/theme/theme';

// The match clock, computed on the phone once a second from the server's timestamps — the same
// sum the server does (CalculateMinuteBreakdown), so the minute the scorer sees is the minute an
// event gets stamped with. Nothing is sent per tick. When the whistle has gone or play is stopped,
// pausedAt freezes it.
//
// The main figure is match time and stops at the end of the period's regulation; anything beyond
// is stoppage, shown separately as "+2:13" the way a stadium board does.

export function elapsedSeconds(match: FootballMatch, now: number): number {
  const started = parseUtc(match.halfStartedAt)?.getTime();
  if (!started) return 0;
  const pausedAt = parseUtc(match.pausedAt)?.getTime();
  const activePause = pausedAt ? now - pausedAt : 0;
  return Math.max(0, Math.floor((now - started - (match.pausedDurationMs || 0) - activePause) / 1000));
}

export default function MatchClock({ match }: { match: FootballMatch }) {
  const theme = useSportTheme();
  const [now, setNow] = useState(() => Date.now());
  const ticking = match.isClockRunning && !match.pausedAt;

  // While stopped the sum doesn't depend on "now" (pausedAt cancels it out), so the clock only
  // needs ticking while it runs — starting on the very next frame, so a resume shows at once.
  useEffect(() => {
    if (!ticking) return undefined;
    const tick = () => setNow(Date.now());
    const first = requestAnimationFrame(tick);
    const timer = setInterval(tick, 1000);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(timer);
    };
  }, [ticking]);

  const elapsed = elapsedSeconds(match, now);
  const periodSeconds = (match.currentPeriodMinutes || 0) * 60;
  const addedSeconds = (match.extraMinutesAddedThisHalf || 0) * 60;
  const inPeriod = periodSeconds > 0 ? Math.min(elapsed, periodSeconds) : elapsed;
  // Stoppage only counts when the referee has added some, and only up to what was added. With
  // none added, the clock simply stops at the end of the period and waits for the whistle.
  const stoppage = periodSeconds > 0 && addedSeconds > 0 ? Math.min(Math.max(0, elapsed - periodSeconds), addedSeconds) : 0;
  const timeUp = periodSeconds > 0 && elapsed >= periodSeconds + addedSeconds;
  const total = (match.priorPeriodsMinutes || 0) * 60 + inPeriod;
  const running = ticking && !timeUp;

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLiveRegion={timeUp ? 'polite' : 'none'}
      accessibilityLabel={`Match clock ${Math.floor(total / 60)} minutes${stoppage ? `, plus ${Math.floor(stoppage / 60)} minutes stoppage` : ''}${timeUp ? ', time up' : running ? '' : ', stopped'}`}
    >
      <Text style={[styles.clock, { color: running ? theme.accent : theme.onDarkSoft }]}>{stopwatch(total)}</Text>
      {addedSeconds > 0 && (
        <Text style={[styles.stoppage, { color: timeUp ? theme.onDarkSoft : theme.accent }]}>
          +{stopwatch(stoppage)} <Text style={[type.caption, { color: theme.onDarkSoft }]}>of {match.extraMinutesAddedThisHalf} min</Text>
        </Text>
      )}
      {timeUp && ticking && <Text style={[type.bodyStrong, { color: theme.accent }]}>Time up</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 2 },
  clock: { fontFamily: fonts.display, fontSize: 52, lineHeight: 56, fontVariant: ['tabular-nums'] },
  stoppage: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, fontVariant: ['tabular-nums'], marginTop: -space.xs },
});
