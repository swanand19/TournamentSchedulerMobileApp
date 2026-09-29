import { StyleSheet, Text, View } from 'react-native';

import type { BallType, CricketRules, PitchType, TieResolution } from '@/api/types';
import Chip from '@/components/Chip';
import Stepper from '@/components/Stepper';
import SwitchRow from '@/components/SwitchRow';
import TextField from '@/components/TextField';
import { useSportTheme } from '@/theme/SportTheme';
import { space, type } from '@/theme/theme';

// Every rule of a cricket match, grouped the way a scorer thinks about them. Presets fill these in;
// this is for the league that plays two runs a wide or no LBW. Whatever's set here is sent whole.

const TIES: { value: TieResolution; label: string }[] = [
  { value: 'SuperOver', label: 'Super over' },
  { value: 'AllowTie', label: 'Tie stands' },
  { value: 'Bowlout', label: 'Bowl-out' },
  { value: 'BoundaryCount', label: 'Boundary count' },
];
const BALLS: BallType[] = ['Leather', 'Tennis', 'Tape', 'Other'];
const PITCHES: PitchType[] = ['Turf', 'Matting', 'Astroturf', 'Concrete', 'Other'];

export default function RulesEditor({ rules, onChange }: { rules: CricketRules; onChange: (r: CricketRules) => void }) {
  const theme = useSportTheme();
  const set = <K extends keyof CricketRules>(key: K, value: CricketRules[K]) => onChange({ ...rules, [key]: value });
  const timed = rules.format === 'MultiInningsTimed';

  return (
    <View style={{ gap: space.md }}>
      <Heading text="Overs & players" />
      {!timed && (
        <Stepper label="Overs per innings" value={rules.oversPerInnings ?? 20} min={1} max={50} onChange={(v) => set('oversPerInnings', v)} />
      )}
      <Stepper label="Balls per over" value={rules.ballsPerOver} min={4} max={10} onChange={(v) => set('ballsPerOver', v)} />
      <Stepper
        label="Max overs per bowler"
        value={rules.maxOversPerBowler ?? 0}
        min={0}
        max={25}
        display={rules.maxOversPerBowler ? String(rules.maxOversPerBowler) : 'None'}
        onChange={(v) => set('maxOversPerBowler', v === 0 ? null : v)}
      />
      <Stepper label="Players per side" value={rules.playersPerSide} min={2} max={11} onChange={(v) => set('playersPerSide', v)} />
      <SwitchRow label="Last man standing" hint="The last batter carries on alone" value={rules.lastManStanding} onChange={(v) => set('lastManStanding', v)} />

      <Heading text="Extras" />
      <Stepper label="Runs for a wide" value={rules.widePenaltyRuns} min={0} max={5} onChange={(v) => set('widePenaltyRuns', v)} />
      <Stepper label="Runs for a no-ball" value={rules.noBallPenaltyRuns} min={0} max={5} onChange={(v) => set('noBallPenaltyRuns', v)} />
      <SwitchRow label="Free hit after a no-ball" value={rules.freeHitAfterNoBall} onChange={(v) => set('freeHitAfterNoBall', v)} />
      <SwitchRow label="Free hit after a wide" value={rules.freeHitAfterWide} onChange={(v) => set('freeHitAfterWide', v)} />
      <SwitchRow label="Byes" value={rules.byesAllowed} onChange={(v) => set('byesAllowed', v)} />
      <SwitchRow label="Leg byes" value={rules.legByesAllowed} onChange={(v) => set('legByesAllowed', v)} />
      <SwitchRow label="LBW" hint="Often off in tennis-ball cricket" value={rules.lbwEnabled} onChange={(v) => set('lbwEnabled', v)} />
      <TextField
        label="Powerplay overs"
        value={rules.powerplayOvers ?? ''}
        onChangeText={(v) => set('powerplayOvers', v.trim() ? v : null)}
        placeholder="e.g. 1-6"
        hint="Over ranges, comma-separated: 1-6,16-20"
        autoCapitalize="none"
      />

      <Heading text="Result" />
      <Text style={[type.label, { color: theme.muted }]}>If the scores are level</Text>
      <View style={styles.wrap}>
        {TIES.map((t) => (
          <Chip key={t.value} label={t.label} onCard selected={rules.tieResolution === t.value} onPress={() => set('tieResolution', t.value)} />
        ))}
      </View>
      {timed && <SwitchRow label="Draw allowed" value={rules.drawAllowed} onChange={(v) => set('drawAllowed', v)} />}
      {rules.inningsPerSide > 1 && (
        <Stepper
          label="Follow-on margin"
          value={rules.followOnMargin ?? 0}
          min={0}
          max={250}
          step={25}
          display={rules.followOnMargin ? String(rules.followOnMargin) : 'Off'}
          onChange={(v) => set('followOnMargin', v === 0 ? null : v)}
        />
      )}
      {!timed && (
        <SwitchRow label="Duckworth-Lewis-Stern" hint="Revises the chase target when rain takes overs" value={rules.dlsEnabled} onChange={(v) => set('dlsEnabled', v)} />
      )}

      <Heading text="Conditions" />
      <View style={styles.wrap}>
        {BALLS.map((b) => (
          <Chip key={b} label={`${b} ball`} onCard selected={rules.ballType === b} onPress={() => set('ballType', b)} />
        ))}
      </View>
      <View style={styles.wrap}>
        {PITCHES.map((p) => (
          <Chip key={p} label={p} onCard selected={rules.pitchType === p} onPress={() => set('pitchType', p)} />
        ))}
      </View>
    </View>
  );
}

function Heading({ text }: { text: string }) {
  const theme = useSportTheme();
  return <Text style={[type.lead, { color: theme.ink, marginTop: space.sm }]}>{text}</Text>;
}

const styles = StyleSheet.create({ wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm } });
