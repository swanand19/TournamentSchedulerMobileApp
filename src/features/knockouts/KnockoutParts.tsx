import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type {
  KnockoutFixture, KnockoutRound, KnockoutSide, KnockoutSlot, KnockoutSlotKind, KnockoutStage, Team,
} from '@/api/types';
import Button from '@/components/Button';
import { Card } from '@/components/Card';
import Chip from '@/components/Chip';
import ErrorBanner from '@/components/ErrorBanner';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import StatusChip from '@/components/StatusChip';
import TextField from '@/components/TextField';
import { useSportTheme, useTypography } from '@/theme/SportTheme';
import { radius, space } from '@/theme/theme';

// The knockout screen's pieces: a match card (each side's team, or where it comes from until that's
// known), the sheet an owner picks a team in, and the sheet that adds or edits a knockout match.

const LIVE = ['InProgress', 'Paused', 'PenaltyShootout', 'InningsBreak', 'SuperOver'];

export const ROUNDS: { value: KnockoutRound; label: string }[] = [
  { value: 'QuarterFinal', label: 'Quarter-final' },
  { value: 'SemiFinal', label: 'Semi-final' },
  { value: 'Final', label: 'Final' },
  { value: 'ThirdPlace', label: '3rd place' },
  { value: 'Qualifier', label: 'Qualifier' },
  { value: 'Eliminator', label: 'Eliminator' },
  { value: 'RoundOf16', label: 'Round of 16' },
  { value: 'Other', label: 'Other' },
];

/** How deep in the bracket each match sits, so the list reads round by round. */
export function inBracketOrder(fixtures: KnockoutFixture[]): KnockoutFixture[] {
  const byOrder = new Map(fixtures.map((f) => [f.order, f]));
  const memo = new Map<number, number>();
  const depth = (f: KnockoutFixture): number => {
    const known = memo.get(f.order);
    if (known != null) return known;
    const feeders = [f.home.slot, f.away.slot]
      .filter((s) => (s.kind === 'WinnerOf' || s.kind === 'LoserOf') && s.fromOrder != null && byOrder.has(s.fromOrder))
      .map((s) => depth(byOrder.get(s.fromOrder!)!) + 1);
    const d = feeders.length ? Math.max(...feeders) : 0;
    memo.set(f.order, d);
    return d;
  };
  return [...fixtures].sort((a, b) => depth(a) - depth(b) || a.order - b.order);
}

type CardProps = {
  fixture: KnockoutFixture;
  canEdit: boolean;
  canScore: boolean;
  onOpenMatch: () => void;
  onPickTeam: (side: 'Home' | 'Away') => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function KnockoutCard({ fixture: f, canEdit, canScore, onOpenMatch, onPickTeam, onEdit, onDelete }: CardProps) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const live = f.status != null && LIVE.includes(f.status);
  const ready = f.home.teamId != null && f.away.teamId != null;
  const waiting = canScore && f.status === 'NotStarted' && !ready;
  const openLabel = canScore
    ? f.status === 'NotStarted' ? (ready ? 'Start match' : 'Waiting for its teams') : live ? 'Open live scorer' : 'View summary'
    : f.status === 'NotStarted' ? 'Match preview' : live ? 'Watch live' : 'View result';

  return (
    <Card accessibilityLabel={`${f.label}: ${f.home.teamName ?? f.home.source} against ${f.away.teamName ?? f.away.source}`}>
      <View style={styles.top}>
        <Text style={[type.heading, { color: theme.ink, flex: 1 }]}>{f.label}</Text>
        {live ? <StatusChip label="Live" tone="live" /> : f.matchNumber != null ? <Text style={[type.caption, { color: theme.muted }]}>Match {f.matchNumber}</Text> : null}
      </View>
      <Side side={f.home} winner={f.winnerTeamId} canPick={canEdit && f.canChange} onPick={() => onPickTeam('Home')} />
      <View style={[styles.rule, { backgroundColor: theme.chip }]} />
      <Side side={f.away} winner={f.winnerTeamId} canPick={canEdit && f.canChange} onPick={() => onPickTeam('Away')} />
      {f.resultLine ? <Text style={[type.bodyStrong, { color: theme.successInk }]}>{f.resultLine}</Text> : null}
      {(f.matchId != null || (canEdit && f.canChange)) && (
        <View style={styles.actions}>
          {f.matchId != null && (
            <Button label={openLabel} size="sm" variant={live ? 'primary' : 'secondary'} disabled={waiting} onPress={onOpenMatch} style={{ flex: 1 }} />
          )}
          {canEdit && f.canChange && (
            <>
              <Button label="Edit" icon="pencil-outline" size="sm" variant="secondary" onPress={onEdit} />
              <Button label="Delete" icon="trash-can-outline" size="sm" variant="danger" onPress={onDelete} accessibilityLabel={`Delete ${f.label}`} />
            </>
          )}
        </View>
      )}
    </Card>
  );
}

