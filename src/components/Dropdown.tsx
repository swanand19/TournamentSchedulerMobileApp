import { useRef, useState, type RefObject } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glass from '@/components/Glass';
import Icon from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { haptic } from '@/lib/haptics';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { space, type Typography } from '@/theme/theme';

// One choice from a list, shown as what is chosen ("Leaderboard / Most runs ▾"), its list opening just under it (2026-11-27,
// the user's pick A for a league's Stats tab, canvas boards League-Stats and League-Stats-Open). An option may carry a
// figure and a line on the right (a leaderboard's leader), so the open list is worth a look on its own.
// Glass: the control is clear glass and the list a dense glass pane; light: a hairline-outlined box and a white list.
// The list goes below the control, or above it when there's no room, and scrolls when long. A tap outside or Back closes it.

export type DropdownOption<K extends string> = { key: K; label: string; figure?: string; detail?: string };

type Props<K extends string> = {
  /** The small word above the choice ("Leaderboard", "Seasons"). */
  caption: string;
  options: DropdownOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** What the control shows when it differs from the option's label ("All" for "All seasons"). */
  shown?: string;
  style?: StyleProp<ViewStyle>;
  /**
   * Light theme's plain dropdown (2026-11-27, canvas Stats-L-B2-Open): the control is the foot of an outlined box
   * (this ref) that draws the edge, and the list hangs straight from the box's bottom, as wide as it, names only.
   */
  attachTo?: RefObject<View | null>;
  /** Told when the list opens and closes, so an attached box can draw its open edge. */
  onOpenChange?: (open: boolean) => void;
};

const GAP = 8;
const ROW = 52;

