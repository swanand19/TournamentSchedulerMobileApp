import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { BringBackOptions, LeagueBadge, LeagueListItem } from '@/api/types';
import { PhotoBadge } from '@/components/Badges';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import EmptyState from '@/components/EmptyState';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Sheet from '@/components/Sheet';
import Skeleton from '@/components/Skeleton';
import TextField from '@/components/TextField';
import { useAction } from '@/hooks/useAction';
import { useQuery } from '@/hooks/useQuery';
import { capitalizeWords } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { lip, space, type Sport, type Typography } from '@/theme/theme';

// Leagues and seasons (2026-11-24, canvas "Leagues and seasons"): the pieces other screens use — the league's line above a
// season's tabs (board League-InHub), "Part of a league?" (League-Pick), the new-season sheet that "Start Season N" opens
// filled in (League-Create), and "Bring back teams" on a new season's Teams page (League-BringBack). The server numbers
// the seasons and says who may do what; nothing here decides it.

/** "Season 3 of Corporate Premier League" with its line, opening the league's page. */
export function LeagueLink({ league, sport }: { league: LeagueBadge; sport: Sport }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const light = theme.mode === 'light';
  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/league/[leagueId]', params: { leagueId: String(league.leagueId), sport } })}
      accessibilityRole="link"
      accessibilityLabel={`Season ${league.season} of ${league.name}. ${league.line ?? ''}`}
      accessibilityHint="Opens the league"
      style={light ? [styles.lightLink, { borderColor: theme.cardDivider }] : [styles.link, { backgroundColor: theme.cream }, lip(theme)]}
    >
      <LeagueLogo name={league.shortName} link={league.logoUrl} size={40} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
          Season {league.season} of {league.name}
        </Text>
        {!!league.line && (
          <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
            {league.line}
          </Text>
        )}
      </View>
      <Icon name="chevron-right" size={20} color={theme.muted} />
    </PressableScale>
  );
}

