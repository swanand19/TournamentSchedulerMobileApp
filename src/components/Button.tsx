import { ActivityIndicator, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import Glass from '@/components/Glass';
import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useSportTheme, useThemedStyles, useTypography } from '@/theme/SportTheme';
import { radius, space, type Typography } from '@/theme/theme';

// Every button in the app. The variants are jobs, drawn per theme:
//  primary   – the one thing to do on this screen. Glass: a lit pane of the sport's colour.
//  secondary – tactical actions (Yellow, Sub). Glass: a clear glass capsule.
//  deck      – a choice on a sheet or the scoreboard. Glass: a clear glass capsule.
//  ghost     – "also possible". Glass: just the words, in the sport's colour.
//  danger / success – red card & wicket / a confirmed result, nothing else.
// `display` is a scoring pad (+1 Goal): in the glass theme a plain key, because the pad it sits in
// is the glass (no glass on glass). Glass buttons answer a touch the Liquid Glass way: they swell
// and light up, then spring back (PressableScale's glass feel).
// Sizes: md 48dp (the minimum anywhere), lg 56dp (sticky footers), xl 64dp+ (scoring pads).
// The light theme keeps the same jobs in a quieter shape: pills, hairline outlines, no fills.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'deck' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: Size;
  icon?: IconName;
  /** Overrides the icon's colour — a booking button shows the card's own yellow. */
  iconColor?: string;
  /** Small second line under the label ("Rovers", "+1 wd"). */
  caption?: string;
  busy?: boolean;
  disabled?: boolean;
  /** A scoring pad key: bigger, bolder label. */
  display?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 56, xl: 72 };

export default function Button(props: Props) {
  const theme = useSportTheme();
  return theme.mode === 'light' ? <LightButton {...props} /> : <GlassButton {...props} />;
}

function GlassButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconColor,
  caption,
  busy,
  disabled,
  display,
  style,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();

  const height = HEIGHT[size];
  // Capsules everywhere; a scoring key is a rounded square-ish pane so a row of them reads as a pad.
  const corner = display ? 26 : Math.min(height / 2, 32);
  const key = display && (variant === 'primary' || variant === 'secondary' || variant === 'deck');
  const surface: 'tinted' | 'clear' | 'key' | 'danger' | 'none' =
    key ? 'key' : variant === 'primary' || variant === 'success' ? 'tinted' : variant === 'danger' ? 'danger' : variant === 'ghost' ? 'none' : 'clear';
  const fg = surface === 'tinted' ? theme.accentInk : surface === 'none' ? theme.accent : '#FFFFFF';

  const labelSize = display ? (size === 'xl' ? 24 : size === 'lg' ? 20 : 17) : size === 'sm' ? 14 : 16;
  const labelFont = display
    ? { fontFamily: fonts.bodyBold, fontSize: labelSize, lineHeight: labelSize * 1.2 }
    : { fontFamily: fonts.bodySemiBold, fontSize: labelSize, lineHeight: labelSize * 1.25 };

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      feel={surface === 'clear' || surface === 'tinted' ? 'glass' : 'press'}
      glow={surface === 'key' || surface === 'danger'}
      glowRadius={corner}
      accessibilityLabel={accessibilityLabel ?? (caption ? `${label}, ${caption}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!busy }}
      style={[
        styles.base,
        { minHeight: height, borderRadius: corner, paddingHorizontal: size === 'sm' ? space.md : space.lg },
        surface === 'none' && styles.ghost,
        style,
      ]}
    >
      {(surface === 'clear' || surface === 'tinted') && (
        <Glass pointerEvents="none" radius={corner} tinted={surface === 'tinted'} interactive style={StyleSheet.absoluteFill} />
      )}
      {surface === 'key' && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.key, { borderRadius: corner }]} />}
      {surface === 'danger' && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.danger,
            { borderRadius: corner },
            Platform.OS === 'web' ? ({ backgroundImage: DANGER } as object) : { experimental_backgroundImage: DANGER },
          ]}
        />
      )}
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={display ? labelSize : 20} color={iconColor ?? fg} />}
          <View style={{ alignItems: 'center', flexShrink: 1 }}>
            <Text numberOfLines={2} style={[labelFont, { color: fg, textAlign: 'center' }]}>
              {label}
            </Text>
            {caption ? (
              <Text numberOfLines={1} style={[styles.caption, { color: surface === 'tinted' ? theme.accentInk : theme.onDarkSoft }]}>
                {caption}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </PressableScale>
  );
}

/** The wicket and red-card pane: lit from above like the tinted glass, in red. */
const DANGER = 'linear-gradient(180deg, #D04A3C, #B3342A)';

function LightButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconColor,
  caption,
  busy,
  disabled,
  display,
  style,
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const { fonts } = useTypography();
  const styles = useThemedStyles(makeStyles);
  const theme = useSportTheme();

  // A filled pill for the one action, a hairline-outlined pill for everything else.
  const outline = { bg: 'transparent', fg: theme.ink, border: theme.fieldBorder };
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.accent, fg: theme.accentInk },
    secondary: outline,
    ghost: outline,
    deck: outline,
    danger: { bg: theme.dangerSolid, fg: theme.onDanger },
    success: { bg: theme.successSolid, fg: theme.onDanger },
  };
  // Scoring pads (+1 Goal) are keys, like the run pad's six: a pale fill inside the accent edge.
  const { bg, fg, border } = display && variant === 'primary' ? { bg: theme.tint, fg: theme.deep, border: theme.accent } : palette[variant];
  const labelSize = display ? (size === 'xl' ? 22 : size === 'lg' ? 20 : 17) : size === 'sm' ? 14 : 16;
  const labelFont = display
    ? { fontFamily: fonts.bodySemiBold, fontSize: labelSize, lineHeight: labelSize * 1.2 }
    : { fontFamily: fonts.bodyBold, fontSize: labelSize, lineHeight: labelSize * 1.25 };

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityLabel={accessibilityLabel ?? (caption ? `${label}, ${caption}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!busy }}
      style={[
        styles.base,
        {
          minHeight: HEIGHT[size],
          backgroundColor: bg,
          borderColor: border ?? 'transparent',
          borderWidth: border ? (display && variant === 'primary' ? 1.5 : 1) : 0,
          borderRadius: radius.pill,
          paddingHorizontal: size === 'sm' ? space.md : space.lg,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={display ? labelSize : 20} color={iconColor ?? fg} />}
          <View style={{ alignItems: 'center', flexShrink: 1 }}>
            <Text numberOfLines={2} style={[labelFont, { color: fg, textAlign: 'center' }]}>
              {label}
            </Text>
            {caption ? (
              <Text numberOfLines={1} style={[styles.lightCaption, { color: fg }]}>
                {caption}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </PressableScale>
  );
}

const makeStyles = ({ fonts }: Typography) => StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ghost: { minHeight: 44 },
  key: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
  },
  danger: { backgroundColor: '#C0392B', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)' },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17, marginTop: 1 },
  lightCaption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17, opacity: 0.9 },
});
