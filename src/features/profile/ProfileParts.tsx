import { StyleSheet, Text, View } from 'react-native';

import type { CareerTeam, CareerTournament, Honour, ProfileStat, SportCard } from '@/api/types';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import StatusChip from '@/components/StatusChip';
import { initials, plural } from '@/lib/format';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, themeFor, type, type AppTheme } from '@/theme/theme';

// The pieces of the profile screens, from the "Profile & Career Stats" designs. Every figure comes
// from the server already worded (label, value, a short supporting line), so these only lay it out.

// ---------------------------------------------------------------------------------------------
// Base profile: one card per sport, drawn as a slice of that sport's own pitch

const STRIPE = 44;

/** Faint markings on the right of a sport card: halfway line, centre circle and box; or the cricket strip. */
function PitchMarks({ theme }: { theme: AppTheme }) {
  const line = theme.borderOnDark;
  if (theme.key === 'Cricket') {
    return (
      <View pointerEvents="none" style={styles.marks}>
        <View style={{ position: 'absolute', right: 46, top: 14, bottom: 14, width: 40, borderWidth: 2, borderColor: line, borderRadius: 2 }} />
        <View style={{ position: 'absolute', right: 38, top: 34, width: 56, height: 2, backgroundColor: line }} />
        <View style={{ position: 'absolute', right: 38, bottom: 34, width: 56, height: 2, backgroundColor: line }} />
      </View>
    );
  }
  return (
    <View pointerEvents="none" style={styles.marks}>
      <View style={{ position: 'absolute', right: 70, top: 0, bottom: 0, width: 2, backgroundColor: line }} />
      <View style={{ position: 'absolute', right: 31, top: 42, width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: line }} />
      <View style={{ position: 'absolute', right: -2, top: 42, width: 32, height: 80, borderWidth: 2, borderRightWidth: 0, borderColor: line }} />
    </View>
  );
}

