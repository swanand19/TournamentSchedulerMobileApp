import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { initials } from '@/lib/format';
import { pictureUri } from '@/lib/pictures';
import { useSportTheme, useTypography } from '@/theme/SportTheme';

// The little round markers beside names: a team's initials, a player's shirt number, a person's photo
// or a tournament's logo (falling back to initials when there's no picture).
// Glass: initials sit in a small glass bead (the home side's tinted); a shirt number is just the
// figure in the sport's colour, as the design's squad lists draw it.

export function TeamBadge({ name, size = 36, home }: { name: string; size?: number; home?: boolean }) {
  const { fonts } = useTypography();
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        light
          ? { backgroundColor: home ? theme.tint : 'transparent', borderColor: home ? theme.accent : theme.fieldBorder }
          : {
              backgroundColor: home ? theme.accentSoft : theme.glassFill,
              borderColor: home ? theme.accent : theme.glassBorder,
              boxShadow: `inset 0 1px 0 ${theme.glassRim}`,
            },
      ]}
    >
      <Text
        style={
          light
            ? { fontFamily: fonts.display, fontSize: size * 0.42, color: theme.deep }
            : { fontFamily: fonts.bodyBold, fontSize: size * 0.34, color: theme.onDark }
        }
      >
        {initials(name)}
      </Text>
    </View>
  );
}

/**
 * A person's photo or a tournament's logo (`link` from the answer, HLD P-26), in the same round marker as
 * TeamBadge — whose initials it shows instead when there's no picture. `square`: a logo's rounded square.
 */
export function PhotoBadge({ link, name, size = 36, square }: { link: string | null | undefined; name: string; size?: number; square?: boolean }) {
  const theme = useSportTheme();
  const uri = pictureUri(link);
  if (!uri) return <TeamBadge name={name} size={size} />;
  return (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={{ uri }}
      // The link stays the same all day and the file behind it never changes: keep it on the phone.
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={150}
      style={{
        width: size,
        height: size,
        borderRadius: square ? Math.round(size * 0.24) : size / 2,
        backgroundColor: theme.mode === 'light' ? theme.tint : theme.glassFill,
      }}
    />
  );
}

export function JerseyBadge({ number, size = 44, highlight }: { number: number | null; size?: number; highlight?: boolean }) {
  const { fonts } = useTypography();
  const theme = useSportTheme();
  const light = theme.mode === 'light';
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.round,
        { width: size, height: size, borderRadius: size / 2 },
        // Just the number in the sport's ink; a tinted circle when it's the one that matters.
        { backgroundColor: highlight ? theme.tint : 'transparent', borderColor: highlight ? theme.accent : 'transparent' },
      ]}
    >
      <Text style={{ fontFamily: fonts.display, fontSize: size * 0.45, color: light ? theme.deep : highlight ? theme.onDark : theme.accent }}>
        {number ?? '–'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
