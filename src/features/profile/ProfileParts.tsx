import { StyleSheet, Text, View } from 'react-native';

import type { CareerTeam, CareerTournament, Honour, ProfileStat, SportCard } from '@/api/types';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import StatusChip from '@/components/StatusChip';
import { initials, plural } from '@/lib/format';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { useThemeMode } from '@/theme/appearance';
import { radius, space, themeFor, type Typography } from '@/theme/theme';

// The pieces of the profile screens, from the "Profile & Career Stats" designs. Every figure comes
// from the server already worded (label, value, a short supporting line), so these only lay it out.

// ---------------------------------------------------------------------------------------------
// Base profile: one card per sport

export function SportSlice({ card, onPress }: { card: SportCard; onPress: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = themeFor(card.sport, useThemeMode());
  const played = card.matches > 0 || card.tournaments > 0;

  // Light ("B · Profile"): a row between hairlines — the sport's dot and name, "Career" in its ink,
  // then the headline figures drawn thin.
  if (theme.mode === 'light') {
    const summary = card.headline.map((h) => `${h.value} ${h.label.toLowerCase()}`).join(', ');
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${theme.label} profile: ${played ? plural(card.matches, 'match', 'matches') : 'no matches yet'}${summary ? `, ${summary}` : ''}`}
        style={[styles.lightSlice, { borderBottomColor: theme.cardDivider }]}
      >
        <View style={[styles.sliceTop, styles.lightSliceTop]}>
          <View style={[styles.lightDot, { backgroundColor: theme.accent }]} />
          <Text style={[type.lead, { color: theme.ink, flex: 1, fontSize: 18 }]}>{theme.label}</Text>
          <Text style={[type.body, { color: theme.deep }]}>Career</Text>
          <Icon name="chevron-right" size={18} color={theme.deep} />
        </View>
        {played && card.headline.length > 0 ? (
          <View style={styles.sliceFigures}>
            {card.headline.map((h) => (
              <View key={h.key} style={{ flex: 1 }}>
                <Text style={[styles.sliceFigure, styles.lightFigure, { color: theme.ink }]}>{h.value}</Text>
                <Text style={[type.caption, { color: theme.muted }]}>{h.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[type.caption, { color: theme.muted }]}>
            {played ? `${plural(card.matches, 'match', 'matches')} in ${plural(card.tournaments, 'tournament')}` : `No ${theme.label.toLowerCase()} matches yet`}
          </Text>
        )}
      </PressableScale>
    );
  }

  // Glass ("N · Profile"): a frosted pane in the sport's own tint — its name, how much was played,
  // and the headline figures spread evenly across the width.
  const summary = card.headline.map((h) => `${h.value} ${h.label.toLowerCase()}`).join(', ');
  const figuresShown = played && card.headline.length > 0;
  const columns = [{ key: 'matches', label: 'Matches', value: String(card.matches) }, ...card.headline];
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${theme.label} profile: ${played ? plural(card.matches, 'match', 'matches') : 'no matches yet'}${summary ? `, ${summary}` : ''}`}
      style={[styles.slice, { backgroundColor: theme.cream }]}
    >
      <View style={styles.sliceTop}>
        <Text style={[type.lead, { color: theme.onDark, flex: 1 }]}>{theme.label}</Text>
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>
          {played ? `${plural(card.matches, 'match', 'matches')} in ${plural(card.tournaments, 'tournament')}` : 'No matches yet'}
        </Text>
        <Icon name="chevron-right" size={18} color={theme.onDarkSoft} />
      </View>
      {figuresShown ? (
        <View style={styles.sliceFigures}>
          {columns.map((h) => (
            <View key={h.key} style={styles.sliceColumn}>
              <Text style={[styles.sliceFigure, { color: theme.onDark }]}>{h.value}</Text>
              <Text style={[type.caption, { color: theme.onDarkSoft }]}>{h.label}</Text>
            </View>
          ))}
        </View>
      ) : played ? (
        <Text style={[type.body, { color: theme.onDarkSoft }]}>Figures appear once a match is completed</Text>
      ) : null}
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------------------------
// Sport profile: tabs, the headline figure and the tiles

export { default as UnderlineTabs } from '@/components/UnderlineTabs';

/** The one big figure that leads a stats page — goals, runs, wickets, catches. */
export function HeroStat({ stat, icon }: { stat: ProfileStat; icon?: IconName }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={[styles.hero, { backgroundColor: theme.deck }, theme.mode === 'dark' && { borderRadius: 28 }]} accessible accessibilityLabel={`${stat.label}: ${stat.value}${stat.sub ? `, ${stat.sub}` : ''}`}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: theme.onDarkSoft }]}>{stat.label}</Text>
        <Text style={[styles.heroValue, { color: theme.accent }]}>{stat.value}</Text>
        {stat.sub ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{stat.sub}</Text> : null}
      </View>
      {icon ? <Icon name={icon} size={84} color={theme.borderOnDark} /> : null}
    </View>
  );
}

