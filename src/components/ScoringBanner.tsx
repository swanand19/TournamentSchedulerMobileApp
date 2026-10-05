import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { Scoring } from '@/api/types';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import { useAction } from '@/hooks/useAction';
import { confirm } from '@/lib/confirm';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type } from '@/theme/theme';

// Who is scoring this match, and what you can do about it — drawn from the match's `scoring`
// block, never decided here. One person scores a match at a time: others follow along, a scorer
// can ask to take over (the active scorer gets Allow / Decline on their screen), and an owner can
// take over outright. The live screens poll every 5 s, which is how a request arrives.

type Props = {
  sport: 'football' | 'cricket';
  matchId: number | string;
  scoring: Scoring | null | undefined;
  /** After any answer: reload the match so the screen's controls follow. */
  onChanged: () => void;
};

/** Whether the scoring controls must be hidden: someone else holds the match, or the tournament is closed. */
export function isScoringLocked(scoring: Scoring | null | undefined, over: boolean) {
  return !over && !!scoring && !scoring.canScore;
}

export default function ScoringBanner({ sport, matchId, scoring, onChanged }: Props) {
  const theme = useSportTheme();
  const action = useAction();

  if (!scoring) return null;

  const routeParams = { sport, matchId };
  const run = async (serviceId: 'SCORING_REQUEST' | 'SCORING_RESPOND' | 'SCORING_TAKE_OVER', body?: object) => {
    const res = await action.run(() => api.call<Scoring>(serviceId, { routeParams, body: body ?? {} }));
    if (res.ok) {
      haptic.success();
      onChanged();
    }
  };

  const active = scoring.activeScorer;
  const pending = scoring.pendingRequest;

  if (scoring.canRespondToRequest && pending) {
    return (
      <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.box, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
        <ErrorBanner message={action.error?.message} />
        <Text style={[type.lead, { color: theme.onDark }]}>{pending.by.name} wants to take over scoring this match.</Text>
        <View style={styles.row}>
          <Button label="Allow" icon="check" busy={action.busy} onPress={() => run('SCORING_RESPOND', { allow: true })} style={{ flex: 1 }} />
          <Button label="Decline" variant="ghost" disabled={action.busy} onPress={() => run('SCORING_RESPOND', { allow: false })} style={{ flex: 1 }} />
        </View>
      </View>
    );
  }

  if (!active || scoring.isActiveScorer) return null;

  const takeOver = async () => {
    const ok = await confirm({
      title: 'Take over scoring?',
      message: `${active.name} is scoring this match. Their scoring buttons switch off and yours switch on.`,
      confirmLabel: 'Take over',
    });
    if (ok) run('SCORING_TAKE_OVER');
  };

  return (
    <View style={[styles.box, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}>
      <ErrorBanner message={action.error?.message} />
      <Text style={[type.bodyStrong, { color: theme.onDark }]}>
        {active.name} is scoring this match.
      </Text>
      <Text style={[type.body, { color: theme.onDarkSoft }]}>
        {pending && !scoring.canRequestScoring
          ? `Waiting for ${active.name} to answer ${pending.by.name}'s request…`
          : 'You can follow it here; the scoring buttons are off.'}
      </Text>
      {(scoring.canRequestScoring || scoring.canTakeOverScoring) && (
        <View style={styles.row}>
          {scoring.canRequestScoring && (
            <Button label="Ask to score" icon="hand-back-right-outline" busy={action.busy} onPress={() => run('SCORING_REQUEST')} style={{ flex: 1 }} />
          )}
          {scoring.canTakeOverScoring && (
            <Button label="Take over" icon="account-switch-outline" variant="ghost" disabled={action.busy} onPress={takeOver} style={{ flex: 1 }} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
});
