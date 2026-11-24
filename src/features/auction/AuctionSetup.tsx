import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { AuctionSettings, AuctionState, AuctionTeam, BidStep, Pool } from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import Screen from '@/components/Screen';
import SectionHeader from '@/components/SectionHeader';
import SegmentedControl from '@/components/SegmentedControl';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import TextField from '@/components/TextField';
import { amount, Avatar } from '@/features/auction/AuctionParts';
import { TierSheet } from '@/features/auction/PoolParts';
import { useAction } from '@/hooks/useAction';
import { useAuthOptions } from '@/hooks/useAuthOptions';
import { useQuery } from '@/hooks/useQuery';
import { useTeams } from '@/hooks/useTeams';
import { confirm } from '@/lib/confirm';
import { plural } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Setting up the auction (the "Set up the auction" board on the design canvas): the purse and
// squad sizes, each tier's base price and limit, the bid steps, the clock, the order, what happens
// to players nobody buys, and who bids for each team. Everything is a draft until "Save changes";
// "Start the auction" saves first. The server says whether the pool can start (too few players)
// and warns about too many; the person who starts it runs it, and may not be a bidder.

const STEP_PRESETS: { key: string; label: string; steps: BidStep[] }[] = [
  { key: 'standard', label: 'Standard', steps: [{ upTo: 1000, step: 50 }, { upTo: 3000, step: 100 }, { upTo: null, step: 250 }] },
  { key: 'small', label: 'Small league', steps: [{ upTo: 500, step: 25 }, { upTo: 2000, step: 50 }, { upTo: null, step: 100 }] },
  { key: 'big', label: 'Big money', steps: [{ upTo: 10000, step: 500 }, { upTo: 50000, step: 1000 }, { upTo: null, step: 2500 }] },
];

const sameSteps = (a: BidStep[], b: BidStep[]) => JSON.stringify(a) === JSON.stringify(b);

/** "From a base of 500, bids go 500, 550, 600 … 1,000, 1,100" — what the steps mean, in figures. */
function ladderExample(steps: BidStep[], from: number) {
  const next = (n: number) => n + (steps.find((s) => s.upTo == null || n < s.upTo)?.step ?? steps[steps.length - 1].step);
  const out = [from];
  while (out.length < 6) out.push(next(out[out.length - 1]));
  return `From a base of ${amount(from)}, bids go ${out.map(amount).join(', ')} …`;
}

type Draft = Omit<AuctionSettings, 'bidSteps'> & { bidSteps: BidStep[]; purseText: string; keptText: string; noTierText: string };

const draftOf = (s: AuctionSettings): Draft => ({
  ...s,
  purseText: String(s.purse),
  keptText: String(s.keptPlayerPrice),
  noTierText: String(s.noTierBasePrice),
});

const digits = (v: string) => v.replace(/[^0-9]/g, '');