function Side({ side, winner, canPick, onPick }: { side: KnockoutSide; winner: number | null; canPick: boolean; onPick: () => void }) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const through = winner != null && winner === side.teamId;
  const out = winner != null && side.teamId != null && winner !== side.teamId;
  return (
    <View style={[styles.side, { opacity: out ? 0.55 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.nameRow}>
          {through && <Icon name="trophy" size={16} color={theme.warnInk} />}
          <Text
            style={[side.teamName ? type.bodyStrong : type.body, { color: side.teamName ? theme.ink : theme.muted, fontStyle: side.teamName ? 'normal' : 'italic' }]}
            numberOfLines={2}
          >
            {side.teamName ?? side.source}
          </Text>
        </View>
        {side.teamName && side.source !== side.teamName && (
          <Text style={[type.caption, { color: theme.muted }]}>
            {side.source}
            {side.setByOwner ? ' · set by an owner' : ''}
          </Text>
        )}
      </View>
      {canPick && <Button label="Change" size="sm" variant="ghost" onPress={onPick} accessibilityLabel={`Change the team: ${side.source}`} />}
    </View>
  );
}

/** An owner's own choice for one side, or back to where it comes from. */
export function TeamPickSheet({
  visible, onClose, fixture, side, teams, onPick, busy,
}: {
  visible: boolean;
  onClose: () => void;
  fixture: KnockoutFixture | null;
  side: 'Home' | 'Away';
  teams: Team[];
  onPick: (teamId: number | null) => void;
  busy: boolean;
}) {
  const { type } = useTypography();
  const s = fixture ? (side === 'Home' ? fixture.home : fixture.away) : null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose the team" subtitle={fixture && s ? `${fixture.label} · ${s.source}` : undefined}>
      <Text style={[type.body]}>For a coin toss between sides level on everything, or a result settled off the field.</Text>
      <View style={styles.wrap}>
        {teams.map((t) => (
          <Chip key={t.id} label={t.name} onCard selected={s?.setByOwner === true && s.teamId === t.id} disabled={busy} onPress={() => onPick(t.id)} />
        ))}
      </View>
      {s?.setByOwner && <Button label={`Back to ${s.source}`} variant="secondary" onPress={() => onPick(null)} disabled={busy} />}
    </Sheet>
  );
}

export type SlotDraft = { kind: KnockoutSlotKind; teamId: number | null; groupName: string | null; place: number; fromOrder: number | null };

export const emptySlot = (): SlotDraft => ({ kind: 'Team', teamId: null, groupName: null, place: 1, fromOrder: null });

export const draftOf = (slot: KnockoutSlot): SlotDraft => ({
  kind: slot.kind, teamId: slot.teamId, groupName: slot.groupName, place: slot.place ?? 1, fromOrder: slot.fromOrder,
});

export const slotBody = (s: SlotDraft) => ({
  kind: s.kind,
  teamId: s.kind === 'Team' ? s.teamId : null,
  groupName: s.kind === 'GroupPlace' ? s.groupName : null,
  place: s.kind === 'GroupPlace' ? s.place : null,
  fromOrder: s.kind === 'WinnerOf' || s.kind === 'LoserOf' ? s.fromOrder : null,
});

export type FixtureDraft = { fixtureId: number | null; order: number | null; round: KnockoutRound; label: string; home: SlotDraft; away: SlotDraft };

const ordinal = (n: number) => (n === 1 ? 'Winner' : n === 2 ? 'Runner-up' : `${n}${n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`);

