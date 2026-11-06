import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import type { ActivityItem } from '@/api/types';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import Icon, { type IconName } from '@/components/Icon';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// What happened, newest first, in the server's words. Weight follows importance: an ordinary ball
// is a quiet line, a boundary stands out, a wicket is a card with its red ball (red is only ever a
// wicket or a red card), a fifty is a panel of its own, and the end of every over draws a rule
// across the feed so it reads in overs. The glass theme draws the balls as the scorer's "This over"
// does and writes the server's capitals ("SIX") in sentence case. Football uses the same grammar: goals, cards and subs are
// cards, the periods are rules, clock stoppages are quiet lines.
//
// Lines that arrive while the screen is open drop in; the ones already there just appear.

const ENTER = FadeInDown.duration(220);

type Props = {
  items: ActivityItem[];
  sport: 'football' | 'cricket';
  hasMore: boolean;
  loadingMore: boolean;
  moreError: Error | null;
  onLoadMore: () => void;
};

export default function ActivityFeed({ items, sport, hasMore, loadingMore, moreError, onLoadMore }: Props) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const [seenUpTo] = useState(() => items.reduce((m, i) => Math.max(m, i.id), 0));

  if (items.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: theme.borderOnDark }]}>
        <Icon name={sport === 'cricket' ? 'cricket' : 'soccer'} size={28} color={theme.onDarkSoft} />
        <Text style={[type.body, { color: theme.onDarkSoft, textAlign: 'center' }]}>
          {sport === 'cricket' ? 'Nothing yet. Every ball appears here.' : 'Nothing yet. Goals, cards and subs appear here.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {items.map((item) => (
        <Animated.View key={item.id} entering={item.id > seenUpTo ? ENTER : undefined}>
          <Row item={item} />
        </Animated.View>
      ))}
      <ErrorBanner message={moreError?.message} />
      {hasMore && (
        <Button
          label={sport === 'cricket' ? 'Earlier overs' : 'Earlier in the match'}
          icon="chevron-down"
          variant="ghost"
          busy={loadingMore}
          onPress={onLoadMore}
        />
      )}
    </View>
  );
}

function Row({ item }: { item: ActivityItem }) {
  switch (item.kind) {
    case 'Dot':
    case 'Run':
    case 'Extra':
    case 'Four':
    case 'Six':
      return <BallRow item={item} />;
    case 'Wicket':
      return <WicketCard item={item} />;
    case 'Milestone':
      return <Milestone item={item} />;
    case 'OverEnd':
    case 'Period':
      return <Rule item={item} />;
    case 'Result':
      return <Result item={item} />;
    case 'Goal':
    case 'YellowCard':
    case 'SecondYellow':
    case 'RedCard':
    case 'Substitution':
      return <EventCard item={item} />;
    case 'Innings':
    case 'Toss':
      return <Section item={item} />;
    default:
      return <Quiet item={item} />;
  }
}

/** "Patil to Desai, FOUR" → what happened leads, who was involved follows. */
/** The server's "SIX" or "FOUR" in the glass theme's sentence case; everything else as written. */
function sentence(text: string) {
  return text === text.toUpperCase() && /[A-Z]{3}/.test(text) ? text.charAt(0) + text.slice(1).toLowerCase() : text;
}

function split(text: string): { what: string; who: string | null } {
  const at = text.indexOf(', ');
  return at < 0 ? { what: text, who: null } : { what: text.slice(at + 2), who: text.slice(0, at) };
}