/** The league's logo, or its short name on a tinted square when it has none ("CPL"). */
export function LeagueLogo({ name, link, size = 44 }: { name: string; link: string | null | undefined; size?: number }) {
  const { fonts } = useTypography();
  const theme = useSportTheme();
  if (link) return <PhotoBadge link={link} name={name} size={size} square />;
  return (
    <View
      style={{ width: size, height: size, borderRadius: size * 0.28, borderCurve: 'continuous', backgroundColor: theme.tint, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: size * (name.length > 3 ? 0.24 : 0.32), color: theme.mode === 'light' ? theme.deep : theme.accent }} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

/**
 * "Part of a league?": No (a one-off), one of the leagues the caller runs in this sport, or start a new league. The
 * chosen league's next season number shows on the new-tournament form ("This becomes Season 4").
 */
export function LeaguePickSheet({ visible, onClose, sport, value, onPick }: {
  visible: boolean;
  onClose: () => void;
  sport: Sport;
  value: LeagueListItem | null;
  onPick: (league: LeagueListItem | null) => void;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const fetcher = useCallback(() => api.call<LeagueListItem[]>('LEAGUE_LIST', { query: { sport } }), [sport]);
  const leagues = useQuery(fetcher, { enabled: visible });
  const [chosen, setChosen] = useState<LeagueListItem | null>(value);

  const option = (key: string, label: string, detail: string | null, on: boolean, pick: () => void, league?: LeagueListItem) => (
    <PressableScale
      key={key}
      onPress={pick}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      style={[styles.option, { borderBottomColor: theme.cardDivider }]}
    >
      <View style={[styles.radio, { borderColor: on ? theme.accent : theme.placeholderInk }]}>{on && <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />}</View>
      {league && <LeagueLogo name={league.shortName} link={league.logoUrl} size={36} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]}>{label}</Text>
        {!!detail && <Text style={[type.caption, { color: theme.muted }]}>{detail}</Text>}
      </View>
    </PressableScale>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Part of a league?"
      subtitle={`${theme.label} leagues you run.`}
      footer={
        <Button
          label="Done"
          onPress={() => {
            onPick(chosen);
            onClose();
          }}
          style={{ flex: 1 }}
        />
      }
    >
      <ErrorBanner message={leagues.error?.message} actionLabel="Try again" onAction={leagues.refresh} />
      {option('none', 'No, a one-off tournament', null, chosen == null, () => setChosen(null))}
      {leagues.loading && !leagues.data ? (
        <Skeleton rows={2} height={56} />
      ) : (
        leagues.data?.map((l) => option(String(l.leagueId), l.name, l.line, chosen?.leagueId === l.leagueId, () => setChosen(l), l))
      )}
      <Button
        label="Start a new league"
        icon="plus"
        variant="secondary"
        onPress={() => {
          onClose();
          router.push({ pathname: '/league/new', params: { sport } });
        }}
      />
      <Text style={[type.caption, { color: theme.muted }]}>
        A league’s seasons are public, like every tournament: anyone can find and watch them. Emails and numbers are never shown.
      </Text>
    </Sheet>
  );
}

/**
 * The new-tournament form as "Start Season N" opens it: the name filled in ("CPL 4") and the league fixed. Creating it
 * opens the new season, ready for its teams.
 */
export function NewSeasonSheet({ visible, onClose, league, sport }: {
  visible: boolean;
  onClose: () => void;
  league: { leagueId: number; name: string; shortName: string; logoUrl: string | null; nextSeason: number };
  sport: Sport;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const action = useAction();
  const [name, setName] = useState(`${league.shortName} ${league.nextSeason}`);

  const create = async () => {
    const res = await action.run(() =>
      api.call<{ id: number; name: string }>('TOURNAMENT_CREATE', { body: { name: name.trim(), sport, leagueId: league.leagueId } }),
    );
    if (!res.ok) return;
    haptic.success();
    onClose();
    router.push({ pathname: '/tournament/[id]', params: { id: res.value.id, name: res.value.name, sport } });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`New ${theme.label.toLowerCase()} tournament`}
      subtitle="Name it now. Teams, the schedule and its dates come next."
      footer={
        <>
          <Button label="Cancel" variant="deck" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Create tournament" onPress={create} busy={action.busy} disabled={!name.trim()} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      <TextField label="Name" value={name} onChangeText={(v) => setName(capitalizeWords(v))} autoCapitalize="words" maxLength={100} editable={!action.busy} />
      <Text style={[type.label, { color: theme.muted }]}>League</Text>
      <View style={[styles.fixedLeague, { borderColor: theme.cardDivider }]}>
        <LeagueLogo name={league.shortName} link={league.logoUrl} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.bodyStrong, { color: theme.ink }]}>{league.name}</Text>
          <Text style={[type.caption, { color: theme.muted }]}>This becomes Season {league.nextSeason}</Text>
        </View>
      </View>
      <Text style={[type.caption, { color: theme.muted }]}>
        Public, like every tournament: anyone can find and watch it. You can bring back earlier seasons’ teams from its Teams page.
      </Text>
    </Sheet>
  );
}

/**
 * "Bring back teams" (board League-BringBack): one earlier season at a time, newest first; each team comes back with the
 * squad it ended with and keeps its league record and titles. A team already here, or one whose name is taken, is
 * greyed with the server's reason.
 */
export function BringBackSheet({ tournamentId, visible, onClose, onDone }: {
  tournamentId: number;
  visible: boolean;
  onClose: () => void;
  onDone: (notice: string) => void;
}) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const fetcher = useCallback(() => api.call<BringBackOptions>('LEAGUE_BRING_BACK_OPTIONS', { routeParams: { id: tournamentId } }), [tournamentId]);
  const options = useQuery(fetcher, { enabled: visible });
  const action = useAction();
  const [season, setSeason] = useState<number | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  const seasons = options.data?.seasons ?? [];
  const shown = seasons.find((s) => s.number === season) ?? seasons[0];

  const toggle = (teamId: number) =>
    setTicked((t) => {
      const next = new Set(t);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      haptic.select();
      return next;
    });

  const bring = async () => {
    const res = await action.run(() =>
      api.call<{ added: number; notice: string }>('LEAGUE_BRING_BACK', { routeParams: { id: tournamentId }, body: { teamIds: [...ticked] } }),
    );
    if (res.ok) {
      haptic.success();
      setTicked(new Set());
      onDone(res.value.notice);
      onClose();
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Bring back teams"
      subtitle="They keep their league record and titles, and come back with the squad they ended with. Change it afterwards as usual."
      footer={
        <Button
          label={ticked.size === 0 ? 'Bring back teams' : `Bring back ${ticked.size === 1 ? '1 team' : `${ticked.size} teams`}`}
          onPress={bring}
          busy={action.busy}
          disabled={ticked.size === 0}
          style={{ flex: 1 }}
        />
      }
    >
      <ErrorBanner message={(action.error ?? options.error)?.message} />
      {!options.data ? (
        options.loading ? <Skeleton rows={3} height={56} /> : null
      ) : seasons.length === 0 ? (
        <EmptyState icon="history" title="No earlier teams" message="The league’s earlier seasons have no teams to bring back." />
      ) : (
        <>
          <View style={styles.chips}>
            {seasons.map((s) => (
              <Chip
                key={s.number}
                label={s.name}
                selected={shown?.number === s.number}
                onPress={() => {
                  haptic.select();
                  setSeason(s.number);
                }}
              />
            ))}
          </View>
          {shown?.teams.map((t) => {
            const on = ticked.has(t.teamId);
            const blocked = t.reason != null;
            return (
              <PressableScale
                key={t.teamId}
                onPress={() => toggle(t.teamId)}
                disabled={blocked}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: blocked }}
                accessibilityLabel={`${t.name}, ${blocked ? t.reason : t.line}`}
                style={[styles.option, { borderBottomColor: theme.cardDivider, opacity: blocked ? 0.55 : 1 }]}
              >
                <View style={[styles.check, { borderColor: on ? theme.accent : theme.placeholderInk, backgroundColor: on ? theme.accent : 'transparent' }]}>
                  {on && <Icon name="check" size={16} color={theme.accentInk} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyStrong, { color: theme.ink }]}>{t.name}</Text>
                  <Text style={[type.caption, { color: theme.muted }]}>{blocked ? t.reason : t.line}</Text>
                </View>
              </PressableScale>
            );
          })}
          <Text style={[type.caption, { color: theme.muted }]}>A new team with an old team’s name starts its own record. Two teams in one season can’t share a name.</Text>
        </>
      )}
    </Sheet>
  );
}

const makeStyles = (_: Typography) => StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 64 },
  lightLink: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2, minHeight: 60, borderTopWidth: 1, borderBottomWidth: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fixedLeague: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderBottomWidth: 1 },
});
