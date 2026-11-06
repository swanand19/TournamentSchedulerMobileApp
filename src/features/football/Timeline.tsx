import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { FootballMatch, MatchEvent } from '@/api/types';
import Icon, { type IconName } from '@/components/Icon';
import { playerIndex, playerLabel } from '@/features/football/useFootballMatch';
import { minuteLabel } from '@/lib/format';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// The match as it happened, newest first. Goals, cards and subs are cards the eye stops on;
// clock and period bookkeeping are single quiet lines.
//
// An event recorded while the screen is open drops in (the scorer's confirmation that it landed);
// events already there when the screen opened just appear — no list-wide entrance on every visit.

const ENTER = FadeInDown.duration(220);

const PERIOD = ['1st half', '2nd half', 'Extra time 1st half', 'Extra time 2nd half'];

export default function Timeline({ match, events }: { match: FootballMatch; events: MatchEvent[] }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const players = playerIndex(match);
  // Light: no cards — each event a row with a thin coloured edge, the minute in thin figures.
  const light = theme.mode === 'light';
  // The newest id present on first render; anything after it is new while we watched.
  const [seenUpTo] = useState(() => events.reduce((m, e) => Math.max(m, e.id), 0));

  const teamName = (teamId: number | null) =>
    teamId === match.homeTeamId ? match.homeTeamName : teamId === match.awayTeamId ? match.awayTeamName : '';

  // Walk forward once to know which half each event is in and which yellow was a second one.
  let halves = 0;
  const yellows = new Map<number, number>();
  const rows = events.map((e) => {
    if (e.eventType === 'HalfStart') halves++;
    let secondYellow = false;
    if (e.eventType === 'YellowCard' && e.playerId) {
      const n = (yellows.get(e.playerId) ?? 0) + 1;
      yellows.set(e.playerId, n);
      secondYellow = n >= 2;
    }
    return { e, period: PERIOD[Math.max(0, halves - 1)] ?? `Period ${halves}`, secondYellow };
  });

  if (rows.length === 0) {
    return <Text style={[type.body, { color: theme.onDarkSoft }]}>Nothing yet — goals, cards and subs appear here.</Text>;
  }

  return (
    <View style={{ gap: space.sm }}>
      {rows.reverse().map(({ e, period, secondYellow }) => {
        const minute = minuteLabel(e.minuteOfMatch, e.stoppageMinute);
        const team = teamName(e.teamId);
        const tag = team ? (light ? ` · ${team}` : `, ${team}`) : '';
        const fresh = e.id > seenUpTo;

        let major: { icon: IconName; iconColor: string; title: string; who: string; detail?: string; edge: string } | null = null;
        let minor: { icon: IconName; text: string } | null = null;

        switch (e.eventType) {
          case 'Goal':
            major = {
              icon: 'soccer',
              iconColor: light ? theme.deep : theme.warnInk,
              title: `Goal${tag}`,
              who: e.playerId ? playerLabel(players.get(e.playerId)) : 'Own goal / unknown scorer',
              detail: e.relatedPlayerId ? `Assist: ${playerLabel(players.get(e.relatedPlayerId))}` : undefined,
              edge: theme.accent,
            };
            break;
          case 'YellowCard':
            major = {
              icon: 'card',
              iconColor: secondYellow ? theme.dangerSolid : theme.yellowCard,
              title: secondYellow ? `Second yellow${tag}` : `Yellow card${tag}`,
              who: playerLabel(players.get(e.playerId ?? -1)),
              detail: secondYellow ? 'Sent off' : undefined,
              edge: secondYellow ? theme.dangerSolid : theme.yellowCard,
            };
            break;
          case 'RedCard':
            major = {
              icon: 'card',
              iconColor: theme.dangerSolid,
              title: `Red card${tag}`,
              who: playerLabel(players.get(e.playerId ?? -1)),
              detail: 'Sent off',
              edge: theme.dangerSolid,
            };
            break;
          case 'SubstitutionIn':
            major = {
              icon: 'swap-horizontal',
              iconColor: theme.successInk,
              title: `Substitution${tag}`,
              who: `On: ${playerLabel(players.get(e.relatedPlayerId ?? -1))}`,
              detail: `Off: ${playerLabel(players.get(e.playerId ?? -1))}`,
              edge: theme.successSolid,
            };
            break;
          case 'PenaltyKick':
            major = {
              icon: e.penaltyScored ? 'soccer' : 'close-circle-outline',
              iconColor: e.penaltyScored ? theme.successInk : theme.muted,
              title: `Penalty${tag}`,
              who: `${e.playerId ? playerLabel(players.get(e.playerId)) : 'Taker'} — ${e.penaltyScored ? 'scored' : 'missed'}`,
              detail: `Shootout ${e.penaltyHomeScoreAfter ?? 0}–${e.penaltyAwayScoreAfter ?? 0}`,
              edge: e.penaltyScored ? theme.successSolid : theme.cardDivider,
            };
            break;
          case 'HalfStart':
            minor = { icon: 'whistle', text: `Kick-off · ${period}` };
            break;
          case 'HalfEnd':
            minor = { icon: 'whistle', text: `Whistle · end of ${period}` };
            break;
          case 'ExtraTimeStart':
            minor = { icon: 'timer-plus-outline', text: 'Extra time begins' };
            break;
          case 'ExtraTimeAdded':
            minor = { icon: 'timer-plus-outline', text: 'Stoppage time added' };
            break;
          case 'ClockPaused':
            minor = { icon: 'pause', text: 'Play stopped' };
            break;
          case 'ClockResumed':
            minor = { icon: 'play', text: 'Play resumed' };
            break;
          case 'PenaltyShootoutStarted':
            minor = { icon: 'bullseye-arrow', text: 'Penalty shootout begins' };
            break;
          case 'MatchCompleted':
            minor = { icon: 'flag-checkered', text: 'Full time' };
            break;
          case 'MatchAbandoned':
            minor = { icon: 'cancel', text: e.teamId ? `Match awarded to ${teamName(e.teamId)}` : 'Match abandoned' };
            break;
          default:
            minor = null;
        }

        if (major) {
          return (
            <Animated.View
              key={e.id}
              entering={fresh ? ENTER : undefined}
              // Glass: a frosted row — the minute quiet on the left, then what happened and who.
              style={[styles.card, { backgroundColor: theme.cream, borderLeftColor: major.edge }, light ? styles.lightCard : styles.glassCard]}
              accessible
              accessibilityLabel={`${minute} ${major.title}. ${major.who}. ${major.detail ?? ''}`}
            >
              <View style={[styles.minute, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.minuteText, { color: light ? theme.ink : theme.onDarkSoft }, light ? styles.lightMinute : styles.glassMinute]}>
                  {minute}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.titleRow}>
                  <Icon name={major.icon} size={16} color={major.iconColor} />
                  <Text style={[styles.title, { color: light ? theme.muted : theme.onDark }, light && styles.lightTitle]} numberOfLines={1}>
                    {major.title}
                  </Text>
                </View>
                <Text style={[type.lead, { color: theme.ink }]} numberOfLines={1}>
                  {major.who}
                </Text>
                {major.detail ? <Text style={[type.caption, { color: theme.muted }]}>{major.detail}</Text> : null}
              </View>
            </Animated.View>
          );
        }
        if (!minor) return null;
        return (
          <Animated.View key={e.id} entering={fresh ? ENTER : undefined} style={styles.minor} accessible accessibilityLabel={`${minute} ${minor.text}`}>
            <Text style={[styles.minorMinute, { color: theme.onDarkSoft }]}>{minute}</Text>
            <Icon name={minor.icon} size={16} color={light ? theme.muted : theme.accent} />
            <Text style={[light ? type.body : type.bodyStrong, { color: theme.onDarkSoft, flex: 1 }]}>{minor.text}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, padding: space.md, borderLeftWidth: 5 },
  minute: { borderRadius: radius.md, minWidth: 52, paddingHorizontal: space.sm, paddingVertical: space.sm, alignItems: 'center' },
  minuteText: { fontFamily: fonts.display, fontSize: 20, fontVariant: figures },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: 13, flexShrink: 1 },
  minor: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, minHeight: 32 },
  minorMinute: { fontFamily: fonts.display, fontSize: 15, minWidth: 52, textAlign: 'center' },
  lightCard: { borderRadius: 0, borderLeftWidth: 2, paddingVertical: space.sm, paddingLeft: space.sm },
  glassCard: { borderRadius: 20, borderCurve: 'continuous', borderLeftWidth: 0, paddingVertical: space.md },
  glassMinute: { fontFamily: fonts.bodySemiBold, fontSize: 15 },
  lightMinute: { fontSize: 24 },
  lightTitle: { fontFamily: fonts.body },
});
