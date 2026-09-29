import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import Icon, { type IconName } from '@/components/Icon';
import PressableScale from '@/components/PressableScale';
import { useSportTheme } from '@/theme/SportTheme';
import { fonts, radius, space } from '@/theme/theme';

// Every button in the app. The variants map to what the design system calls them:
//  primary   – amber floodlight fill, the one thing to do on this screen
//  secondary – cream card surface, for tactical actions (Yellow, Sub)
//  ghost     – outline on the pitch, for "also possible"
//  deck      – raised tile on the scoreboard deck
//  danger / success – red card & wicket / full-time confirmation, nothing else
// Sizes: md 48dp (the minimum anywhere), lg 56dp (sticky footers), xl 64dp+ (scoring pads).

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
  /** Small second line under the label ("ROVERS", "+1 WD"). */
  caption?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Display font (Anton, uppercase) for scoreboard-style pads. */
  display?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const HEIGHT: Record<Size, number> = { sm: 40, md: 48, lg: 56, xl: 72 };

export default function Button({
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
  const theme = useSportTheme();

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: theme.accent, fg: theme.accentInk },
    // A shade darker than the card it usually sits on, so its shape never rests on the outline alone.
    secondary: { bg: theme.chip, fg: theme.ink, border: theme.cardDivider },
    ghost: { bg: 'transparent', fg: theme.onDark, border: theme.borderOnDark },
    deck: { bg: theme.deckRaised, fg: theme.onDark, border: theme.borderOnDark },
    danger: { bg: theme.dangerSolid, fg: theme.onDanger },
    success: { bg: theme.successSolid, fg: theme.onDanger },
  };
  const { bg, fg, border } = palette[variant];
  const labelSize = display ? (size === 'xl' ? 26 : size === 'lg' ? 20 : 17) : size === 'sm' ? 14 : 16;

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
          borderWidth: border ? 1.5 : 0,
          paddingHorizontal: size === 'sm' ? space.md : space.lg,
        },
        variant === 'primary' && { borderBottomWidth: 3, borderBottomColor: 'rgba(0,0,0,0.22)' },
        // The same lip as primary, a step lighter. Android dropped the bottom of the plain uniform
        // outline on a chalk card; a bottom edge of its own renders reliably.
        variant === 'secondary' && { borderBottomWidth: 2.5, borderBottomColor: 'rgba(0,0,0,0.16)' },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Icon name={icon} size={display ? labelSize : 20} color={iconColor ?? fg} />}
          <View style={{ alignItems: 'center', flexShrink: 1 }}>
            <Text
              numberOfLines={2}
              style={[
                display
                  ? { fontFamily: fonts.display, fontSize: labelSize, lineHeight: labelSize * 1.15, letterSpacing: 0.5 }
                  : { fontFamily: fonts.bodyBold, fontSize: labelSize, lineHeight: labelSize * 1.25, letterSpacing: 0.3 },
                { color: fg, textAlign: 'center' },
              ]}
            >
              {display ? label.toUpperCase() : label}
            </Text>
            {caption ? (
              <Text numberOfLines={1} style={[styles.caption, { color: fg }]}>
                {caption}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  caption: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, opacity: 0.8, marginTop: 1 },
});