export default function Dropdown<K extends string>({ caption, options, value, onChange, shown, style, attachTo, onOpenChange }: Props<K>) {
  const { type } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const anchor = useRef<View>(null);
  const [at, setAt] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const chosen = options.find((o) => o.key === value) ?? options[0];

  const attached = !!attachTo;
  const open = () => {
    haptic.select();
    (attachTo ?? anchor).current?.measureInWindow((x, y, w, h) => {
      setAt({ x, y, w, h });
      onOpenChange?.(true);
    });
  };
  const close = () => {
    setAt(null);
    onOpenChange?.(false);
  };

  // Where the list goes: under the control if most of it fits, else above; never narrower than 240.
  // Attached, always straight under the box (it scrolls when the room is short), as wide as the box.
  let panel: { left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null = null;
  if (at && attached) {
    panel = { left: at.x, width: at.w, top: at.y + at.h, maxHeight: Math.max(window.height - insets.bottom - space.lg - (at.y + at.h), ROW * 2) };
  } else if (at) {
    const width = Math.min(Math.max(at.w, 240), window.width - 2 * space.lg);
    const left = Math.min(Math.max(at.x, space.lg), window.width - width - space.lg);
    const below = window.height - insets.bottom - space.lg - (at.y + at.h + GAP);
    const above = at.y - insets.top - space.lg - GAP;
    const wanted = options.length * ROW + 12;
    panel =
      below >= Math.min(wanted, 260) || below >= above
        ? { left, width, top: at.y + at.h + GAP, maxHeight: below }
        : { left, width, bottom: window.height - at.y + GAP, maxHeight: above };
  }

  return (
    <>
      <View ref={anchor} collapsable={false} style={style}>
        <PressableScale
          onPress={open}
          feel={light ? 'press' : 'glass'}
          glowRadius={18}
          accessibilityRole="button"
          accessibilityLabel={`${caption}: ${chosen?.label ?? ''}. Change`}
          accessibilityState={{ expanded: !!at }}
          style={[
            styles.control,
            attached
              ? styles.attachedControl
              : light
                ? { borderColor: at ? theme.accent : theme.fieldBorder }
                : at && { borderColor: theme.accent, borderWidth: 1 },
          ]}
        >
          {!light && !attached && <Glass pointerEvents="none" radius={18} interactive style={StyleSheet.absoluteFill} />}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.caption, { color: theme.muted }]} numberOfLines={1}>
              {caption}
            </Text>
            <Text style={[type.bodyStrong, styles.value, { color: theme.ink }]} numberOfLines={1}>
              {shown ?? chosen?.label}
            </Text>
          </View>
          <Icon name={at ? 'chevron-up' : 'chevron-down'} size={20} color={attached && at ? theme.accent : theme.muted} />
        </PressableScale>
      </View>

      <Modal visible={!!at} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
        {/* Attached, nothing dims: the list belongs to the box, which stays in view above it. */}
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: attached ? 'transparent' : theme.scrim }]} onPress={close} accessibilityLabel="Close the list" />
        {panel && (
          <Animated.View
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(100)}
            style={[
              styles.panel,
              { left: panel.left, width: panel.width, top: panel.top, bottom: panel.bottom, maxHeight: panel.maxHeight },
              attached
                ? [styles.attachedPanel, { backgroundColor: theme.sheetFill, borderColor: theme.accent }]
                : light
                  ? { backgroundColor: theme.sheetFill, borderColor: theme.cardDivider }
                  : { backgroundColor: theme.page, borderColor: theme.glassBorder },
            ]}
            accessibilityRole="menu"
            accessibilityLabel={caption}
          >
            {/* Glass: the pane's sheen over a solid base, so the leaderboard behind never shows through the words. */}
            {!light && !attached && <Glass floating pointerEvents="none" radius={24} style={StyleSheet.absoluteFill} />}
            <ScrollView bounces={false} contentContainerStyle={attached ? styles.attachedList : { padding: 6 }}>
              {options.map((o) => {
                const on = o.key === value;
                if (attached) {
                  // Names only, full width, the chosen one tinted and ticked at the right.
                  return (
                    <PressableScale
                      key={o.key}
                      onPress={() => {
                        close();
                        if (!on) {
                          haptic.select();
                          onChange(o.key);
                        }
                      }}
                      accessibilityRole="menuitem"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={o.label}
                      style={[styles.attachedOption, on && { backgroundColor: theme.tint }]}
                    >
                      <Text style={[on ? type.bodyStrong : type.body, styles.attachedLabel, { color: on ? theme.deep : theme.ink }]} numberOfLines={1}>
                        {o.label}
                      </Text>
                      {on && <Icon name="check" size={20} color={theme.deep} />}
                    </PressableScale>
                  );
                }
                return (
                  <PressableScale
                    key={o.key}
                    onPress={() => {
                      close();
                      if (!on) {
                        haptic.select();
                        onChange(o.key);
                      }
                    }}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={[o.label, o.figure, o.detail].filter(Boolean).join(', ')}
                    style={[styles.option, on && { backgroundColor: light ? theme.tint : theme.glassSelected }]}
                  >
                    <View style={styles.tick}>{on && <Icon name="check" size={20} color={light ? theme.deep : theme.accent} />}</View>
                    <Text style={[type.bodyStrong, { flex: 1, color: theme.ink }]} numberOfLines={1}>
                      {o.label}
                    </Text>
                    {(o.figure || o.detail) && (
                      <View style={styles.right}>
                        {!!o.figure && <Text style={[type.bodyStrong, styles.figure, { color: theme.ink }]}>{o.figure}</Text>}
                        {!!o.detail && (
                          <Text style={[type.caption, { color: theme.muted }]} numberOfLines={1}>
                            {o.detail}
                          </Text>
                        )}
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}
      </Modal>
    </>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  control: {
    minHeight: 58,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.md,
  },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 15 },
  value: { fontSize: 17, lineHeight: 22 },
  panel: {
    position: 'absolute',
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 18px 44px rgba(0,0,0,0.35)',
  },
  attachedControl: { borderWidth: 0, borderRadius: 0 },
  // The box's own edge carries on round the list: no top edge (the box's divider is there), round only below.
  attachedPanel: {
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    boxShadow: '0 14px 30px rgba(35,43,54,0.12)',
  },
  attachedList: { paddingTop: 4, paddingBottom: 6 },
  attachedOption: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingLeft: space.lg, paddingRight: space.md },
  attachedLabel: { flex: 1, fontSize: 16, lineHeight: 21 },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: ROW, paddingHorizontal: space.md, borderRadius: 18, borderCurve: 'continuous' },
  tick: { width: 22, alignItems: 'center' },
  right: { alignItems: 'flex-end', maxWidth: '45%' },
  figure: { fontVariant: ['tabular-nums'] },
});
