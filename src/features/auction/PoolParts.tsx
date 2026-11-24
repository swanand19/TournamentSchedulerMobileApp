import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api } from '@/api/client';
import type { CricketRole, PlayerLookup, Pool, PoolPlayer, PoolTier } from '@/api/types';
import Button from '@/components/Button';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import Sheet from '@/components/Sheet';
import Stepper from '@/components/Stepper';
import TextField from '@/components/TextField';
import { Avatar, amount } from '@/features/auction/AuctionParts';
import { LINES } from '@/features/teams/positions';
import { useAction } from '@/hooks/useAction';
import { useAuthOptions } from '@/hooks/useAuthOptions';
import { CRICKET_ROLES } from '@/lib/cricketLabels';
import { confirm } from '@/lib/confirm';
import { capitalizeWords } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// The player pool's pieces: a row, the sheet to add or change one player, the tiers and their base
// prices, and moving several players to a tier at once. Adding starts from the person's email or
// number (so an account links, as in a team); "Add someone without an email or number" is the
// way in for a name only. Every change answers with the whole pool, which the screen just shows.

type Sport = 'Football' | 'Cricket';

/** One player in the list. Tap for the sheet; press and hold to start picking several. */
export function PoolRow({ player, selected, selecting, onPress, onLongPress, unit }: {
  player: PoolPlayer;
  selected?: boolean;
  selecting?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  unit?: string;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const right =
    player.status === 'Sold' ? (
      <Text style={[type.label, { color: theme.accent }]}>
        {player.teamName} · {amount(player.price)}
        {unit ? ` ${unit}` : ''}
      </Text>
    ) : player.status === 'Drawn' ? (
      <Text style={[type.label, { color: theme.accent }]}>{player.teamName}</Text>
    ) : player.isWithdrawn ? (
      <Text style={[type.label, { color: theme.warnInk }]}>Withdrawn</Text>
    ) : player.status === 'Unsold' ? (
      <Text style={[type.label, { color: theme.warnInk }]}>Unsold</Text>
    ) : player.joinedByCode ? (
      <Text style={[type.label, { color: theme.accent }]}>Joined by code</Text>
    ) : null;

  const content = (
    <View style={[styles.row, selected && { backgroundColor: theme.accentSoft }]}>
      {selecting ? (
        <Icon name={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={24} color={selected ? theme.accent : theme.muted} />
      ) : (
        <Avatar name={player.name} size={40} tint={player.isMe} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
          {player.name}
          {player.isMe ? ' (you)' : ''}
        </Text>
        <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
          {[player.role, player.isLinked ? 'Has an account' : player.email || player.phone ? 'Waiting to sign up' : null].filter(Boolean).join(' · ') || 'No role given'}
        </Text>
      </View>
      {right}
    </View>
  );

  if (!onPress && !onLongPress) return content;
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: !!selected } : undefined}
      accessibilityLabel={`${player.name}${player.role ? `, ${player.role}` : ''}`}
      accessibilityHint={selecting ? undefined : onLongPress ? 'Press and hold to pick several' : undefined}
    >
      {content}
    </PressableScale>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.label, { color: theme.muted }]}>{label}</Text>
      <View style={styles.wrap}>{children}</View>
    </View>
  );
}

function TierChoice({ tiers, value, onChange }: { tiers: PoolTier[]; value: number | null; onChange: (id: number | null) => void }) {
  return (
    <Group label="Tier">
      {tiers.map((t) => (
        <Chip key={t.id} label={t.name} onCard selected={value === t.id} onPress={() => onChange(t.id)} />
      ))}
      <Chip label="No tier" onCard selected={value == null} onPress={() => onChange(null)} />
    </Group>
  );
}

function RoleChoice({ sport, role, setRole, position, setPosition }: {
  sport: Sport;
  role: CricketRole | null;
  setRole: (r: CricketRole | null) => void;
  position: string;
  setPosition: (p: string) => void;
}) {
  if (sport === 'Cricket')
    return (
      <Group label="Plays as">
        {CRICKET_ROLES.map((r) => (
          <Chip key={r.value} label={r.label} onCard selected={role === r.value} onPress={() => setRole(role === r.value ? null : r.value)} />
        ))}
      </Group>
    );
  return (
    <Group label="Position">
      {LINES.map((l) => (
        <Chip key={l.key} label={l.label} onCard selected={position === l.label} onPress={() => setPosition(position === l.label ? '' : l.label)} />
      ))}
    </Group>
  );
}