/** Add or edit one knockout match: its round, its name, and where each side comes from. */
export function FixtureSheet({
  draft, onChange, onClose, onSave, busy, error, teams, stage,
}: {
  draft: FixtureDraft | null;
  onChange: (d: FixtureDraft) => void;
  onClose: () => void;
  onSave: () => void;
  busy: boolean;
  error?: string;
  teams: Team[];
  stage: KnockoutStage;
}) {
  const earlier = draft ? stage.fixtures.filter((f) => draft.order == null || f.order < draft.order) : [];
  return (
    <Sheet
      visible={!!draft}
      onClose={onClose}
      title={draft?.fixtureId ? `Edit ${draft.label}` : 'Add a knockout match'}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
          <Button label={draft?.fixtureId ? 'Save changes' : 'Add match'} icon="check" onPress={onSave} busy={busy} style={{ flex: 2 }} />
        </>
      }
    >
      <ErrorBanner message={error} />
      {draft && (
        <>
          <Group label="Round">
            {ROUNDS.map((r) => (
              <Chip key={r.value} label={r.label} onCard selected={draft.round === r.value} onPress={() => onChange({ ...draft, round: r.value })} />
            ))}
          </Group>
          <TextField label="Name (optional)" value={draft.label} onChangeText={(v) => onChange({ ...draft, label: v })} placeholder="e.g. Semi-final 1" maxLength={60} />
          {(['home', 'away'] as const).map((key) => (
            <SlotPicker
              key={key}
              title={key === 'home' ? 'First side' : 'Second side'}
              value={draft[key]}
              onChange={(v) => onChange({ ...draft, [key]: v })}
              teams={teams}
              groups={stage.groups}
              earlier={earlier}
            />
          ))}
        </>
      )}
    </Sheet>
  );
}

function SlotPicker({
  title, value, onChange, teams, groups, earlier,
}: {
  title: string;
  value: SlotDraft;
  onChange: (v: SlotDraft) => void;
  teams: Team[];
  groups: KnockoutStage['groups'];
  earlier: KnockoutFixture[];
}) {
  const { type } = useTypography();
  const theme = useSportTheme();
  const [open, setOpen] = useState(false);
  const kinds: { value: KnockoutSlotKind; label: string }[] = [
    { value: 'Team', label: 'A team' },
    ...(groups.length > 0 ? [{ value: 'GroupPlace' as const, label: 'Group place' }] : []),
    ...(earlier.length > 0 ? [{ value: 'WinnerOf' as const, label: 'Winner of' }, { value: 'LoserOf' as const, label: 'Loser of' }] : []),
  ];
  const group = groups.find((g) => g.groupName === value.groupName);
  const set = (patch: Partial<SlotDraft>) => onChange({ ...value, ...patch });

  return (
    <View style={[styles.slot, { borderColor: theme.chip }]}>
      <Text style={[type.label, { color: theme.muted }]}>{title}</Text>
      <View style={styles.wrap}>
        {kinds.map((k) => (
          <Chip key={k.value} label={k.label} onCard selected={value.kind === k.value} onPress={() => set({ kind: k.value })} />
        ))}
      </View>
      {value.kind === 'Team' && (
        <View style={styles.wrap}>
          {teams.map((t) => (
            <Chip key={t.id} label={t.name} onCard selected={value.teamId === t.id} onPress={() => set({ teamId: t.id })} />
          ))}
        </View>
      )}
      {value.kind === 'GroupPlace' && (
        <>
          <View style={styles.wrap}>
            {groups.map((g) => (
              <Chip key={g.groupName} label={`Group ${g.groupName}`} onCard selected={value.groupName === g.groupName} onPress={() => set({ groupName: g.groupName, place: 1 })} />
            ))}
          </View>
          {group && (
            <View style={styles.wrap}>
              {Array.from({ length: group.teams }, (_, i) => i + 1).map((n) => (
                <Chip key={n} label={ordinal(n)} onCard selected={value.place === n} onPress={() => set({ place: n })} />
              ))}
            </View>
          )}
        </>
      )}
      {(value.kind === 'WinnerOf' || value.kind === 'LoserOf') && (
        <View style={styles.wrap}>
          {(open ? earlier : earlier.slice(-6)).map((f) => (
            <Chip key={f.order} label={f.label} onCard selected={value.fromOrder === f.order} onPress={() => set({ fromOrder: f.order })} />
          ))}
          {!open && earlier.length > 6 && <Chip label="More…" onCard onPress={() => setOpen(true)} />}
        </View>
      )}
    </View>
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

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  side: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  rule: { height: 1 },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: { gap: space.sm, borderWidth: 1, borderRadius: radius.lg, padding: space.md },
});