function BallChip({ label, tone }: { label: string; tone: 'quiet' | 'extra' | 'boundary' | 'wicket' }) {
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  // Light: the same ball types as the scorer's "This over" — rings, not fills.
  if (theme.mode === 'light') {
    const six = tone === 'boundary' && /6/.test(label);
    const look = {
      quiet: { bg: 'transparent', border: theme.fieldBorder, fg: theme.ink },
      extra: { bg: theme.chip, border: theme.chip, fg: theme.extraInk },
      boundary: six ? { bg: theme.tint, border: theme.accent, fg: theme.deep } : { bg: 'transparent', border: theme.ring, fg: theme.deep },
      wicket: { bg: theme.dangerTint, border: theme.dangerSolid, fg: theme.dangerInk },
    }[tone];
    return (
      <View style={[styles.chip, { backgroundColor: look.bg, borderColor: look.border }]}>
        <Text style={[styles.chipText, { color: look.fg, fontSize: label.length > 2 ? 12 : 15 }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }
  // Glass: the same beads as the scorer's "This over".
  const six = tone === 'boundary' && /6/.test(label);
  const look = {
    quiet: { bg: 'rgba(255,255,255,0.10)', ring: 'transparent', fg: theme.onDark },
    extra: { bg: 'rgba(255,255,255,0.16)', ring: 'transparent', fg: theme.extraInk },
    boundary: six ? { bg: theme.accent, ring: 'transparent', fg: theme.accentInk } : { bg: 'transparent', ring: theme.accent, fg: theme.accent },
    wicket: { bg: theme.dangerSolid, ring: 'transparent', fg: '#FFFFFF' },
  }[tone];
  return (
    <View style={[styles.chip, styles.glassChip, { backgroundColor: look.bg, borderColor: look.ring }]}>
      <Text style={[styles.chipText, { color: look.fg, fontSize: label.length > 2 ? 12 : 15 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function BallRow({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const boundary = item.kind === 'Four' || item.kind === 'Six';
  const glass = theme.mode === 'dark';
  const parts = split(item.text);
  const what = glass ? sentence(parts.what) : parts.what;
  const who = parts.who;
  return (
    <View
      style={[styles.ball, boundary && !glass && { backgroundColor: theme.accentSoft, borderLeftColor: theme.accent }]}
      accessible
      accessibilityLabel={`${item.marker ?? ''} ${item.text}${item.detail ? `. ${item.detail}` : ''}`}
    >
      <Text style={[styles.marker, glass && styles.glassMarker, { color: boundary && !glass ? theme.deep : theme.onDarkSoft }]}>{item.marker}</Text>
      <BallChip label={item.chip ?? '·'} tone={boundary ? 'boundary' : item.kind === 'Extra' ? 'extra' : 'quiet'} />
      <View style={{ flex: 1 }}>
        <Text style={[boundary && !glass ? styles.boundaryWhat : type.bodyStrong, { color: boundary && !glass ? theme.deep : theme.onDark }]} numberOfLines={2}>
          {what}
        </Text>
        {who ? (
          <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
            {who}
          </Text>
        ) : null}
        {item.detail ? <Text style={[type.caption, { color: theme.accent }]}>{item.detail}</Text> : null}
      </View>
    </View>
  );
}

function WicketCard({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const { who } = split(item.text);
  return (
    <View
      style={[styles.card, { backgroundColor: theme.cream, borderLeftColor: theme.dangerSolid, borderBottomColor: theme.deck }, theme.mode === 'light' ? [styles.lightCard, { borderBottomColor: theme.cardDivider }] : styles.glassCard]}
      accessible
      accessibilityLabel={`${item.marker ?? ''} Wicket. ${item.detail ?? ''}. ${who ?? ''}`}
    >
      <Text style={[styles.marker, theme.mode === 'dark' && styles.glassMarker, { color: theme.muted }]}>{item.marker}</Text>
      <BallChip label={item.chip ?? 'W'} tone="wicket" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[theme.mode === 'dark' ? type.lead : styles.wicketWord, { color: theme.mode === 'dark' ? theme.onDark : theme.dangerSolid }]}>{'Wicket'}</Text>
        {item.detail ? (
          <Text style={[type.lead, { color: theme.ink }]}>{item.detail}</Text>
        ) : null}
        {who ? <Text style={[type.caption, { color: theme.muted }]}>{who}</Text> : null}
      </View>
    </View>
  );
}

function Milestone({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={[styles.milestone, { backgroundColor: theme.deck, borderColor: theme.accent }, theme.mode === 'dark' && styles.glassCard]} accessible accessibilityLabel={`${item.text}. ${item.detail ?? ''}`}>
      <Icon name="star-four-points" size={22} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.milestoneText, { color: theme.accent }]}>{item.text}</Text>
        {item.detail ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{item.detail}</Text> : null}
      </View>
    </View>
  );
}

/** End of an over, or a football period: a rule across the feed, in board lettering. */
function Rule({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={styles.rule} accessible accessibilityLabel={`${item.marker ?? ''} ${item.text}. ${item.detail ?? ''}`}>
      <View style={styles.ruleRow}>
        <View style={[styles.hair, { backgroundColor: theme.borderOnDark }]} />
        <Text style={[type.board, { color: theme.onDark, textAlign: 'center', flexShrink: 1 }]}>
          {item.marker && item.kind === 'Period' ? `${item.marker} · ` : ''}
          {item.text}
        </Text>
        <View style={[styles.hair, { backgroundColor: theme.borderOnDark }]} />
      </View>
      {item.detail ? <Text style={[type.caption, { color: theme.onDarkSoft, textAlign: 'center' }]}>{item.detail}</Text> : null}
    </View>
  );
}

function Result({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={[styles.result, { backgroundColor: theme.deck, borderColor: theme.accentSoft }]} accessible accessibilityLabel={`${item.text}. ${item.detail ?? ''}`}>
      <Icon name="trophy" size={22} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[type.heading, { color: theme.accent }]}>{item.text}</Text>
        {item.detail ? <Text style={[type.body, { color: theme.onDarkSoft }]}>{item.detail}</Text> : null}
      </View>
    </View>
  );
}

/** Goals, cards and substitutions: a chalk card with the minute in a block and an edge in the event's colour. */
function EventCard({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  // Light: a row with a thin coloured edge, the minute as a plain figure.
  const light = theme.mode === 'light';
  const look: Record<string, { edge: string; icon: IconName; iconColor: string }> = {
    Goal: { edge: theme.accent, icon: 'soccer', iconColor: light ? theme.deep : theme.warnInk },
    YellowCard: { edge: theme.yellowCard, icon: 'card', iconColor: theme.yellowCard },
    SecondYellow: { edge: theme.dangerSolid, icon: 'card', iconColor: theme.dangerSolid },
    RedCard: { edge: theme.dangerSolid, icon: 'card', iconColor: theme.dangerSolid },
    Substitution: { edge: theme.successSolid, icon: 'swap-horizontal', iconColor: theme.successInk },
  };
  const { edge, icon, iconColor } = look[item.kind] ?? look.Goal;
  return (
    <View
      style={[styles.card, { backgroundColor: theme.cream, borderLeftColor: edge, borderBottomColor: theme.deck }, light ? [styles.lightCard, { borderBottomColor: theme.cardDivider }] : styles.glassCard]}
      accessible
      accessibilityLabel={`${item.marker ?? ''} ${item.text}. ${item.detail ?? ''}`}
    >
      <View style={[styles.minute, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.minuteText, !light && styles.glassMarker, { color: light ? theme.ink : theme.onDarkSoft }]}>{item.marker}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Icon name={icon} size={16} color={iconColor} />
          <Text style={[type.lead, { color: theme.ink, flexShrink: 1 }]}>{item.text}</Text>
        </View>
        {item.detail ? <Text style={[type.caption, { color: theme.muted }]}>{item.detail}</Text> : null}
      </View>
      {item.chip ? <Text style={[styles.goalScore, { color: theme.deep }]}>{item.chip}</Text> : null}
    </View>
  );
}

function Section({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.surfaceOnDark, borderColor: theme.borderOnDark }]} accessible accessibilityLabel={item.text}>
      <Icon name={item.kind === 'Toss' ? 'circle-half-full' : 'cricket'} size={18} color={theme.accent} />
      <Text style={[type.bodyStrong, { color: theme.onDark, flex: 1 }]}>{item.text}</Text>
    </View>
  );
}

/** Corrections, rain, clock stoppages, shootout kicks: worth a line, no colour. */
function Quiet({ item }: { item: ActivityItem }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const icon: IconName =
    item.kind === 'Penalty' ? (item.text.endsWith('scores') ? 'soccer' : 'close-circle-outline') : item.kind === 'Clock' ? 'timer-outline' : 'information-outline';
  return (
    <View style={styles.quiet} accessible accessibilityLabel={`${item.marker ?? ''} ${item.text}. ${item.detail ?? ''}`}>
      <Text style={[styles.marker, { color: theme.onDarkSoft }]}>{item.marker}</Text>
      <Icon name={icon} size={16} color={theme.onDarkSoft} />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: theme.onDarkSoft }]}>{item.text}</Text>
        {item.detail ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{item.detail}</Text> : null}
      </View>
      {item.chip ? <Text style={[type.figure, { color: theme.onDark }]}>{item.chip}</Text> : null}
    </View>
  );
}

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  lightCard: { backgroundColor: 'transparent', borderRadius: 0, borderLeftWidth: 2, borderBottomWidth: 1 },
  /** Glass: a frosted row — no coloured edge, no lip; the ball or icon says what it was. */
  glassCard: { borderRadius: 20, borderCurve: 'continuous', borderLeftWidth: 0, borderBottomWidth: 0, paddingLeft: space.md },
  glassMarker: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  glassChip: { borderWidth: 2 },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg },
  ball: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingVertical: space.xs,
    paddingRight: space.md,
    borderRadius: radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  marker: { width: 40, textAlign: 'right', fontFamily: fonts.condensed, fontSize: 18, lineHeight: 20, fontVariant: figures },
  chip: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fonts.display, fontVariant: figures },
  boundaryWhat: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: 0.5 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    padding: space.md,
    paddingLeft: space.sm,
    borderLeftWidth: 5,
    borderBottomWidth: 2,
  },
  wicketWord: { fontFamily: fonts.condensed, fontSize: 18, lineHeight: 20, letterSpacing: 2 },
  milestone: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, borderWidth: 1.5, padding: space.md },
  milestoneText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24 },
  rule: { gap: 2, paddingVertical: space.sm },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hair: { flex: 1, height: StyleSheet.hairlineWidth, minWidth: 16 },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.xl, borderWidth: 1, padding: space.lg },
  minute: { borderRadius: radius.md, minWidth: 52, paddingHorizontal: space.sm, paddingVertical: space.sm, alignItems: 'center' },
  minuteText: { fontFamily: fonts.display, fontSize: 18, fontVariant: figures },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goalScore: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, fontVariant: figures },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.lg, borderWidth: 1, padding: space.md },
  quiet: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 40, paddingRight: space.md },
});
