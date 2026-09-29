import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import type { ScheduleHistoryItem } from '@/api/types';
import Button from '@/components/Button';
import ErrorBanner from '@/components/ErrorBanner';
import StatusChip from '@/components/StatusChip';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTournament } from '@/hooks/useTournament';
import { parseUtc, plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme } from '@/theme/SportTheme';
import { radius, space, type } from '@/theme/theme';

// The last five approved schedules, as a native form sheet. Any of them can be made the active one
// until the tournament starts. (Android form sheets can't show a header, so the title is content.)

export default function ScheduleHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useSportTheme();
  const { id, isStarted } = useTournament();
  const action = useAction();

  const fetcher = useCallback(
    () => api.call<ScheduleHistoryItem[]>('SCHEDULE_HISTORY', { routeParams: { id } }),
    [id],
  );
  const history = useQuery(fetcher);

  const activate = async (scheduleId: number) => {
    const res = await action.run(() =>
      api.call('SCHEDULE_ACTIVATE', { routeParams: { id, scheduleId } }),
    );
    if (res.ok) {
      haptic.success();
      router.back();
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.cream }} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
      <Text accessibilityRole="header" style={[type.heading, { color: theme.ink }]}>
        SCHEDULE HISTORY
      </Text>
      <Text style={[type.body, { color: theme.muted }]}>
        {isStarted
          ? 'The tournament has started, so its schedule is locked.'
          : 'The last five approved schedules. Make an older one active to go back to it.'}
      </Text>
      <ErrorBanner message={(action.error ?? history.error)?.message} />

      {history.data?.map((s) => {
        const groups = s.groups.map((g) => g.groupName).join(', ');
        return (
          <View key={s.id} style={[styles.item, { backgroundColor: theme.chip, borderColor: s.isActive ? theme.successSolid : 'transparent' }]}>
            <View style={styles.head}>
              <Text style={[type.lead, { color: theme.ink, flex: 1 }]}>
                {parseUtc(s.createdAt)?.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </Text>
              {s.isActive && <StatusChip label="Active" tone="ready" />}
            </View>
            <Text style={[type.body, { color: theme.muted }]}>
              {plural(s.totalMatches, 'match', 'matches')} · {s.matchesPerTeam} per team · Groups {groups}
            </Text>
            {!s.isActive && !isStarted && (
              <Button label="Make active" variant="secondary" size="sm" onPress={() => activate(s.id)} busy={action.busy} />
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  item: { borderRadius: radius.lg, padding: space.md, gap: space.sm, borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