export function AuctionSetup({ state, tournamentId, tournamentName, onState }: { state: AuctionState; tournamentId: number; tournamentName: string; onState: (s: AuctionState) => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const router = useRouter();
  const action = useAction();
  const [draft, setDraft] = useState<Draft>(() => draftOf(state.settings));
  const [bidderFor, setBidderFor] = useState<AuctionTeam | null>(null);
  const [tiersOpen, setTiersOpen] = useState(false);
  const poolFetcher = useCallback(() => api.call<Pool>('POOL_GET', { routeParams: { id: tournamentId } }), [tournamentId]);
  const pool = useQuery(poolFetcher);

  const edit = state.actions.canEditSettings;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const body = {
    unit: draft.unit,
    purse: Number(digits(draft.purseText)) || 0,
    minSquad: draft.minSquad,
    maxSquad: draft.maxSquad,
    keptPlayerPrice: Number(digits(draft.keptText)) || 0,
    noTierBasePrice: Number(digits(draft.noTierText)) || 0,
    bidSteps: draft.bidSteps,
    clockOn: draft.clockOn,
    firstBidSeconds: draft.firstBidSeconds,
    nextBidSeconds: draft.nextBidSeconds,
    order: draft.order,
    unsoldPlan: draft.unsoldPlan,
  };
  const saved = state.settings;
  const dirty =
    state.status === 'None' ||
    JSON.stringify(body) !==
      JSON.stringify({
        unit: saved.unit, purse: saved.purse, minSquad: saved.minSquad, maxSquad: saved.maxSquad, keptPlayerPrice: saved.keptPlayerPrice,
        noTierBasePrice: saved.noTierBasePrice, bidSteps: saved.bidSteps, clockOn: saved.clockOn, firstBidSeconds: saved.firstBidSeconds,
        nextBidSeconds: saved.nextBidSeconds, order: saved.order, unsoldPlan: saved.unsoldPlan,
      });

  const save = async () => {
    const res = await action.run(() => api.call<AuctionState>('AUCTION_SETTINGS', { routeParams: { id: tournamentId }, body }));
    if (!res.ok) return null;
    haptic.success();
    onState(res.value);
    setDraft(draftOf(res.value.settings));
    return res.value;
  };

  const start = async () => {
    const ok = await confirm({
      title: 'Start the auction?',
      message: `You'll run it from this phone. The rules and bidders are fixed from now on (the clock can still change while paused), and everyone in the pool hears it's started.`,
      confirmLabel: 'Start',
    });
    if (!ok) return;
    const res = await action.run(() => api.call<AuctionState>('AUCTION_START', { routeParams: { id: tournamentId } }));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
  };

  const teams = state.teams.length;
  const tiers = state.tiers;
  const preset = STEP_PRESETS.find((p) => sameSteps(p.steps, draft.bidSteps));
  const fits = !state.startProblem && !state.startWarning && state.counts.players > 0;

  return (
    <Screen
      footer={
        edit ? (
          dirty ? (
            <Button label="Save changes" icon="content-save-outline" size="lg" onPress={save} busy={action.busy} />
          ) : (
            <Button label="Start the auction" icon="gavel" size="lg" onPress={start} busy={action.busy} disabled={!state.actions.canStart} />
          )
        ) : undefined
      }
    >
      <SectionHeader eyebrow={tournamentName} title="Set up the auction" large />
      <Text style={[type.body, { color: theme.onDarkSoft }]}>
        {plural(state.counts.players, 'player')}, {plural(teams, 'team')}. Everything here locks when the first player is opened, except the bid clock.
      </Text>
      <ErrorBanner message={bidderFor || tiersOpen ? null : action.error?.message} />
      {state.startProblem && <Text style={[type.bodyStrong, { color: theme.warnInk }]}>{state.startProblem}</Text>}
      {state.startWarning && <Text style={[type.body, { color: theme.warnInk }]}>{state.startWarning}</Text>}

      <Card>
        <View style={styles.between}>
          <Text style={[type.headline, { color: theme.ink }]}>Players</Text>
          <Text style={[type.caption, { color: theme.muted }]}>{plural(state.counts.players, 'player')} in the pool</Text>
        </View>
        {tiers.length > 0 && (
          <Text style={[type.body, { color: theme.muted }]}>{tiers.map((t) => `${t.name} ${t.players}`).join(' · ')}</Text>
        )}
        <Button
          label="Open the player pool"
          icon="account-multiple-outline"
          variant="secondary"
          onPress={() => router.push({ pathname: '/tournament/[id]/pool', params: { id: String(tournamentId) } })}
        />
      </Card>

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>Purse and squads</Text>
        <View style={styles.between}>
          <Text style={[type.bodyStrong, { color: theme.ink }]}>Unit</Text>
          <SegmentedControl
            segments={[{ key: 'pts', label: 'pts' }, { key: '₹', label: '₹' }]}
            value={draft.unit === '₹' ? '₹' : 'pts'}
            onChange={(unit) => edit && set({ unit })}
            style={{ width: 150 }}
            accessibilityLabel="Unit"
          />
        </View>
        <Text style={[type.caption, { color: theme.muted }]}>Only a label. The app never handles money.</Text>
        <TextField label="Purse per team" value={draft.purseText} onChangeText={(v) => set({ purseText: digits(v) })} keyboardType="number-pad" editable={edit} maxLength={9} hint="The same for every team" />
        <Stepper label="Minimum squad" hint="Counting the captain" value={draft.minSquad} min={1} max={50} onChange={(v) => edit && set({ minSquad: v, maxSquad: Math.max(v, draft.maxSquad) })} />
        <Stepper label="Maximum squad" value={draft.maxSquad} min={draft.minSquad} max={60} onChange={(v) => edit && set({ maxSquad: v })} />
        <TextField
          label="Each player already in a team costs"
          value={draft.keptText}
          onChangeText={(v) => set({ keptText: digits(v) })}
          keyboardType="number-pad"
          editable={edit}
          maxLength={9}
          hint="The captains. Usually 0."
        />
        {fits && (
          <Text style={[type.caption, { color: theme.successInk }]}>
            {plural(state.counts.players, 'player')} fill {plural(teams, 'team')} of {saved.minSquad} to {saved.maxSquad}.
          </Text>
        )}
      </Card>

      <Card>
        <View style={styles.between}>
          <Text style={[type.headline, { color: theme.ink }]}>Base price by tier</Text>
          {edit && pool.data && <Button label="Change" size="sm" variant="ghost" onPress={() => setTiersOpen(true)} />}
        </View>
        {tiers.map((t) => (
          <View key={t.id} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyStrong, { color: theme.ink }]}>{t.name}</Text>
              <Text style={[type.caption, { color: theme.muted }]}>
                {plural(t.players, 'player')}
                {t.maxPerTeam ? ` · at most ${t.maxPerTeam} a team` : ''}
                {t.maxPerTeam && teams > 0 && t.players > t.maxPerTeam * teams ? ` — room for ${t.maxPerTeam * teams}` : ''}
              </Text>
            </View>
            <Text style={[type.figure, { color: theme.ink }]}>{amount(t.basePrice)}</Text>
          </View>
        ))}
        <TextField label="Players in no tier" value={draft.noTierText} onChangeText={(v) => set({ noTierText: digits(v) })} keyboardType="number-pad" editable={edit} maxLength={9} />
        <Text style={[type.caption, { color: theme.muted }]}>
          “At most N a team” is set per tier under Change. A team at its limit can’t bid on that tier.
        </Text>
      </Card>

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>Bid steps</Text>
        <View style={styles.wrap}>
          {STEP_PRESETS.map((p) => (
            <Chip key={p.key} label={p.label} onCard selected={preset?.key === p.key} onPress={() => edit && set({ bidSteps: p.steps })} disabled={!edit} />
          ))}
        </View>
        {draft.bidSteps.map((s, i) => (
          <View key={i} style={styles.line}>
            <Text style={[type.body, { color: theme.ink, flex: 1 }]}>{s.upTo == null ? `Above ${amount(draft.bidSteps[i - 1]?.upTo ?? 0)}` : `Up to ${amount(s.upTo)}`}</Text>
            <Text style={[type.figure, { color: theme.ink }]}>+{amount(s.step)}</Text>
          </View>
        ))}
        <Text style={[type.caption, { color: theme.muted }]}>{ladderExample(draft.bidSteps, tiers[1]?.basePrice ?? tiers[0]?.basePrice ?? 500)}</Text>
      </Card>

      <Card>
        <SwitchRow label="Bid clock" hint="Sells to the highest bid when it runs out" value={draft.clockOn} onChange={(v) => edit && set({ clockOn: v })} disabled={!edit} />
        {draft.clockOn && (
          <>
            <Stepper label="For the first bid" value={draft.firstBidSeconds} min={5} max={120} step={5} display={`${draft.firstBidSeconds} s`} onChange={(v) => edit && set({ firstBidSeconds: v })} />
            <Stepper label="After each bid" hint="Resets, so nobody can snipe" value={draft.nextBidSeconds} min={3} max={60} display={`${draft.nextBidSeconds} s`} onChange={(v) => edit && set({ nextBidSeconds: v })} />
          </>
        )}
      </Card>

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>Order</Text>
        <View style={styles.wrap}>
          <Chip label="By tier, shuffled inside each" onCard selected={draft.order === 'ByTier'} onPress={() => edit && set({ order: 'ByTier' })} disabled={!edit} />
          <Chip label="The pool list's order" onCard selected={draft.order === 'ListOrder'} onPress={() => edit && set({ order: 'ListOrder' })} disabled={!edit} />
        </View>
      </Card>

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>Players nobody buys</Text>
        <View style={styles.wrap}>
          <Chip label="Another auction round" onCard selected={draft.unsoldPlan === 'AnotherRound'} onPress={() => edit && set({ unsoldPlan: 'AnotherRound' })} disabled={!edit} />
          <Chip label="Assign by hand" onCard selected={draft.unsoldPlan === 'AssignByHand'} onPress={() => edit && set({ unsoldPlan: 'AssignByHand' })} disabled={!edit} />
        </View>
        <Text style={[type.caption, { color: theme.muted }]}>
          After each round you choose again: another round (at the same or a lower base price), or end and assign by hand. A team that can’t afford a player can’t be given them.
        </Text>
      </Card>

      <Card>
        <Text style={[type.headline, { color: theme.ink }]}>Bidders</Text>
        <Text style={[type.caption, { color: theme.muted }]}>
          The captain bids for their team from their phone; a bidder needs an account. Whoever starts the auction runs it, so can’t be a bidder. The auctioneer can always record a bid made in the room.
        </Text>
        {state.teams.map((t) => (
          <BidderRow key={t.teamId} team={t} onChange={state.actions.canSetBidders ? () => setBidderFor(t) : undefined} />
        ))}
      </Card>

      {bidderFor && (
        <BidderSheet team={bidderFor} tournamentId={tournamentId} onState={onState} onClose={() => setBidderFor(null)} />
      )}
      {tiersOpen && pool.data && (
        <TierSheet
          visible
          onClose={() => setTiersOpen(false)}
          onSaved={() => api.call<AuctionState>('AUCTION_GET', { routeParams: { id: tournamentId } }).then(onState).catch(() => {})}
          tournamentId={tournamentId}
          tiers={pool.data.tiers}
          unit={draft.unit}
        />
      )}
    </Screen>
  );
}

