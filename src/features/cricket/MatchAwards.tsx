import { StyleSheet, Text, View } from 'react-native';

import type { CricketAward, CricketMatchAwards } from '@/api/types';
import { Deck } from '@/components/Card';
import Icon, { type IconName } from '@/components/Icon';
import SectionHeader from '@/components/SectionHeader';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// A finished match's honours, under the result: player of the match (the most fantasy points on
// the winning side) as the headline, then the best batter, bowler and fielder of the day. The
// server decides every one of them on the same points as the tournament's MVP race.

export default function MatchAwards({ awards }: { awards: CricketMatchAwards }) {
  const theme = useSportTheme();
  const potm = awards.playerOfMatch;
  const rows: { key: string; label: string; icon: IconName; award: CricketAward | null }[] = [
    { key: 'bat', label: 'Best batter', icon: 'cricket', award: awards.bestBatter },
    { key: 'bowl', label: 'Best bowler', icon: 'baseball', award: awards.bestBowler },
    { key: 'field', label: 'Best fielder', icon: 'hand-back-right', award: awards.bestFielder },
  ];
  const shown = rows.filter((r) => r.award);
  if (!potm && shown.length === 0) return null;

  return (
    <View style={{ gap: space.md }}>
      <SectionHeader eyebrow="Match honours" title="Top performers" />

      {potm && (
        <Deck
          style={{ gap: space.xs }}
          accessibilityLabel={`Player of the match: ${potm.playerName}, ${potm.teamName}. ${potm.summary}. ${potm.points} points`}
        >
          <View style={styles.headRow}>
            <Icon name="trophy" size={18} color={theme.accent} />
            <Text style={[type.board, { color: theme.accent, flex: 1 }]}>PLAYER OF THE MATCH</Text>
            <Points value={potm.points} />
          </View>
          <Text style={[styles.potmName, { color: theme.onDark }]} numberOfLines={1} adjustsFontSizeToFit>
            {potm.playerName.toUpperCase()}
          </Text>
          <Text style={[type.bodyStrong, { color: theme.onDarkSoft }]}>
            {potm.teamName} · {potm.summary}
          </Text>
        </Deck>
      )}

      {shown.map(({ key, label, icon, award }) => (
        <View
          key={key}
          style={[styles.row, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}
          accessible
          accessibilityLabel={`${label}: ${award!.playerName}, ${award!.teamName}. ${award!.summary}. ${award!.points} points`}
        >
          <View style={[styles.iconWell, { backgroundColor: theme.deckRaised }]}>
            <Icon name={icon} size={20} color={theme.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.caption, { color: theme.onDarkSoft }]}>{label}</Text>
            <Text style={[type.lead, { color: theme.onDark }]} numberOfLines={1}>
              {award!.playerName}
            </Text>
            <Text style={[type.caption, { color: theme.onDarkSoft }]} numberOfLines={1}>
              {award!.teamName} · {award!.summary}
            </Text>
          </View>
          <Points value={award!.points} />
        </View>
      ))}
    </View>
  );
}

function Points({ value }: { value: number }) {
  const theme = useSportTheme();
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[type.figure, { color: theme.accent }]}>{value}</Text>
      <Text style={[type.caption, { color: theme.onDarkSoft }]}>pts</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  potmName: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.lg, borderWidth: 1, padding: space.md },
  iconWell: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