export function SportSlice({ card, onPress }: { card: SportCard; onPress: () => void }) {
  const theme = themeFor(card.sport);
  const played = card.matches > 0 || card.tournaments > 0;

  if (!played) {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${theme.label} profile: no matches yet`}
        style={[styles.unplayed, { borderColor: theme.borderOnDark }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.sliceTitleSmall, { color: theme.onDark }]}>{theme.label.toUpperCase()}</Text>
          <Text style={[type.caption, { color: theme.onDarkSoft }]}>No {theme.label.toLowerCase()} matches yet</Text>
        </View>
        <Icon name="chevron-right" size={22} color={theme.onDarkSoft} />
      </PressableScale>
    );
  }

  const summary = card.headline.map((h) => `${h.value} ${h.label.toLowerCase()}`).join(', ');
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${theme.label} profile: ${plural(card.matches, 'match', 'matches')}${summary ? `, ${summary}` : ''}`}
      style={[styles.slice, { backgroundColor: theme.page }]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={{ width: STRIPE, backgroundColor: theme.stripes[i % 2] }} />
        ))}
      </View>
      <PitchMarks theme={theme} />
      <View style={styles.sliceBody}>
        <View style={styles.sliceTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sliceTitle, { color: theme.onDark }]}>{theme.label.toUpperCase()}</Text>
            <Text style={[type.caption, { color: theme.onDarkSoft }]}>
              {plural(card.matches, 'match', 'matches')} in {plural(card.tournaments, 'tournament')}
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color={theme.accent} />
        </View>
        {card.headline.length > 0 ? (
          <View style={styles.sliceFigures}>
            {card.headline.map((h, i) => (
              <View key={h.key}>
                <Text style={[styles.sliceFigure, { color: i === 0 ? theme.accent : theme.onDark }]}>{h.value}</Text>
                <Text style={[type.caption, { color: theme.onDarkSoft }]}>{h.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[type.body, { color: theme.onDarkSoft }]}>Figures appear once a match is completed</Text>
        )}
      </View>
    </PressableScale>
  );
}

// ---------------------------------------------------------------------------------------------
// Sport profile: tabs, the headline figure and the tiles

export { default as UnderlineTabs } from '@/components/UnderlineTabs';

/** The one big figure that leads a stats page — goals, runs, wickets, catches. */
export function HeroStat({ stat, icon }: { stat: ProfileStat; icon?: IconName }) {
  const theme = useSportTheme();
  return (
    <View style={[styles.hero, { backgroundColor: theme.deck }]} accessible accessibilityLabel={`${stat.label}: ${stat.value}${stat.sub ? `, ${stat.sub}` : ''}`}>
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
  const theme = useSportTheme();
  const card = stat.key === 'yellowCards' ? theme.yellowCard : stat.key === 'redCards' ? theme.redCard : null;
  return (
    <View
      style={[styles.tile, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}
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
  const theme = useSportTheme();
  const scored = Number(stat.value) || 0;
  const taken = Number(/of (\d+) taken/.exec(stat.sub ?? '')?.[1] ?? scored);
  const balls = Math.min(taken, 10);
  return (
    <View style={[styles.tile, styles.wideTile, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]} accessible accessibilityLabel={`${stat.label}: ${stat.value}${stat.sub ? ` ${stat.sub}` : ''}`}>
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
  const theme = useSportTheme();
  return (
    <View style={[styles.band, { backgroundColor: theme.deck }]}>
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
  const theme = useSportTheme();
  return (
    <PressableScale
      onPress={onPress ?? (() => {})}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${team.teamName}${team.isCaptain ? ', captain' : ''}, ${team.tournamentName}, ${plural(team.matches, 'match', 'matches')}, ${team.tournamentStatus}`}
      style={[styles.row, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}
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
  const theme = useSportTheme();
  const figures: ProfileStat[] = [{ key: 'matches', label: 'Matches', value: String(item.matches), sub: null }, ...item.highlights];
  return (
    <PressableScale
      onPress={onPress ?? (() => {})}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${item.status}, played for ${item.teamName}. ${figures.map((f) => `${f.label} ${f.value}`).join(', ')}`}
      style={[styles.row, styles.tournament, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}
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
  const theme = useSportTheme();
  const solid = honour.kind === 'TournamentMvp';
  return (
    <View
      style={[styles.row, { backgroundColor: theme.deck, borderColor: theme.borderOnDark, alignItems: 'flex-start' }]}
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

const styles = StyleSheet.create({
  slice: { height: 164, borderRadius: radius.xl, overflow: 'hidden' },
  marks: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  sliceBody: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  sliceTop: { flexDirection: 'row', alignItems: 'flex-start' },
  sliceTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: 0.5 },
  sliceTitleSmall: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: 0.5 },
  sliceFigures: { flexDirection: 'row', gap: 28 },
  sliceFigure: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, fontVariant: ['tabular-nums'] },
  unplayed: {
    minHeight: 72,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  hero: { borderRadius: radius.xl, paddingVertical: space.lg, paddingHorizontal: space.lg + 2, flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' },
  heroValue: { fontFamily: fonts.display, fontSize: 76, lineHeight: 82, fontVariant: ['tabular-nums'] },
  tile: { flex: 1, minHeight: 90, borderRadius: radius.lg, borderWidth: 1, paddingVertical: space.md, paddingHorizontal: space.md + 2, gap: 2 },
  wideTile: { flexDirection: 'row', alignItems: 'center', minHeight: 0 },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardGlyph: { width: 9, height: 12, borderRadius: 2 },
  tileValue: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] },
  faint: { opacity: 0.85 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  kicks: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', maxWidth: 140, justifyContent: 'flex-end' },
  kick: { width: 16, height: 16, borderRadius: 8 },
  band: { flexDirection: 'row', borderRadius: radius.xl, overflow: 'hidden' },
  bandCell: { flex: 1, paddingVertical: space.md + 2, paddingHorizontal: space.md + 2 },
  bandValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md + 2, padding: space.md + 2, borderRadius: 14, borderWidth: 1 },
  tournament: { flexDirection: 'column', alignItems: 'stretch', gap: space.md + 2 },
  figures: { flexDirection: 'row', paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  rowFigure: { fontFamily: fonts.display, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  shirt: { width: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  shirtText: { position: 'absolute', top: 22, fontFamily: fonts.display, fontSize: 15 },
  captain: { paddingHorizontal: 7, height: 20, borderRadius: 5, justifyContent: 'center' },
  medal: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
