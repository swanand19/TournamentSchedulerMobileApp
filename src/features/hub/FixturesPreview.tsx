import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SavedSchedule } from '@/api/types';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { plural } from '@/lib/format';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space, type } from '@/theme/theme';

// The approved fixtures, read-only, grouped by group then by round (matchday). The first group is
// open; the rest fold away so a long schedule doesn't bury the Start button above it.

export default function FixturesPreview({ schedule }: { schedule: SavedSchedule }) {
  const theme = useSportTheme();
  const groups = [...schedule.groups].sort((a, b) => a.groupName.localeCompare(b.groupName));
  const [open, setOpen] = useState<string | null>(groups[0]?.groupName ?? null);

  return (
    <View style={{ gap: space.sm }}>
      {groups.map((g) => {
        const expanded = open === g.groupName;
        const rounds = [...new Set(g.fixtures.map((f) => f.round))].sort((a, b) => a - b);
        return (
          <View key={g.id} style={[styles.group, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]}>
            <PressableScale
              onPress={() => {
                haptic.select();
                setOpen(expanded ? null : g.groupName);
              }}
              accessibilityState={{ expanded }}
              accessibilityLabel={`Group ${g.groupName}, ${plural(g.fixtures.length, 'fixture')}`}
              style={styles.groupHead}
            >
              <View style={[styles.dot, { backgroundColor: theme.accent }]} />
              <Text style={[styles.groupTitle, { color: theme.accent }]}>Group {g.groupName}</Text>
              <Text style={[type.label, { color: theme.onDarkSoft, flex: 1 }]}>
                {plural(g.fixtures.length, 'fixture')}, {plural(rounds.length, 'round')}
              </Text>
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={22} color={theme.onDarkSoft} />
            </PressableScale>

            {expanded &&
              rounds.map((round) => (
                <View key={round} style={{ gap: 1 }}>
                  {round > 0 && (
                    <Text style={[type.label, styles.round, { color: theme.onDarkSoft }]}>Round {round}</Text>
                  )}
                  {g.fixtures
                    .filter((f) => f.round === round)
                    .sort((a, b) => a.matchNumber - b.matchNumber)
                    .map((f) => (
                      <View
                        key={f.id}
                        style={[styles.fixture, { borderTopColor: theme.borderOnDark }]}
                        accessible
                        accessibilityLabel={`Match ${f.matchNumber}: ${f.home} against ${f.away}`}
                      >
                        <Text style={[styles.num, { color: theme.onDarkSoft }]}>#{f.matchNumber}</Text>
                        <Text style={[type.bodyStrong, { color: theme.onDark, flex: 1 }]} numberOfLines={1}>
                          {f.home} <Text style={{ color: theme.accent }}>vs</Text> {f.away}
                        </Text>
                      </View>
                    ))}
                </View>
              ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, minHeight: 56 },
  dot: { width: 8, height: 8, borderRadius: 2 },
  groupTitle: { fontFamily: fonts.bodySemiBold, fontSize: 16 },
  round: { paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.xs },
  fixture: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, minHeight: 48, borderTopWidth: 1 },
  num: { fontFamily: fonts.display, fontSize: 16, width: 36 },
});