/** Adding a player (from their email or number first), or changing one. The parent remounts it with a fresh key each time it opens. */
export function PoolPlayerSheet({ visible, onClose, onSaved, tournamentId, sport, pool, player, auctionStarted }: {
  visible: boolean;
  onClose: () => void;
  onSaved: (pool: Pool) => void;
  tournamentId: number;
  sport: Sport;
  pool: Pool;
  /** Null to add. */
  player: PoolPlayer | null;
  auctionStarted: boolean;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const options = useAuthOptions();

  const [step, setStep] = useState<'find' | 'account' | 'form'>(player ? 'form' : 'find');
  const [contact, setContact] = useState('');
  const [found, setFound] = useState<PlayerLookup | null>(null);
  const [note, setNote] = useState('');
  const [name, setName] = useState(player?.name ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [tierId, setTierId] = useState<number | null>(player?.tierId ?? pool.tiers[pool.tiers.length - 1]?.id ?? null);
  const [role, setRole] = useState<CricketRole | null>(player?.cricketRole ?? null);
  const [position, setPosition] = useState(player?.position ?? '');

  const done = (next: Pool) => {
    haptic.success();
    onSaved(next);
    onClose();
  };

  const lookUp = async () => {
    const res = await action.run(() => api.call<PlayerLookup>('POOL_LOOKUP', { routeParams: { id: tournamentId }, body: { contact: contact.trim() } }));
    if (!res.ok) return;
    if (res.value.found) {
      setFound(res.value);
      setStep('account');
      return;
    }
    if (res.value.kind === 'Email') setEmail(res.value.contact);
    else setPhone(res.value.display);
    setNote(`No account uses ${res.value.display} yet. Add their name; they'll be linked when they sign up.`);
    setStep('form');
  };

  const add = async () => {
    const body =
      step === 'account' && found
        ? { [found.kind === 'Email' ? 'email' : 'phone']: found.contact, tierId, cricketRole: role, position: position || null }
        : { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, tierId, cricketRole: role, position: position || null };
    const res = await action.run(() => api.call<Pool>('POOL_PLAYER_ADD', { routeParams: { id: tournamentId }, body }));
    if (res.ok) done(res.value);
  };

  const save = async () => {
    if (!player) return step === 'find' ? lookUp() : add();
    const res = await action.run(() =>
      api.call<Pool>('POOL_PLAYER_UPDATE', {
        routeParams: { id: tournamentId, poolPlayerId: player.id },
        body: auctionStarted
          ? {}
          : { name: player.isLinked ? null : name.trim(), cricketRole: role, position: position || null, tierId, setTier: true },
      }),
    );
    if (res.ok) done(res.value);
  };

  const withdraw = async (withdrawn: boolean) => {
    if (!player) return;
    const res = await action.run(() =>
      api.call<Pool>('POOL_PLAYER_UPDATE', { routeParams: { id: tournamentId, poolPlayerId: player.id }, body: { withdrawn } }),
    );
    if (res.ok) done(res.value);
  };

  const remove = async () => {
    if (!player) return;
    const ok = await confirm({ title: `Remove ${player.name}?`, message: 'They come out of the pool.', confirmLabel: 'Remove', destructive: true });
    if (!ok) return;
    const res = await action.run(() => api.call<Pool>('POOL_PLAYER_REMOVE', { routeParams: { id: tournamentId, poolPlayerId: player.id } }));
    if (res.ok) {
      haptic.heavy();
      onSaved(res.value);
      onClose();
    }
  };

  const primary = player ? 'Save' : step === 'find' ? 'Find' : 'Add to the pool';
  const canChange = !player || !auctionStarted;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={player ? player.name : 'Add to the pool'}
      subtitle={player ? (player.role ?? undefined) : 'Players wait here for a team'}
      footer={
        canChange ? (
          <>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label={primary}
              icon={step === 'find' && !player ? 'account-search-outline' : 'check'}
              onPress={save}
              busy={action.busy}
              disabled={(step === 'find' && !player && contact.trim() === '') || (step === 'account' && !!found?.playsFor) || (step === 'form' && !player && !name.trim())}
              style={{ flex: 2 }}
            />
          </>
        ) : undefined
      }
    >
      <ErrorBanner message={action.error?.message} />
      {!player && step === 'find' ? (
        <>
          <TextField
            label={options.phone ? 'Their email or mobile number' : 'Their sign-in email'}
            value={contact}
            onChangeText={setContact}
            placeholder={options.phone ? 'e.g. rahul@example.com or 98765 43210' : 'e.g. rahul@example.com'}
            keyboardType={options.phone ? 'default' : 'email-address'}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            returnKeyType="search"
            onSubmitEditing={lookUp}
            hint="If they have an account, they're added as themselves and see the auction on their phone."
          />
          <Button label="Add someone without an email or number" variant="ghost" onPress={() => setStep('form')} />
        </>
      ) : !player && step === 'account' && found ? (
        <>
          <View style={[styles.found, { backgroundColor: theme.chip }]}>
            <Text style={[type.bodyStrong, { color: theme.ink }]}>{found.name}</Text>
            <Text style={[type.caption, { color: theme.muted }]}>
              {found.playsFor
                ? `Already in ${found.playsFor}, so they can't be added.`
                : `Has an account (${found.display}). Their own name${sport === 'Cricket' ? ' and cricket role are' : ' is'} used.`}
            </Text>
          </View>
          <Button label="Use another email or number" variant="ghost" onPress={() => setStep('find')} />
          {!found.playsFor && <TierChoice tiers={pool.tiers} value={tierId} onChange={setTierId} />}
          {!found.playsFor && sport === 'Football' && <RoleChoice sport={sport} role={role} setRole={setRole} position={position} setPosition={setPosition} />}
        </>
      ) : (
        <>
          {note !== '' && <Text style={[type.body, { color: theme.muted }]}>{note}</Text>}
          {canChange && (
            <>
              <TextField
                label="Name"
                value={name}
                onChangeText={(v) => setName(capitalizeWords(v))}
                placeholder="e.g. Pranav Iyer"
                autoCapitalize="words"
                editable={!player?.isLinked}
                hint={player?.isLinked ? 'Their account name — they change it themselves.' : undefined}
              />
              {!player && (
                <>
                  <TextField
                    label="Their sign-in email (optional)"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="e.g. rahul@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    hint="Links them to their account when they sign up."
                  />
                  {options.phone && (
                    <TextField label="Their mobile number (optional)" value={phone} onChangeText={setPhone} placeholder="e.g. 98765 43210" keyboardType="phone-pad" />
                  )}
                </>
              )}
              <TierChoice tiers={pool.tiers} value={tierId} onChange={setTierId} />
              {!(sport === 'Cricket' && player?.isLinked) && (
                <RoleChoice sport={sport} role={role} setRole={setRole} position={position} setPosition={setPosition} />
              )}
            </>
          )}
          {player && auctionStarted && (
            <Text style={[type.body, { color: theme.muted }]}>
              {player.status === 'Sold'
                ? `Bought by ${player.teamName} for ${amount(player.price)}. Undo the sale on the auction screen to change that.`
                : 'The auction has started, so tiers are fixed. You can still take a player out of it.'}
            </Text>
          )}
          {player && auctionStarted && player.status !== 'Sold' && (
            <Button
              label={player.isWithdrawn ? 'Put back in the auction' : 'Withdraw from the auction'}
              icon={player.isWithdrawn ? 'account-reactivate-outline' : 'account-cancel-outline'}
              variant="secondary"
              onPress={() => withdraw(!player.isWithdrawn)}
              disabled={action.busy}
            />
          )}
          {player && pool.canEdit && (
            <Button label="Remove from the pool" icon="trash-can-outline" variant="danger" onPress={remove} disabled={action.busy} />
          )}
        </>
      )}
    </Sheet>
  );
}

type TierDraft = { key: string; id: number | null; name: string; price: string; max: number };

/** The tiers, top first, with their base prices and "at most N per team". Saved as a whole. */
export function TierSheet({ visible, onClose, onSaved, tournamentId, tiers, unit, prices = true }: {
  visible: boolean;
  onClose: () => void;
  onSaved: (pool: Pool) => void;
  tournamentId: number;
  tiers: PoolTier[];
  unit: string;
  /** False for a draw: tiers only set the order names are drawn in, so no prices or limits. */
  prices?: boolean;
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const action = useAction();
  const [rows, setRows] = useState<TierDraft[]>(() =>
    (tiers.length > 0 ? tiers : [
      { id: 0, name: 'Marquee', basePrice: 1000, maxPerTeam: null },
      { id: 0, name: 'A', basePrice: 500, maxPerTeam: null },
      { id: 0, name: 'B', basePrice: 200, maxPerTeam: null },
      { id: 0, name: 'C', basePrice: 100, maxPerTeam: null },
    ]).map((t, i) => ({ key: `${t.id}-${i}`, id: t.id || null, name: t.name, price: String(t.basePrice), max: t.maxPerTeam ?? 0 })),
  );

  const change = (key: string, patch: Partial<TierDraft>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...rows];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    haptic.select();
    setRows(next);
  };

  const save = async () => {
    const body = {
      tiers: rows.map((r) => ({ id: r.id, name: r.name.trim(), basePrice: Number(r.price.replace(/[^0-9]/g, '')) || 0, maxPerTeam: r.max > 0 ? r.max : null })),
    };
    const res = await action.run(() => api.call<Pool>('POOL_TIERS_SAVE', { routeParams: { id: tournamentId }, body }));
    if (!res.ok) return;
    haptic.success();
    onSaved(res.value);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={prices ? 'Tiers and base prices' : 'Tiers'}
      subtitle={prices ? 'Top tier first. The auction opens them in this order.' : 'Top tier first. The draw deals them in this order.'}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label="Save tiers" icon="check" onPress={save} busy={action.busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={action.error?.message} />
      {rows.map((r, i) => (
        <View key={r.key} style={[styles.tier, { borderColor: theme.cardDivider }]}>
          <View style={styles.tierHead}>
            <View style={{ flex: 1 }}>
              <TextField label={`Tier ${i + 1}`} value={r.name} onChangeText={(v) => change(r.key, { name: v })} maxLength={30} />
            </View>
            {prices && (
              <View style={{ width: 120 }}>
                <TextField
                  label={`Base (${unit})`}
                  value={r.price}
                  onChangeText={(v) => change(r.key, { price: v.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </View>
            )}
          </View>
          {prices && (
            <Stepper
              label="Most a team may buy"
              hint={r.max > 0 ? 'A team at its limit can’t bid on this tier' : 'Teams buy freely'}
              value={r.max}
              min={0}
              max={20}
              display={r.max === 0 ? 'No limit' : String(r.max)}
              onChange={(v) => change(r.key, { max: v })}
            />
          )}
          <View style={styles.tierActions}>
            {i > 0 && <Button label="Move up" icon="arrow-up" variant="ghost" size="sm" onPress={() => moveUp(i)} />}
            <Button label="Remove" icon="close" variant="ghost" size="sm" onPress={() => setRows(rows.filter((x) => x.key !== r.key))} />
          </View>
        </View>
      ))}
      {rows.length < 8 && (
        <Button
          label="Add a tier"
          icon="plus"
          variant="secondary"
          onPress={() => setRows([...rows, { key: `new-${Date.now()}`, id: null, name: '', price: '100', max: 0 }])}
        />
      )}
      <Text style={[type.caption, { color: theme.muted }]}>Players in a removed tier go to “No tier”.</Text>
    </Sheet>
  );
}

/** Moving the picked players to one tier. */
export function MoveSheet({ visible, onClose, onPick, tiers, count, busy, prices = true }: {
  visible: boolean;
  onClose: () => void;
  onPick: (tierId: number | null) => void;
  tiers: PoolTier[];
  count: number;
  busy: boolean;
  prices?: boolean;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={`Move ${count === 1 ? '1 player' : `${count} players`}`} subtitle="To which tier?">
      {tiers.map((t) => (
        <Button key={t.id} label={prices ? `${t.name} · base ${amount(t.basePrice)}` : t.name} variant="deck" onPress={() => onPick(t.id)} disabled={busy} />
      ))}
      <Button label="No tier" variant="deck" onPress={() => onPick(null)} disabled={busy} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, borderRadius: radius.lg, minHeight: 56 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  found: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  tier: { gap: space.sm, borderBottomWidth: 1, paddingBottom: space.md },
  tierHead: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  tierActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