/** A figure on a tile. Booking counts carry the card's own colour, so they read at a glance. */
export function StatTile({ stat, dim }: { stat: ProfileStat; dim?: boolean }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const card = stat.key === 'yellowCards' ? theme.yellowCard : stat.key === 'redCards' ? theme.redCard : null;
  return (
    <View
      style={[styles.tile, { backgroundColor: theme.deck }, pane(theme)]}
      accessible
      accessibilityLabel={`${stat.label}: ${stat.value}${stat.sub ? `, ${stat.sub}` : ''}`}
    >
      <View style={styles.tileLabelRow}>
        {card ? <View style={[styles.cardGlyph, { backgroundColor: card }]} /> : null}
        <Text style={[type.caption, { color: theme.onDarkSoft, flexShrink: 1 }]}>{stat.label}</Text>
      </View>
      <Text style={[styles.tileValue, { color: dim ? theme.onDarkSoft : theme.onDark }]} numberOfLines={1} adjustsFontSizeToFit>
        {stat.value}
      </Text>
      {stat.sub ? (
        <Text style={[type.caption, styles.faint, { color: theme.onDarkSoft }]} numberOfLines={1}>
          {stat.sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Shootout kicks as a row of balls: scored ones filled. The server sends counts, not the order. */
export function ShootoutTile({ stat }: { stat: ProfileStat }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const scored = Number(stat.value) || 0;
  const taken = Number(/of (\d+) taken/.exec(stat.sub ?? '')?.[1] ?? scored);
  const balls = Math.min(taken, 10);
  return (
    <View style={[styles.tile, styles.wideTile, { backgroundColor: theme.deck }, pane(theme)]} accessible accessibilityLabel={`${stat.label}: ${stat.value}${stat.sub ? ` ${stat.sub}` : ''}`}>
      <View style={{ flex: 1 }}>
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>{stat.label}</Text>
        <View style={styles.inline}>
          <Text style={[styles.tileValue, { color: theme.onDark }]}>{stat.value}</Text>
          {stat.sub ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{stat.sub}</Text> : null}
        </View>
      </View>
      <View style={styles.kicks}>
        {Array.from({ length: balls }, (_, i) => (
          <View key={i} style={[styles.kick, i < scored ? { backgroundColor: theme.accent } : { borderWidth: 2, borderColor: theme.onDarkSoft }]} />
        ))}
      </View>
    </View>
  );
}

/** The honours summary: two or three counts side by side. */
export function HonourBand({ stats }: { stats: ProfileStat[] }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={[styles.band, { backgroundColor: theme.deck }, theme.mode === 'dark' && { borderRadius: radius.glass }]}>
      {stats.map((s, i) => (
        <View
          key={s.key}
          style={[styles.bandCell, i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.borderOnDark }]}
          accessible
          accessibilityLabel={`${s.label}: ${s.value}`}
        >
          <Text style={[styles.bandValue, { color: i === 0 ? theme.accent : theme.onDark }]}>{s.value}</Text>
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Lists

const STATUS_TONE = { Live: 'live', Completed: 'done', Upcoming: 'setup', Cancelled: 'done' } as const;

export function TeamRow({ team, onPress }: { team: CareerTeam; onPress?: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <PressableScale
      onPress={onPress ?? (() => {})}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${team.teamName}${team.isCaptain ? ', captain' : ''}, ${team.tournamentName}, ${plural(team.matches, 'match', 'matches')}, ${team.tournamentStatus}`}
      style={[styles.row, { backgroundColor: theme.deck }, pane(theme)]}
    >
      <View style={styles.shirt}>
        <Icon name="tshirt-crew" size={52} color={theme.deckRaised} />
        <Text style={[styles.shirtText, { color: theme.accent }]}>{initials(team.teamName)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.inline}>
          <Text style={[type.lead, { color: theme.onDark, flexShrink: 1 }]} numberOfLines={1}>
            {team.teamName}
          </Text>
          {team.isCaptain ? (
            <View style={[styles.captain, { backgroundColor: theme.accent }]}>
              <Text style={[type.label, { color: theme.accentInk }]}>Captain</Text>
            </View>
          ) : null}
        </View>
        <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
          {team.tournamentName}
        </Text>
        <View style={styles.inline}>
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>{plural(team.matches, 'match', 'matches')}</Text>
          <StatusChip label={team.tournamentStatus} tone={STATUS_TONE[team.tournamentStatus] ?? 'done'} onDark />
        </View>
      </View>
      {onPress ? <Icon name="chevron-right" size={22} color={theme.onDarkSoft} /> : null}
    </PressableScale>
  );
}

export function TournamentRow({ item, dates, onPress }: { item: CareerTournament; dates: string; onPress?: () => void }) {
  const { type, fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const figures: ProfileStat[] = [{ key: 'matches', label: 'Matches', value: String(item.matches), sub: null }, ...item.highlights];
  return (
    <PressableScale
      onPress={onPress ?? (() => {})}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${item.status}, played for ${item.teamName}. ${figures.map((f) => `${f.label} ${f.value}`).join(', ')}`}
      style={[styles.row, styles.tournament, { backgroundColor: theme.deck }, pane(theme)]}
    >
      <View style={styles.inline}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.lead, { color: theme.onDark }]} numberOfLines={2}>
            {item.name}
          </Text>
          {dates ? <Text style={[type.caption, { color: theme.onDarkSoft }]}>{dates}</Text> : null}
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>
            Played for <Text style={{ color: theme.onDark, fontFamily: fonts.bodySemiBold }}>{item.teamName}</Text>
          </Text>
        </View>
        <StatusChip label={item.status} tone={STATUS_TONE[item.status] ?? 'done'} onDark />
      </View>
      <View style={[styles.figures, { borderTopColor: theme.borderOnDark }]}>
        {figures.map((f, i) => (
          <View key={f.key} style={{ flex: 1 }}>
            <Text style={[styles.rowFigure, { color: i === 1 ? theme.accent : theme.onDark }]}>{f.value}</Text>
            <Text style={[type.caption, { color: theme.onDarkSoft }]}>{f.label}</Text>
          </View>
        ))}
      </View>
    </PressableScale>
  );
}

const HONOUR_ICON: Record<string, IconName> = {
  TournamentMvp: 'star',
  PlayerOfMatch: 'medal-outline',
  TopScorer: 'trophy-outline',
  MostAssists: 'trophy-outline',
};

export function HonourRow({ honour, when }: { honour: Honour; when: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const solid = honour.kind === 'TournamentMvp';
  return (
    <View
      style={[styles.row, { backgroundColor: theme.deck, alignItems: 'flex-start' }, pane(theme)]}
      accessible
      accessibilityLabel={`${honour.title}, ${honour.detail}, ${honour.context ?? honour.tournamentName}`}
    >
      <View style={[styles.medal, solid ? { backgroundColor: theme.accent } : { borderWidth: 2, borderColor: theme.accent }]}>
        <Icon name={HONOUR_ICON[honour.kind] ?? 'trophy-outline'} size={22} color={solid ? theme.accentInk : theme.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.lead, { color: theme.onDark }]}>{honour.title}</Text>
        <Text style={[type.bodyStrong, { color: theme.accent }]}>{honour.detail}</Text>
        <Text style={[type.caption, { color: theme.onDarkSoft }]}>{honour.context ?? honour.tournamentName}</Text>
        {when ? <Text style={[type.caption, styles.faint, { color: theme.onDarkSoft }]}>{when}</Text> : null}
      </View>
    </View>
  );
}

const makeStyles = ({ figures, fonts }: Typography) => StyleSheet.create({
  slice: { borderRadius: radius.glass, borderCurve: 'continuous', padding: space.lg, gap: space.md },
  sliceTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sliceFigures: { flexDirection: 'row', gap: 28 },
  sliceColumn: { flex: 1, alignItems: 'center' },
  sliceFigure: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, fontVariant: figures },
  lightSlice: { gap: space.md, paddingVertical: space.lg, borderBottomWidth: 1 },
  lightSliceTop: { alignItems: 'center', gap: 10 },
  lightDot: { width: 8, height: 8, borderRadius: 4 },
  lightFigure: { fontSize: 30, lineHeight: 34 },
  hero: { borderRadius: radius.xl, paddingVertical: space.lg, paddingHorizontal: space.lg + 2, flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' },
  heroValue: { fontFamily: fonts.display, fontSize: 76, lineHeight: 82, fontVariant: figures },
  tile: { flex: 1, minHeight: 90, borderRadius: radius.lg, borderWidth: 1, paddingVertical: space.md, paddingHorizontal: space.md + 2, gap: 2 },
  wideTile: { flexDirection: 'row', alignItems: 'center', minHeight: 0 },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardGlyph: { width: 9, height: 12, borderRadius: 2 },
  tileValue: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, fontVariant: figures },
  faint: { opacity: 0.85 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kicks: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: 140, justifyContent: 'flex-end' },
  kick: { width: 16, height: 16, borderRadius: 8 },
  band: { flexDirection: 'row', borderRadius: radius.xl, overflow: 'hidden' },
  bandCell: { flex: 1, paddingVertical: space.md + 2, paddingHorizontal: space.md + 2 },
  bandValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, fontVariant: figures },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2, padding: space.md + 2, borderRadius: 14, borderWidth: 1 },
  tournament: { flexDirection: 'column', alignItems: 'stretch', gap: space.md + 2 },
  figures: { flexDirection: 'row', paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  rowFigure: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, fontVariant: figures },
  shirt: { width: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  shirtText: { position: 'absolute', top: 22, fontFamily: fonts.display, fontSize: 15 },
  captain: { paddingHorizontal: 7, height: 20, borderRadius: 5, justifyContent: 'center' },
  medal: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

/** Glass: a frosted pane with the design's big corner and no edge. Light: the white tile's hairline. */
function pane(theme: { mode: string; borderOnDark: string }) {
  return theme.mode === 'dark' ? { borderColor: 'transparent', borderRadius: 20 } : { borderColor: theme.borderOnDark };
}
