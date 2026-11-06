import { useRouter } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import { ApiError } from '@/api/errors';
import type { KnockoutStage, SavedSchedule } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import ErrorBanner from '@/components/ErrorBanner';
import Icon, { type IconName } from '@/components/Icon';
import SectionHeader from '@/components/SectionHeader';
import Skeleton from '@/components/Skeleton';
import StatusChip, { type ChipTone } from '@/components/StatusChip';
import FixturesPreview from '@/features/hub/FixturesPreview';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { useTournament } from '@/hooks/useTournament';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Before kick-off: a checklist — teams, schedule, the knockout stage (optional), start — each saying
// where it stands and offering its one action, then the fixtures that will be created. A tournament
// can skip the groups and be knockouts only.

export default function PreStartHub({ onStarted }: { onStarted: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const theme = useSportTheme();
  const { id } = useTournament();
  const teams = useTeams(id);
  const action = useAction();

  const fetchSchedule = useCallback(async () => {
    try {
      return await api.call<SavedSchedule>('SCHEDULE_ACTIVE', { routeParams: { id } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null; // no schedule approved yet
      throw e;
    }
  }, [id]);
  const schedule = useQuery(fetchSchedule);
  const knockoutFetcher = useCallback(() => api.call<KnockoutStage>('KNOCKOUT_GET', { routeParams: { id } }), [id]);
  const knockout = useQuery(knockoutFetcher);

  if (teams.loading || schedule.loading || knockout.loading) return <Skeleton rows={3} height={140} />;

  const teamCount = teams.data?.length ?? 0;
  const playerCount = teams.data?.reduce((n, t) => n + t.players.length, 0) ?? 0;
  const s = schedule.data ?? null;
  const rounds = s ? new Set(s.groups.flatMap((g) => g.fixtures.map((f) => f.round))).size : 0;
  const teamsDone = teamCount >= 2;
  const scheduleDone = !!s;
  const knockoutMatches = knockout.data?.fixtures.length ?? 0;
  // Either is enough to start: groups, a knockout stage, or both.
  const fixturesDone = scheduleDone || knockoutMatches > 0;
  const totalMatches = (s?.totalMatches ?? 0) + knockoutMatches;
  const readyCount = (teamsDone ? 1 : 0) + (fixturesDone ? 1 : 0);

  const params = { id: String(id) };

  const start = async () => {
    if (!fixturesDone) return;
    const ok = await confirm({
      title: 'Start the tournament?',
      message: s
        ? `This creates ${plural(totalMatches, 'match', 'matches')} and locks the schedule. The schedule can't be changed afterwards; the knockout stage still can, until its matches start.`
        : `This creates the ${plural(totalMatches, 'knockout match', 'knockout matches')}.`,
      confirmLabel: 'Start',
    });
    if (!ok) return;
    const res = await action.run(() => api.call('TOURNAMENT_START', { routeParams: { id } }));
    if (res.ok) {
      haptic.success();
      onStarted();
    }
  };

  return (
    <View style={{ gap: space.lg }}>
      <ErrorBanner
        message={(action.error ?? teams.error ?? schedule.error ?? knockout.error)?.message}
        actionLabel={action.error ? undefined : 'Try again'}
        onAction={() => {
          teams.refresh();
          schedule.refresh();
          knockout.refresh();
        }}
      />

      <View style={styles.tiles}>
        <InfoTile icon={theme.key === 'Cricket' ? 'cricket' : 'soccer'} label="Sport" value={theme.label} />
        <InfoTile icon="account-group" label="Squads" value={`${teamCount} · ${playerCount} pl`} />
        <InfoTile icon="sitemap" label="Structure" value={s ? plural(s.groups.length, 'group') : 'Not drawn'} />
        <InfoTile icon="calendar-month" label="Fixtures" value={s ? `${s.totalMatches} · ${rounds} rds` : '—'} />
      </View>

      <SectionHeader
        eyebrow="Setup checklist"
        title="Preparation"
        right={<StatusChip label={`${readyCount} of 2 ready`} tone={readyCount === 2 ? 'ready' : 'setup'} onDark />}
      />

      <Step
        n={1}
        done={teamsDone}
        title="Teams & rosters"
        status={teamsDone ? { label: 'Ready', tone: 'ready' } : { label: 'Needs 2+ teams', tone: 'setup' }}
        body={teamCount === 0 ? 'Add the sides taking part, then their players.' : `${plural(teamCount, 'team')} · ${plural(playerCount, 'player')} registered.`}
      >
        <Button
          label={teamCount === 0 ? 'Add teams' : 'Manage'}
          icon="chevron-right"
          variant={teamsDone ? 'secondary' : 'primary'}
          onPress={() => router.push({ pathname: '/tournament/[id]/teams', params })}
        />
      </Step>

      <Step
        n={2}
        done={scheduleDone}
        title="Groups & schedule"
        status={scheduleDone ? { label: 'Schedule ready', tone: 'ready' } : { label: 'Not built', tone: 'setup' }}
        body={
          s
            ? `${plural(s.groups.length, 'group')} · ${plural(s.totalMatches, 'match', 'matches')} across ${plural(rounds, 'round')} · ${s.matchesPerTeam} per team.`
            : 'Draw the groups and generate round-robin fixtures. Knockouts only? Skip this and set up the knockout stage.'
        }
      >
        <View style={styles.btnRow}>
          <Button
            label={s ? 'Rebuild' : 'Build schedule'}
            icon={s ? 'refresh' : 'calendar-plus'}
            variant={s || !teamsDone ? 'secondary' : 'primary'}
            disabled={!teamsDone}
            onPress={() => router.push({ pathname: '/tournament/[id]/schedule', params })}
            style={{ flex: 1 }}
          />
          {s && (
            <Button
              label="History"
              icon="history"
              variant="secondary"
              onPress={() => router.push({ pathname: '/tournament/[id]/history', params })}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Step>

      <Step
        n={3}
        done={knockoutMatches > 0}
        title="Knockout stage"
        status={knockoutMatches > 0 ? { label: plural(knockoutMatches, 'match', 'matches'), tone: 'ready' } : { label: 'Optional', tone: 'done' }}
        body={
          knockoutMatches > 0
            ? 'Sides fill in by themselves as groups and matches finish. You can change it until its matches start.'
            : 'Semi-finals, a final, IPL playoffs — or a straight knockout of every team. Set it up now or later.'
        }
      >
        <Button
          label={knockoutMatches > 0 ? 'Open' : 'Set up knockouts'}
          icon="tournament"
          variant="secondary"
          disabled={!teamsDone}
          onPress={() => router.push({ pathname: '/tournament/[id]/knockout', params })}
        />
      </Step>

      <Step
        n={4}
        done={false}
        title="Start tournament"
        status={fixturesDone ? { label: 'Ready to start', tone: 'accent' } : { label: 'Waiting', tone: 'done' }}
        body="Creates every match so they can be scored live."
      >
        <Button
          label="Start tournament"
          icon="lightning-bolt"
          size="lg"
          onPress={start}
          busy={action.busy}
          disabled={!fixturesDone || !teamsDone}
        />
        <View style={styles.lockNote}>
          <Icon name="lock-outline" size={14} color={theme.muted} />
          <Text style={[type.caption, { color: theme.muted }]}>Locks the schedule once started</Text>
        </View>
      </Step>

      {s && (
        <View style={{ gap: space.md }}>
          <SectionHeader
            eyebrow="Matchday preview"
            title="Fixtures"
            right={<StatusChip label={`${s.totalMatches} total`} tone="done" onDark />}
          />
          <FixturesPreview schedule={s} />
        </View>
      )}
    </View>
  );
}

function InfoTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <View style={[styles.tile, { backgroundColor: theme.deck, borderColor: theme.borderOnDark }]} accessible accessibilityLabel={`${label}: ${value}`}>
      <Icon name={icon} size={22} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[type.label, { color: theme.onDarkSoft }]}>{label}</Text>
        <Text style={[type.bodyStrong, { color: theme.onDark }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function Step({
  n,
  done,
  title,
  status,
  body,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  status: { label: string; tone: ChipTone };
  body: string;
  children: ReactNode;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  return (
    <Card>
      <View style={styles.stepHead}>
        <View style={[styles.stepNum, { backgroundColor: done ? theme.successSolid : theme.accent }]}>
          {done ? (
            <Icon name="check" size={22} color="#FFFFFF" label="Done" />
          ) : (
            <Text style={[styles.stepNumText, { color: theme.accentInk }]}>{n}</Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.headline, { color: theme.ink }]} accessibilityRole="header">
            {title}
          </Text>
          <StatusChip label={status.label} tone={status.tone} />
        </View>
      </View>
      <Text style={[type.body, { color: theme.muted }]}>{body}</Text>
      {children}
    </Card>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.md,
  },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepNum: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.display, fontSize: 22 },
  btnRow: { flexDirection: 'row', gap: space.sm },
  lockNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