export function BidderRow({ team, onChange }: { team: AuctionTeam; onChange?: () => void }) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const who = team.bidder
    ? `${team.bidder.name}${team.bidderIsCaptain ? ' · captain' : ''}`
    : team.captainWithoutAccount
      ? `${team.captainName} has no account: the auctioneer bids for ${team.name}`
      : `No bidder: the auctioneer bids for ${team.name}`;
  return (
    <View style={styles.line}>
      <Avatar name={team.bidder?.name ?? team.name} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]}>{team.name}</Text>
        <Text style={[type.caption, { color: team.bidder ? theme.muted : theme.warnInk }]}>{who}</Text>
      </View>
      {onChange && <Button label="Change" size="sm" variant="secondary" onPress={onChange} />}
    </View>
  );
}

/** Who bids for a team: one of its players with an account, anyone by email or number, or nobody (the auctioneer records its bids). */
export function BidderSheet({ team, tournamentId, onState, onClose }: { team: AuctionTeam; tournamentId: number; onState: (s: AuctionState) => void; onClose: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const options = useAuthOptions();
  const teams = useTeams(tournamentId);
  const [contact, setContact] = useState('');
  const players = teams.data?.find((t) => t.id === team.teamId)?.players.filter((p) => p.isLinked) ?? [];

  const pick = async (body: object) => {
    const res = await action.run(() => api.call<AuctionState>('AUCTION_BIDDER_SET', { routeParams: { id: tournamentId }, body: { teamId: team.teamId, ...body } }));
    if (!res.ok) return;
    haptic.success();
    onState(res.value);
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={`Who bids for ${team.name}?`} subtitle={team.bidder ? `Now: ${team.bidder.name}` : 'Now: the auctioneer'}>
      <ErrorBanner message={action.error?.message} />
      {players.length > 0 && <Text style={[type.label, { color: theme.muted }]}>From the squad</Text>}
      {players.map((p) => (
        <Button key={p.id} label={p.name} variant="deck" icon={team.bidder?.name === p.name ? 'check' : undefined} onPress={() => pick({ playerId: p.id })} disabled={action.busy} />
      ))}
      <TextField
        label={options.phone ? 'Someone else, by email or mobile number' : 'Someone else, by email'}
        value={contact}
        onChangeText={setContact}
        placeholder={options.phone ? 'e.g. owner@example.com or 98765 43210' : 'e.g. owner@example.com'}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        hint="They need an account. They can watch the tournament once they're its bidder."
      />
      <Button label="Make them the bidder" variant="secondary" onPress={() => pick({ contact: contact.trim() })} disabled={!contact.trim() || action.busy} />
      <Button label="I'll record their bids myself" variant="ghost" onPress={() => pick({ none: true })} disabled={action.busy} />
    </Sheet>
  );
}

const makeStyles = (_: Typography) =>
  StyleSheet.create({
    between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
    line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    pill: { borderRadius: radius.pill },
  });
