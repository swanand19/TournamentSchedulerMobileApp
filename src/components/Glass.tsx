import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useGlassSupport } from '@/theme/glass';
import { useSportTheme } from '@/theme/SportTheme';
import { radius as radii } from '@/theme/theme';

// Clear glass for the floating layer: bar buttons, the tab bar, segmented tracks, the run pad, the
// bottom actions, sheets and menus. Never for content — content sits on frosted panels (Card).
//
// On iOS 26 this is Apple's own Liquid Glass (GlassView): it lenses what's behind it, takes the
// light and colour around it, and with `interactive` swells and lights up under a finger by itself.
// Elsewhere it's drawn: a frosted blur where the platform has one (earlier iOS, the web), a denser
// fill where it doesn't (Android, Reduce Transparency), under a bright top rim and a soft shadow.
// `tinted` is the one prominent action: a lit pane of the sport's colour.

type Props = ViewProps & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius; capsules pass half their height. */
  radius?: number;
  /** The one prominent action on the screen: glass tinted with the sport's colour. */
  tinted?: boolean;
  /** Apple's touch response (native glass only; PressableScale draws it elsewhere). */
  interactive?: boolean;
  /** Floats over scrolling content (tab bar, footer): needs the denser fill when there's no blur. */
  floating?: boolean;
};

export default function Glass({ children, style, radius = radii.glass, tinted, interactive, floating, ...rest }: Props) {
  const theme = useSportTheme();
  const support = useGlassSupport();
  const shape = { borderRadius: radius, borderCurve: 'continuous' as const };

  if (support === 'native') {
    return (
      <GlassView
        {...rest}
        glassEffectStyle="regular"
        isInteractive={interactive}
        colorScheme="dark"
        tintColor={tinted ? theme.accent : undefined}
        style={[shape, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (tinted) {
    return (
      <View
        {...rest}
        style={[
          shape,
          styles.tinted,
          {
            backgroundColor: theme.accent,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 26px ${theme.glow}`,
          },
          Platform.OS === 'web' ? ({ backgroundImage: theme.accentGradient } as object) : { experimental_backgroundImage: theme.accentGradient },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  const blur = support === 'blur';
  return (
    <View
      {...rest}
      style={[
        shape,
        styles.clear,
        {
          backgroundColor: blur || !floating ? theme.glassFill : theme.glassSolid,
          borderColor: theme.glassBorder,
          boxShadow: `inset 0 1px 0 ${theme.glassRim}, inset 0 -1px 0 rgba(255,255,255,0.06), 0 10px 30px rgba(0,0,0,0.35)`,
        },
        style,
      ]}
    >
      {blur && <BlurView intensity={40} tint="dark" style={[StyleSheet.absoluteFill, shape, styles.clip]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clear: { borderWidth: 1 },
  tinted: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  clip: { overflow: 'hidden' },
});
